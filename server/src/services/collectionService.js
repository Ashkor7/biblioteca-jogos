// Coleções personalizadas. Excluir uma coleção remove só os vínculos — nunca os jogos.
// A chave estrangeira composta (gameId, ownerId) impede colocar jogo de outra pessoa.
import { prisma } from '../db.js';
import { AppError, notFound } from '../lib/errors.js';
import { parseOrThrow, assertUuid } from '../lib/validate.js';
import { gameCardSelect, gameCardToDto, coverOf } from '../lib/serialize.js';
import { normalizeKey } from '../../../shared/domain.js';
import {
  collectionSchema,
  collectionPatchSchema,
  collectionItemsSchema,
} from '../../../shared/schemas.js';
import { recordActivity } from './activityService.js';
import { beginProgress, syncProgress } from './progressionService.js';

const PREVIEW = 4;

const collectionSelect = {
  id: true,
  name: true,
  description: true,
  isPublic: true,
  coverGameId: true,
  createdAt: true,
  updatedAt: true,
  coverGame: { select: { images: { select: { url: true, isCover: true }, orderBy: { position: 'asc' } } } },
  _count: { select: { items: true } },
  items: {
    orderBy: [{ position: 'asc' }, { addedAt: 'asc' }],
    take: PREVIEW,
    select: { game: { select: { id: true, title: true, images: { select: { url: true, isCover: true }, orderBy: { position: 'asc' } } } } },
  },
};

export function collectionToDto(c) {
  const previews = c.items.map((i) => ({ id: i.game.id, title: i.game.title, coverUrl: coverOf(i.game) }));
  return {
    id: c.id,
    name: c.name,
    description: c.description,
    isPublic: c.isPublic,
    coverGameId: c.coverGameId,
    coverUrl: (c.coverGame && coverOf(c.coverGame)) ?? previews.find((p) => p.coverUrl)?.coverUrl ?? null,
    gameCount: c._count.items,
    previews,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
  };
}

function nameConflict(name) {
  return new AppError(409, `Você já tem uma coleção chamada "${name}"`, {
    fields: { name: 'Escolha outro nome' },
  });
}

async function findCollection(client, ownerId, id) {
  assertUuid(id, 'Coleção');
  const collection = await client.gameCollection.findFirst({ where: { id, ownerId }, select: collectionSelect });
  if (!collection) throw notFound('Coleção');
  return collection;
}

async function assertCoverInCollection(tx, collectionId, coverGameId) {
  if (!coverGameId) return;
  const inside = await tx.gameCollectionItem.findUnique({
    where: { collectionId_gameId: { collectionId, gameId: coverGameId } },
  });
  if (!inside) {
    throw new AppError(400, 'Confira os campos destacados', {
      fields: { coverGameId: 'A capa precisa ser de um jogo que está na coleção' },
    });
  }
}

export async function listCollections(ownerId) {
  const rows = await prisma.gameCollection.findMany({
    where: { ownerId },
    select: collectionSelect,
    orderBy: [{ updatedAt: 'desc' }],
  });
  return { items: rows.map(collectionToDto) };
}

export async function createCollection(ownerId, body) {
  const input = parseOrThrow(collectionSchema, body);
  const normalizedName = normalizeKey(input.name);
  return prisma.$transaction(async (tx) => {
    await beginProgress(tx, ownerId);
    const clash = await tx.gameCollection.findUnique({
      where: { ownerId_normalizedName: { ownerId, normalizedName } },
      select: { id: true },
    });
    if (clash) throw nameConflict(input.name);
    const created = await tx.gameCollection.create({
      data: { ownerId, name: input.name, normalizedName, description: input.description, isPublic: input.isPublic },
      select: { id: true, name: true },
    });
    await recordActivity(tx, ownerId, {
      type: 'COLLECTION_CREATED',
      dedupeKey: `collection:${created.id}`,
      entityId: created.id,
      data: { name: created.name },
    });
    await syncProgress(tx, ownerId);
    return collectionToDto(await findCollection(tx, ownerId, created.id));
  });
}

export async function getCollection(ownerId, id) {
  const collection = await findCollection(prisma, ownerId, id);
  const items = await prisma.gameCollectionItem.findMany({
    where: { collectionId: id },
    orderBy: [{ position: 'asc' }, { addedAt: 'asc' }],
    select: { position: true, addedAt: true, game: { select: gameCardSelect } },
  });
  return {
    ...collectionToDto(collection),
    items: items.map((i) => ({ ...gameCardToDto(i.game), position: i.position, addedAt: i.addedAt })),
  };
}

