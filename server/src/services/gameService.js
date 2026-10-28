import { z } from 'zod';
import { prisma } from '../db.js';
import { AppError, notFound } from '../lib/errors.js';
import { parseOrThrow, assertUuid, validateGameOrThrow } from '../lib/validate.js';
import { gameInclude, gameToDto, money } from '../lib/serialize.js';
import { saveImageBuffer, removeStoredFiles } from '../lib/storage.js';
import { markPurchasedSchema } from '../../../shared/schemas.js';
import {
  findOrCreatePlatform,
  findOrCreateStore,
  findOrCreateCategories,
  pruneOrphans,
} from './lookupService.js';

const listQuerySchema = z.object({
  search: z.string().trim().max(100).optional(),
  platform: z.string().trim().max(80).optional(), // slug
  platformId: z.uuid('Plataforma inválida').optional(),
  ownership: z.enum(['OWNED', 'WISHLIST', 'ALL']).default('ALL'),
  status: z.enum(['NOT_STARTED', 'COMPLETED', 'ABANDONED']).optional(),
  media: z.enum(['PHYSICAL', 'DIGITAL']).optional(),
  categoryId: z.uuid('Categoria inválida').optional(),
  storeId: z.uuid('Loja inválida').optional(),
  needsReview: z.enum(['true', 'false']).optional(),
  sort: z
    .enum(['featured', 'recent', 'title', 'rating', 'hours', 'paid', 'wishPrice'])
    .default('featured'),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(60),
});

const SORTS = {
  featured: [{ isFeatured: 'desc' }, { createdAt: 'desc' }],
  recent: [{ createdAt: 'desc' }],
  title: [{ title: 'asc' }, { createdAt: 'desc' }],
  rating: [{ ratingStars: { sort: 'desc', nulls: 'last' } }, { title: 'asc' }],
  hours: [{ playTimeMinutes: 'desc' }, { title: 'asc' }],
  paid: [{ paidPrice: { sort: 'desc', nulls: 'last' } }, { title: 'asc' }],
  wishPrice: [{ currentWishPrice: { sort: 'asc', nulls: 'last' } }, { title: 'asc' }],
};

export async function listGames(viewerId, rawQuery) {
  const q = parseOrThrow(listQuerySchema, rawQuery, 'Filtros inválidos');
  const where = { ownerId: viewerId };
  if (q.ownership !== 'ALL') where.ownershipStatus = q.ownership;
  if (q.status) where.playStatus = q.status;
  if (q.media) where.mediaType = q.media;
  if (q.platformId) where.platformId = q.platformId;
  if (q.platform) where.platform = { slug: q.platform };
  if (q.storeId) where.storeId = q.storeId;
  if (q.categoryId) where.categories = { some: { categoryId: q.categoryId } };
  if (q.needsReview) where.needsReview = q.needsReview === 'true';
  if (q.search) {
    const contains = { contains: q.search, mode: 'insensitive' };
    where.OR = [
      { title: contains },
      { platform: { name: contains } },
      { store: { name: contains } },
      { categories: { some: { category: { name: contains } } } },
    ];
  }
  const [total, games] = await prisma.$transaction([
    prisma.game.count({ where }),
    prisma.game.findMany({
      where,
      include: gameInclude,
      orderBy: SORTS[q.sort],
      skip: (q.page - 1) * q.pageSize,
      take: q.pageSize,
    }),
  ]);
  return {
    items: games.map(gameToDto),
    total,
    page: q.page,
    pageSize: q.pageSize,
    totalPages: Math.max(1, Math.ceil(total / q.pageSize)),
  };
}

async function findOwnedGame(client, ownerId, id) {
  assertUuid(id, 'Jogo');
  const game = await client.game.findFirst({ where: { id, ownerId }, include: gameInclude });
  if (!game) throw notFound('Jogo');
  return game;
}

export async function getGame(viewerId, id) {
  return gameToDto(await findOwnedGame(prisma, viewerId, id));
}

