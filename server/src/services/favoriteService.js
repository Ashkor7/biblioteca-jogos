// Favoritos múltiplos e ordenados. Não mexe em Game.isFeatured (o destaque único continua
// existindo). Jogos excluídos somem daqui sozinhos (ON DELETE CASCADE).
import { prisma } from '../db.js';
import { AppError, notFound } from '../lib/errors.js';
import { parseOrThrow, assertUuid } from '../lib/validate.js';
import { gameCardSelect, gameCardToDto } from '../lib/serialize.js';
import { favoriteAddSchema, favoritePatchSchema, favoritesOrderSchema } from '../../../shared/schemas.js';

export async function listFavorites(ownerId, { onlyShown = false } = {}) {
  const rows = await prisma.favoriteGame.findMany({
    where: { ownerId, ...(onlyShown ? { showOnProfile: true } : {}) },
    orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
    select: { position: true, showOnProfile: true, game: { select: gameCardSelect } },
  });
  return {
    items: rows.map((r) => ({ ...gameCardToDto(r.game), position: r.position, showOnProfile: r.showOnProfile })),
  };
}

export async function addFavorite(ownerId, body) {
  const { gameId, showOnProfile } = parseOrThrow(favoriteAddSchema, body);
  await prisma.$transaction(async (tx) => {
    const game = await tx.game.findFirst({ where: { id: gameId, ownerId }, select: { id: true } });
    if (!game) throw notFound('Jogo');
    const last = await tx.favoriteGame.aggregate({ where: { ownerId }, _max: { position: true } });
    await tx.favoriteGame.createMany({
      data: [{ ownerId, gameId, showOnProfile, position: (last._max.position ?? -1) + 1 }],
      skipDuplicates: true,
    });
  });
  return listFavorites(ownerId);
}

export async function updateFavorite(ownerId, gameId, body) {
  assertUuid(gameId, 'Jogo');
  const { showOnProfile } = parseOrThrow(favoritePatchSchema, body);
  const { count } = await prisma.favoriteGame.updateMany({ where: { ownerId, gameId }, data: { showOnProfile } });
  if (!count) throw notFound('Favorito');
  return listFavorites(ownerId);
}

export async function removeFavorite(ownerId, gameId) {
  assertUuid(gameId, 'Jogo');
  const { count } = await prisma.favoriteGame.deleteMany({ where: { ownerId, gameId } });
  if (!count) throw notFound('Favorito');
  return listFavorites(ownerId);
}

export async function reorderFavorites(ownerId, body) {
  const { gameIds } = parseOrThrow(favoritesOrderSchema, body);
  await prisma.$transaction(async (tx) => {
    const current = await tx.favoriteGame.findMany({ where: { ownerId }, select: { gameId: true } });
    const set = new Set(current.map((c) => c.gameId));
    const unique = new Set(gameIds);
    if (unique.size !== gameIds.length || unique.size !== set.size || gameIds.some((g) => !set.has(g))) {
      throw new AppError(400, 'A nova ordem precisa conter todos os favoritos, uma vez cada');
    }
    for (const [position, gameId] of gameIds.entries()) {
      await tx.favoriteGame.update({ where: { ownerId_gameId: { ownerId, gameId } }, data: { position } });
    }
  });
  return listFavorites(ownerId);
}