export async function updateCollection(ownerId, id, body) {
  const input = parseOrThrow(collectionPatchSchema, body);
  return prisma.$transaction(async (tx) => {
    await findCollection(tx, ownerId, id);
    const data = {};
    if (input.name !== undefined) {
      const normalizedName = normalizeKey(input.name);
      const clash = await tx.gameCollection.findUnique({
        where: { ownerId_normalizedName: { ownerId, normalizedName } },
        select: { id: true },
      });
      if (clash && clash.id !== id) throw nameConflict(input.name);
      Object.assign(data, { name: input.name, normalizedName });
    }
    if (input.description !== undefined) data.description = input.description;
    if (input.isPublic !== undefined) data.isPublic = input.isPublic;
    if (input.coverGameId !== undefined) {
      await assertCoverInCollection(tx, id, input.coverGameId);
      data.coverGameId = input.coverGameId;
    }
    await tx.gameCollection.update({ where: { id }, data });
    return collectionToDto(await findCollection(tx, ownerId, id));
  });
}

export async function deleteCollection(ownerId, id) {
  await prisma.$transaction(async (tx) => {
    await findCollection(tx, ownerId, id);
    // ON DELETE CASCADE remove os vínculos; a tabela Game não é tocada.
    await tx.gameCollection.delete({ where: { id } });
  });
}

/** Valida que todos os jogos existem e pertencem ao dono (resposta não revela jogos alheios). */
async function assertOwnGames(tx, ownerId, gameIds) {
  const found = await tx.game.findMany({ where: { id: { in: gameIds }, ownerId }, select: { id: true } });
  if (found.length !== new Set(gameIds).size) {
    throw new AppError(400, 'Confira os campos destacados', {
      fields: { gameIds: 'Um ou mais jogos não existem na sua biblioteca' },
    });
  }
}

export async function addItems(ownerId, id, body) {
  const { gameIds } = parseOrThrow(collectionItemsSchema, body);
  await prisma.$transaction(async (tx) => {
    await findCollection(tx, ownerId, id);
    await assertOwnGames(tx, ownerId, gameIds);
    const last = await tx.gameCollectionItem.aggregate({ where: { collectionId: id }, _max: { position: true } });
    let position = (last._max.position ?? -1) + 1;
    await tx.gameCollectionItem.createMany({
      data: [...new Set(gameIds)].map((gameId) => ({ collectionId: id, gameId, ownerId, position: position++ })),
      skipDuplicates: true,
    });
    await tx.gameCollection.update({ where: { id }, data: { updatedAt: new Date() } });
  });
  return getCollection(ownerId, id);
}

export async function removeItem(ownerId, id, gameId) {
  assertUuid(gameId, 'Jogo');
  await prisma.$transaction(async (tx) => {
    const collection = await findCollection(tx, ownerId, id);
    const { count } = await tx.gameCollectionItem.deleteMany({ where: { collectionId: id, gameId } });
    if (!count) throw notFound('Jogo na coleção');
    await tx.gameCollection.update({
      where: { id },
      data: { updatedAt: new Date(), ...(collection.coverGameId === gameId ? { coverGameId: null } : {}) },
    });
  });
  return getCollection(ownerId, id);
}

export async function reorderItems(ownerId, id, body) {
  const { gameIds } = parseOrThrow(collectionItemsSchema, body);
  await prisma.$transaction(async (tx) => {
    await findCollection(tx, ownerId, id);
    const current = await tx.gameCollectionItem.findMany({ where: { collectionId: id }, select: { gameId: true } });
    const set = new Set(current.map((c) => c.gameId));
    const unique = new Set(gameIds);
    if (unique.size !== gameIds.length || unique.size !== set.size || gameIds.some((g) => !set.has(g))) {
      throw new AppError(400, 'A nova ordem precisa conter todos os jogos da coleção, uma vez cada');
    }
    for (const [position, gameId] of gameIds.entries()) {
      await tx.gameCollectionItem.update({ where: { collectionId_gameId: { collectionId: id, gameId } }, data: { position } });
    }
  });
  return getCollection(ownerId, id);
}

/** Coleções em que um jogo está (para a página de detalhes). */
export async function collectionsOfGame(ownerId, gameId) {
  assertUuid(gameId, 'Jogo');
  const rows = await prisma.gameCollectionItem.findMany({
    where: { gameId, ownerId },
    select: { collection: { select: { id: true, name: true, isPublic: true } } },
  });
  return { items: rows.map((r) => r.collection) };
}