/** Converte o registro do banco de volta para o formato de entrada (para PATCH). */
function toInput(game) {
  return {
    title: game.title,
    ownershipStatus: game.ownershipStatus,
    mediaType: game.mediaType,
    platform: game.platform.name,
    store: game.store?.name ?? null,
    originalPrice: money(game.originalPrice),
    paidPrice: money(game.paidPrice),
    currentWishPrice: money(game.currentWishPrice),
    purchasedAt: game.purchasedAt,
    playStatus: game.playStatus,
    playTimeMinutes: game.playTimeMinutes,
    ratingStars: game.ratingStars,
    reviewText: game.reviewText,
    categories: game.categories.map((gc) => gc.category.name),
    coverUrl: null,
  };
}

const EDITABLE_KEYS = [
  'title',
  'ownershipStatus',
  'mediaType',
  'platform',
  'store',
  'originalPrice',
  'paidPrice',
  'currentWishPrice',
  'purchasedAt',
  'playStatus',
  'playTimeMinutes',
  'ratingStars',
  'reviewText',
  'categories',
  'coverUrl',
];

function pickEditable(body) {
  const out = {};
  for (const key of EDITABLE_KEYS) {
    if (body && Object.prototype.hasOwnProperty.call(body, key)) out[key] = body[key];
  }
  return out;
}

function isPurchaseComplete(data) {
  if (data.ownershipStatus === 'WISHLIST') return true;
  return Boolean(data.mediaType && data.originalPrice !== null && data.paidPrice !== null && data.store);
}

/** Multipart: o JSON do jogo chega no campo "data". */
export function readGamePayload(req) {
  if (req.is('multipart/form-data')) {
    if (!req.body?.data) throw new AppError(400, 'Envie os dados do jogo no campo "data"');
    try {
      return JSON.parse(req.body.data);
    } catch {
      throw new AppError(400, 'O campo "data" não contém JSON válido');
    }
  }
  return req.body ?? {};
}

export async function createGame(ownerId, payload, coverFile) {
  const data = validateGameOrThrow(pickEditable(payload));
  const saved = coverFile ? await saveImageBuffer(coverFile.buffer) : null;
  try {
    const game = await prisma.$transaction(async (tx) => {
      const platform = await findOrCreatePlatform(tx, data.platform);
      const store = data.store ? await findOrCreateStore(tx, data.store) : null;
      const categories = await findOrCreateCategories(tx, data.categories);
      let image = null;
      if (saved) image = { ...saved, isCover: true, position: 0 };
      else if (data.coverUrl) image = { url: data.coverUrl, isCover: true, position: 0 };
      return tx.game.create({
        data: {
          ownerId,
          title: data.title,
          platformId: platform.id,
          ownershipStatus: data.ownershipStatus,
          mediaType: data.mediaType,
          originalPrice: data.originalPrice,
          paidPrice: data.paidPrice,
          currentWishPrice: data.currentWishPrice,
          wishPriceUpdatedAt: data.currentWishPrice !== null ? new Date() : null,
          storeId: store?.id ?? null,
          purchasedAt: data.purchasedAt,
          playStatus: data.playStatus,
          playTimeMinutes: data.playTimeMinutes,
          ratingStars: data.ratingStars,
          reviewText: data.reviewText,
          categories: { create: categories.map((c) => ({ categoryId: c.id })) },
          ...(image ? { images: { create: [image] } } : {}),
        },
        include: gameInclude,
      });
    });
    return gameToDto(game);
  } catch (error) {
    if (saved) await removeStoredFiles([saved.storageKey]);
    throw error;
  }
}

