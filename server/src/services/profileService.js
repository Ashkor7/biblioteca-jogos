// Perfil do jogador (área do proprietário). O que visitantes veem fica em publicService.
import { prisma } from '../db.js';
import { config } from '../config.js';
import { AppError } from '../lib/errors.js';
import { parseOrThrow } from '../lib/validate.js';
import { uploadUrl } from '../lib/serialize.js';
import { saveImageBuffer, removeStoredFiles } from '../lib/storage.js';
import { profileUpdateSchema, privacySchema, PRIVACY_KEYS } from '../../../shared/schemas.js';
import {
  ACHIEVEMENTS,
  DEFAULT_TITLE,
  TITLES,
  TITLES_BY_CODE,
  isTitleUnlocked,
  levelProgress,
} from '../../../shared/progression.js';
import { ensureProfile, syncNow } from './progressionService.js';
import * as stats from './statisticsService.js';

export const pickPrivacy = (profile) => Object.fromEntries(PRIVACY_KEYS.map((k) => [k, profile[k]]));

async function titleContext(userId, level) {
  const unlocked = await prisma.userAchievement.findMany({ where: { userId }, select: { code: true } });
  return { unlockedCodes: new Set(unlocked.map((u) => u.code)), level };
}

/** Título exibido: o escolhido (se ainda desbloqueado) ou o inicial. */
export function resolveTitle(profile, ctx) {
  const chosen = profile.titleCode ? TITLES_BY_CODE[profile.titleCode] : null;
  const title = chosen && isTitleUnlocked(chosen, ctx) ? chosen : TITLES_BY_CODE[DEFAULT_TITLE];
  return { code: title.code, name: title.name };
}

export function publicProfileUrl(username) {
  return config.PUBLIC_APP_URL ? `${config.PUBLIC_APP_URL.replace(/\/$/, '')}/u/${username}` : null;
}

async function profileDto(userId) {
  const [profile, user] = await Promise.all([
    prisma.playerProfile.findUniqueOrThrow({ where: { userId } }),
    prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { createdAt: true } }),
  ]);
  const ctx = await titleContext(userId, profile.level);
  return {
    username: profile.username,
    displayName: profile.displayName,
    bio: profile.bio,
    avatarUrl: uploadUrl(profile.avatarKey),
    bannerUrl: uploadUrl(profile.bannerKey),
    title: resolveTitle(profile, ctx),
    joinedAt: user.createdAt,
    progress: levelProgress(profile.totalXp),
    achievementsUnlocked: ctx.unlockedCodes.size,
    achievementsTotal: ACHIEVEMENTS.length,
    titles: TITLES.map((t) => ({
      code: t.code,
      name: t.name,
      hint: t.hint,
      unlocked: isTitleUnlocked(t, ctx),
      selected: (profile.titleCode ?? DEFAULT_TITLE) === t.code,
    })),
    privacy: pickPrivacy(profile),
    publicUrl: publicProfileUrl(profile.username),
    publicPath: `/u/${profile.username}`,
  };
}

/** Perfil do dono; na primeira visita processa a biblioteca existente (retroativo). */
export async function getOwnProfile(userId) {
  await syncNow(userId);
  return profileDto(userId);
}

export async function updateProfile(userId, body) {
  const input = parseOrThrow(profileUpdateSchema, body);
  await prisma.$transaction(async (tx) => {
    const profile = await ensureProfile(tx, userId);
    if (input.username && input.username !== profile.username) {
      const taken = await tx.playerProfile.findUnique({ where: { username: input.username }, select: { userId: true } });
      if (taken) {
        throw new AppError(409, 'Esse nome de usuário já está em uso', { fields: { username: 'Escolha outro nome de usuário' } });
      }
    }
    if (input.titleCode !== undefined && input.titleCode !== null) {
      const title = TITLES_BY_CODE[input.titleCode];
      const ctx = await titleContext(userId, profile.level);
      if (!title || !isTitleUnlocked(title, ctx)) {
        throw new AppError(400, 'Confira os campos destacados', {
          fields: { titleCode: 'Esse título ainda está bloqueado' },
        });
      }
    }
    await tx.playerProfile.update({ where: { userId }, data: input });
  });
  return profileDto(userId);
}

const IMAGE_FIELD = { avatar: 'avatarKey', banner: 'bannerKey' };

/** Troca avatar ou banner: novo arquivo validado por magic bytes; o antigo é apagado. */
export async function setProfileImage(userId, kind, file) {
  const field = IMAGE_FIELD[kind];
  if (!file) throw new AppError(400, 'Selecione uma imagem');
  const saved = await saveImageBuffer(file.buffer);
  let previous;
  try {
    previous = await prisma.$transaction(async (tx) => {
      const profile = await ensureProfile(tx, userId);
      await tx.playerProfile.update({ where: { userId }, data: { [field]: saved.storageKey } });
      return profile[field];
    });
  } catch (error) {
    await removeStoredFiles([saved.storageKey]);
    throw error;
  }
  if (previous) await removeStoredFiles([previous]);
  return profileDto(userId);
}

export async function removeProfileImage(userId, kind) {
  const field = IMAGE_FIELD[kind];
  const previous = await prisma.$transaction(async (tx) => {
    const profile = await ensureProfile(tx, userId);
    await tx.playerProfile.update({ where: { userId }, data: { [field]: null } });
    return profile[field];
  });
  if (previous) await removeStoredFiles([previous]);
  return profileDto(userId);
}

export async function updatePrivacy(userId, body) {
  const input = parseOrThrow(privacySchema, body);
  await prisma.$transaction(async (tx) => {
    await ensureProfile(tx, userId);
    await tx.playerProfile.update({ where: { userId }, data: input });
  });
  return profileDto(userId);
}

/** Cartões do perfil privado: coleção, jogatina, conquistas e finanças completas. */
export async function profileStats(userId) {
  const [overview, platforms, storesByCount, storesBySavings, unlocked] = await Promise.all([
    stats.overview(userId),
    stats.byPlatform(userId),
    stats.byStore(userId, { sort: 'count' }),
    stats.byStore(userId, { sort: 'savings' }),
    prisma.userAchievement.count({ where: { userId } }),
  ]);
  const lib = overview.library;
  return {
    library: {
      ...lib,
      completionPercent: lib.owned ? Math.round((lib.completed / lib.owned) * 1000) / 10 : null,
    },
    playTime: overview.playTime,
    platforms: platforms.items.length,
    achievements: { unlocked, total: ACHIEVEMENTS.length },
    finance: overview.finance,
    stores: {
      byCount: storesByCount.items.slice(0, 5),
      bySavings: storesBySavings.items.filter((s) => Number(s.savings) > 0).slice(0, 5),
    },
  };
}
