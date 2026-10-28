// Consultas de plataformas, lojas e categorias (sempre a partir dos jogos do usuário).
import { prisma } from '../db.js';
import { AppError, notFound } from '../lib/errors.js';
import { parseOrThrow, assertUuid } from '../lib/validate.js';
import { normalizeKey } from '../../../shared/domain.js';
import { platformRenameSchema } from '../../../shared/schemas.js';
import { uniquePlatformSlug } from './lookupService.js';

async function platformCounts(viewerId, platformIds = null) {
  const rows = await prisma.game.groupBy({
    by: ['platformId', 'ownershipStatus'],
    where: { ownerId: viewerId, ...(platformIds ? { platformId: { in: platformIds } } : {}) },
    _count: { _all: true },
  });
  const counts = new Map();
  for (const row of rows) {
    const entry = counts.get(row.platformId) ?? { ownedCount: 0, wishlistCount: 0 };
    if (row.ownershipStatus === 'OWNED') entry.ownedCount = row._count._all;
    else entry.wishlistCount = row._count._all;
    counts.set(row.platformId, entry);
  }
  return counts;
}

/** Menu dinâmico: só plataformas com pelo menos um jogo (adquirido ou desejado). */
export async function listPlatforms(viewerId) {
  const counts = await platformCounts(viewerId);
  if (counts.size === 0) return [];
  const platforms = await prisma.platform.findMany({
    where: { id: { in: [...counts.keys()] } },
    select: { id: true, name: true, slug: true },
    orderBy: { name: 'asc' },
  });
  return platforms.map((p) => {
    const c = counts.get(p.id);
    return { ...p, ...c, totalCount: c.ownedCount + c.wishlistCount };
  });
}

export async function getPlatformBySlug(viewerId, slug) {
  const clean = String(slug ?? '').toLowerCase();
  let platform = await prisma.platform.findUnique({
    where: { slug: clean },
    select: { id: true, name: true, slug: true },
  });
  let redirectTo = null;
  if (!platform) {
    const alias = await prisma.platformSlugAlias.findUnique({
      where: { slug: clean },
      include: { platform: { select: { id: true, name: true, slug: true } } },
    });
    if (alias) {
      platform = alias.platform;
      redirectTo = alias.platform.slug;
    }
  }
  if (!platform) throw notFound('Plataforma');
  const c = (await platformCounts(viewerId, [platform.id])).get(platform.id);
  if (!c) throw notFound('Plataforma');
  return { ...platform, ...c, totalCount: c.ownedCount + c.wishlistCount, redirectTo };
}

/** Renomeia preservando os jogos; o slug antigo continua funcionando como redirecionamento. */
export async function renamePlatform(viewerId, id, body) {
  assertUuid(id, 'Plataforma');
  const { name } = parseOrThrow(platformRenameSchema, body);
  return prisma.$transaction(async (tx) => {
    const platform = await tx.platform.findUnique({ where: { id } });
    if (!platform) throw notFound('Plataforma');
    const owns = await tx.game.count({ where: { platformId: id, ownerId: viewerId } });
    if (!owns) throw notFound('Plataforma');
    const normalizedName = normalizeKey(name);
    const clash = await tx.platform.findUnique({ where: { normalizedName } });
    if (clash && clash.id !== id) {
      throw new AppError(409, `Já existe a plataforma "${clash.name}"`, {
        fields: { name: 'Esse nome já está em uso' },
      });
    }
    let slug = platform.slug;
    if (normalizedName !== platform.normalizedName) {
      slug = await uniquePlatformSlug(tx, name, id);
      if (slug !== platform.slug) {
        await tx.platformSlugAlias.deleteMany({ where: { slug } });
        await tx.platformSlugAlias.upsert({
          where: { slug: platform.slug },
          create: { slug: platform.slug, platformId: id },
          update: { platformId: id },
        });
      }
    }
    const updated = await tx.platform.update({
      where: { id },
      data: { name, normalizedName, slug },
      select: { id: true, name: true, slug: true },
    });
    return { ...updated, previousSlug: platform.slug };
  });
}

export async function listStores(viewerId) {
  const rows = await prisma.game.groupBy({
    by: ['storeId'],
    where: { ownerId: viewerId, storeId: { not: null } },
    _count: { _all: true },
  });
  if (!rows.length) return [];
  const stores = await prisma.store.findMany({
    where: { id: { in: rows.map((r) => r.storeId) } },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  });
  const counts = new Map(rows.map((r) => [r.storeId, r._count._all]));
  return stores.map((s) => ({ ...s, gameCount: counts.get(s.id) }));
}

export async function listCategories(viewerId) {
  const rows = await prisma.gameCategory.groupBy({
    by: ['categoryId'],
    where: { game: { ownerId: viewerId } },
    _count: { _all: true },
  });
  if (!rows.length) return [];
  const categories = await prisma.category.findMany({
    where: { id: { in: rows.map((r) => r.categoryId) } },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  });
  const counts = new Map(rows.map((r) => [r.categoryId, r._count._all]));
  return categories.map((c) => ({ ...c, gameCount: counts.get(c.id) }));
}