export async function updateGame(ownerId, id, body) {
  const changes = pickEditable(body);
  if (Object.keys(changes).length === 0) throw new AppError(400, 'Nenhum campo para atualizar');
  const game = await prisma.$transaction(async (tx) => {
    const existing = await findOwnedGame(tx, ownerId, id);
    const data = validateGameOrThrow(
      { ...toInput(existing), ...changes },
      { allowIncompletePurchase: existing.needsReview },
    );
    const platform = await findOrCreatePlatform(tx, data.platform);
    const store = data.store ? await findOrCreateStore(tx, data.store) : null;
    const categories = await findOrCreateCategories(tx, data.categories);
    const wishPriceChanged = money(existing.currentWishPrice) !== data.currentWishPrice;

    if (data.coverUrl) {
      await tx.gameImage.updateMany({ where: { gameId: id, isCover: true }, data: { isCover: false } });
      await tx.gameImage.updateMany({ where: { gameId: id }, data: { position: { increment: 1 } } });
      await tx.gameImage.create({ data: { gameId: id, url: data.coverUrl, isCover: true, position: 0 } });
    }
    await tx.gameCategory.deleteMany({ where: { gameId: id } });
    await tx.game.update({
      where: { id },
      data: {
        title: data.title,
        platformId: platform.id,
        ownershipStatus: data.ownershipStatus,
        mediaType: data.mediaType,
        originalPrice: data.originalPrice,
        paidPrice: data.paidPrice,
        currentWishPrice: data.currentWishPrice,
        wishPriceUpdatedAt: wishPriceChanged
          ? data.currentWishPrice !== null
            ? new Date()
            : null
          : existing.wishPriceUpdatedAt,
        storeId: store?.id ?? null,
        purchasedAt: data.purchasedAt,
        playStatus: data.playStatus,
        playTimeMinutes: data.playTimeMinutes,
        ratingStars: data.ratingStars,
        reviewText: data.reviewText,
        needsReview: existing.needsReview && !isPurchaseComplete(data),
        categories: { create: categories.map((c) => ({ categoryId: c.id })) },
      },
    });
    await pruneOrphans(tx);
    return tx.game.findUniqueOrThrow({ where: { id }, include: gameInclude });
  });
  return gameToDto(game);
}

export async function deleteGame(ownerId, id) {
  const keys = await prisma.$transaction(async (tx) => {
    const existing = await findOwnedGame(tx, ownerId, id);
    await tx.game.delete({ where: { id } });
    await pruneOrphans(tx);
    return existing.images.map((img) => img.storageKey).filter(Boolean);
  });
  await removeStoredFiles(keys);
}

/** Apenas um jogo em destaque por vez (comportamento herdado da versão antiga). */
export async function setFeatured(ownerId, id, isFeatured) {
  const game = await prisma.$transaction(async (tx) => {
    await findOwnedGame(tx, ownerId, id);
    if (isFeatured) {
      await tx.game.updateMany({ where: { ownerId, isFeatured: true }, data: { isFeatured: false } });
    }
    return tx.game.update({ where: { id }, data: { isFeatured }, include: gameInclude });
  });
  return gameToDto(game);
}

export async function markPurchased(ownerId, id, body) {
  const input = parseOrThrow(markPurchasedSchema, body);
  const game = await prisma.$transaction(async (tx) => {
    const existing = await findOwnedGame(tx, ownerId, id);
    if (existing.ownershipStatus !== 'WISHLIST') {
      throw new AppError(409, 'Este jogo já está na biblioteca');
    }
    const originalPrice = input.originalPrice ?? money(existing.originalPrice);
    if (originalPrice === null) {
      throw new AppError(400, 'Confira os campos destacados', {
        fields: { originalPrice: 'Informe o preço original (sem desconto)' },
      });
    }
    const store = await findOrCreateStore(tx, input.store);
    await tx.game.update({
      where: { id },
      data: {
        ownershipStatus: 'OWNED',
        mediaType: input.mediaType,
        originalPrice,
        paidPrice: input.paidPrice,
        storeId: store.id,
        purchasedAt: input.purchasedAt ?? new Date(),
        currentWishPrice: null,
        wishPriceUpdatedAt: null,
        needsReview: false,
      },
    });
    await pruneOrphans(tx);
    return tx.game.findUniqueOrThrow({ where: { id }, include: gameInclude });
  });
  return gameToDto(game);
}

export { findOwnedGame };
