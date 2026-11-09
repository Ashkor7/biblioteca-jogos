// Perfil público (/u/:username). Regra de ouro: cada campo devolvido aqui é escolhido
// numa lista explícita (allowlist) e condicionado às preferências do dono. Nada de
// e-mail, ids de usuário, preços por jogo, lojas por jogo, datas de compra, avaliações
// escritas, XP detalhado ou coleções privadas. Perfil inexistente e perfil privado
// respondem o mesmo 404, para não revelar quais usernames existem.
import { z } from 'zod';
import { prisma } from '../db.js';
import { notFound } from '../lib/errors.js';
import { parseOrThrow, assertUuid } from '../lib/validate.js';
import { uploadUrl, publicGameToDto, coverOf } from '../lib/serialize.js';
import { ACHIEVEMENTS_BY_CODE, levelProgress, ACTIVITY_TYPES } from '../../../shared/progression.js';
import { usernameField } from '../../../shared/schemas.js';
import { resolveTitle, pickPrivacy } from './profileService.js';
import { listFavorites } from './favoriteService.js';
import * as stats from './statisticsService.js';

const EMBED_PAGE = 24;
const NOT_FOUND = 'Perfil';

const publicGameSelect = {
  id: true,
  title: true,
  ownershipStatus: true,
  playStatus: true,
  playTimeMinutes: true,
  ratingStars: true,
  platform: { select: { name: true, slug: true } },
  images: { select: { url: true, isCover: true }, orderBy: [{ position: 'asc' }, { createdAt: 'asc' }] },
};

// Chaves de `data` das atividades que podem sair; o resto é descartado.
const ACTIVITY_DATA_KEYS = ['title', 'name', 'level', 'code', 'rarity', 'stars'];

async function findPublicProfile(username, { allowPrivate = false } = {}) {
  const parsed = usernameField.safeParse(username);
  if (!parsed.success) throw notFound(NOT_FOUND);
  const profile = await prisma.playerProfile.findUnique({ where: { username: parsed.data } });
  if (!profile || (!profile.isPublic && !allowPrivate)) throw notFound(NOT_FOUND);
  return profile;
}

async function publicLibraryPage(profile, ownership, page = 1, pageSize = EMBED_PAGE) {
  const where = { ownerId: profile.userId, ownershipStatus: ownership };
  const [total, rows] = await prisma.$transaction([
    prisma.game.count({ where }),
    prisma.game.findMany({
      where,
      select: publicGameSelect,
      orderBy: [{ title: 'asc' }, { id: 'asc' }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);
  return {
    items: rows.map((g) => publicGameToDto(g, profile)),
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

async function publicCollections(userId) {
  const rows = await prisma.gameCollection.findMany({
    where: { ownerId: userId, isPublic: true },
    orderBy: { updatedAt: 'desc' },
    select: {
      id: true,
      name: true,
      description: true,
      coverGame: { select: { images: { select: { url: true, isCover: true } } } },
      _count: { select: { items: true } },
      items: { take: 1, orderBy: { position: 'asc' }, select: { game: { select: { images: { select: { url: true, isCover: true } } } } } },
    },
  });
  return rows.map((c) => ({
    id: c.id,
    name: c.name,
    description: c.description,
    gameCount: c._count.items,
    coverUrl: (c.coverGame && coverOf(c.coverGame)) ?? (c.items[0] ? coverOf(c.items[0].game) : null),
  }));
}

/**
 * Monta a visão de visitante. Usado tanto pelo endpoint público quanto pela prévia
 * do dono — assim a prévia mostra exatamente o que um visitante receberia.
 */
export async function buildPublicView(profile) {
  const userId = profile.userId;
  const p = pickPrivacy(profile);
  const unlocked = await prisma.userAchievement.findMany({
    where: { userId },
    orderBy: { unlockedAt: 'desc' },
    select: { code: true, unlockedAt: true },
  });
  const ctx = { unlockedCodes: new Set(unlocked.map((u) => u.code)), level: profile.level };
  const progress = levelProgress(profile.totalXp);
  const view = {
    username: profile.username,
    displayName: profile.displayName,
    bio: profile.bio,
    avatarUrl: uploadUrl(profile.avatarKey),
    bannerUrl: uploadUrl(profile.bannerKey),
    title: resolveTitle(profile, ctx),
    level: progress.level,
    progressPercent: progress.percent,
    sections: {},
  };

  if (p.showFavorites) {
    const favs = await listFavorites(userId, { onlyShown: true });
    view.sections.favorites = favs.items.map((g) => publicGameToDto({ ...g, images: [{ url: g.coverUrl, isCover: true }] }, p));
  }
  if (p.showAchievements) {
    view.sections.achievements = unlocked
      .map((u) => ({ def: ACHIEVEMENTS_BY_CODE[u.code], unlockedAt: u.unlockedAt }))
      .filter((u) => u.def)
      .map(({ def, unlockedAt }) => ({
        code: def.code,
        name: def.name,
        description: def.description,
        icon: def.icon,
        rarity: def.rarity,
        category: def.category,
        unlockedAt,
      }));
  }
  if (p.showActivity) {
    const rows = await prisma.playerActivity.findMany({
      where: { userId },
      orderBy: { occurredAt: 'desc' },
      take: 15,
      select: { type: true, data: true, retroactive: true, occurredAt: true },
    });
    view.sections.activity = rows.map((a) => ({
      type: a.type,
      label: ACTIVITY_TYPES[a.type] ?? a.type,
      retroactive: a.retroactive,
      occurredAt: a.occurredAt,
      data: Object.fromEntries(
        Object.entries(a.data ?? {}).filter(
          ([k]) => ACTIVITY_DATA_KEYS.includes(k) || (k === 'minutes' && p.showPlayStats),
        ),
      ),
    }));
  }

  const wantsOverview = p.showPlayStats || p.showOriginalValue || p.showPaidTotal || p.showSavings;
  const overview = wantsOverview ? await stats.overview(userId) : null;
  if (p.showPlayStats) {
    const platforms = await stats.byPlatform(userId);
    const lib = overview.library;
    view.sections.playStats = {
      owned: lib.owned,
      completed: lib.completed,
      playing: lib.playing,
      notStarted: lib.notStarted,
      abandoned: lib.abandoned,
      totalMinutes: overview.playTime.totalMinutes,
      platforms: platforms.items.length,
      achievementsUnlocked: unlocked.length,
      completionPercent: lib.owned ? Math.round((lib.completed / lib.owned) * 1000) / 10 : null,
    };
  }
  if (p.showOriginalValue || p.showPaidTotal || p.showSavings) {
    const f = overview.finance;
    view.sections.finance = {
      ...(p.showOriginalValue ? { originalTotal: f.originalTotal } : {}),
      ...(p.showPaidTotal ? { paidTotal: f.paidTotal } : {}),
      ...(p.showSavings ? { savings: f.savings, discountPercent: f.discountPercent } : {}),
    };
  }
  if (p.showStoreRanking) {
    const ranking = await stats.byStore(userId, { sort: 'count' });
    view.sections.storeRanking = ranking.items.slice(0, 5).map((s) => ({
      name: s.name,
      purchases: s.games,
      ...(p.showSavings ? { savings: s.savings } : {}),
    }));
  }
  if (p.showLibrary) view.sections.library = await publicLibraryPage(profile, 'OWNED');
  if (p.showWishlist) view.sections.wishlist = await publicLibraryPage(profile, 'WISHLIST');
  view.sections.collections = await publicCollections(userId);
  return view;
}

export async function getPublicProfile(username) {
  return buildPublicView(await findPublicProfile(username));
}

/** Prévia do dono: mesma montagem, mesmo com o perfil ainda privado. */
export async function previewOwnProfile(userId) {
  const profile = await prisma.playerProfile.findUnique({ where: { userId } });
  if (!profile) throw notFound(NOT_FOUND);
  return { ...(await buildPublicView(profile)), isPublic: profile.isPublic };
}

const pageQuery = z.object({ page: z.coerce.number().int().min(1).max(10_000).default(1) });

export async function getPublicGames(username, ownership, rawQuery) {
  const profile = await findPublicProfile(username);
  const allowed = ownership === 'OWNED' ? profile.showLibrary : profile.showWishlist;
  if (!allowed) throw notFound('Seção');
  const { page } = parseOrThrow(pageQuery, rawQuery, 'Página inválida');
  return publicLibraryPage(profile, ownership, page);
}

export async function getPublicCollection(username, collectionId) {
  const profile = await findPublicProfile(username);
  assertUuid(collectionId, 'Coleção');
  const collection = await prisma.gameCollection.findFirst({
    where: { id: collectionId, ownerId: profile.userId, isPublic: true },
    select: {
      id: true,
      name: true,
      description: true,
      items: { orderBy: [{ position: 'asc' }, { addedAt: 'asc' }], select: { game: { select: publicGameSelect } } },
    },
  });
  if (!collection) throw notFound('Coleção');
  return {
    id: collection.id,
    name: collection.name,
    description: collection.description,
    owner: { username: profile.username, displayName: profile.displayName },
    items: collection.items.map((i) => publicGameToDto(i.game, profile)),
  };
}
