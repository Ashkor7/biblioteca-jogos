import { PUBLIC_UPLOAD_PREFIX } from './storage.js';

export const gameInclude = {
  platform: { select: { id: true, name: true, slug: true } },
  store: { select: { id: true, name: true } },
  preferredStore: { select: { id: true, name: true } },
  categories: { include: { category: { select: { id: true, name: true } } } },
  images: { orderBy: [{ position: 'asc' }, { createdAt: 'asc' }] },
  // A chave estrangeira composta garante que só o dono do jogo aparece aqui.
  favorites: { select: { position: true, showOnProfile: true } },
};

export const money = (value) => (value === null || value === undefined ? null : value.toFixed(2));

/** URL pública de um arquivo salvo pelo servidor (avatar, banner). */
export const uploadUrl = (storageKey) => (storageKey ? PUBLIC_UPLOAD_PREFIX + storageKey : null);

export function coverOf(game) {
  const images = game.images ?? [];
  return (images.find((img) => img.isCover) ?? images[0])?.url ?? null;
}

/** "2026-11-09" a partir de uma coluna DATE. */
export const isoDate = (value) => (value ? value.toISOString().slice(0, 10) : null);

export function gameToDto(game) {
  const images = game.images.map((img) => ({
    id: img.id,
    url: img.url,
    isCover: img.isCover,
    position: img.position,
    altText: img.altText,
    mimeType: img.mimeType,
    sizeBytes: img.sizeBytes,
    external: img.storageKey === null,
  }));
  const priceDifference =
    game.originalPrice !== null && game.paidPrice !== null
      ? game.originalPrice.minus(game.paidPrice).toFixed(2)
      : null;
  const favorite = game.favorites?.[0] ?? null;
  return {
    id: game.id,
    title: game.title,
    ownershipStatus: game.ownershipStatus,
    mediaType: game.mediaType,
    platform: game.platform,
    store: game.store,
    originalPrice: money(game.originalPrice),
    paidPrice: money(game.paidPrice),
    priceDifference,
    currentWishPrice: money(game.currentWishPrice),
    wishPriceUpdatedAt: game.wishPriceUpdatedAt,
    targetPrice: money(game.targetPrice),
    wishPriority: game.wishPriority,
    preferredStore: game.preferredStore ?? null,
    wishNotes: game.wishNotes,
    purchasedAt: game.purchasedAt,
    playStatus: game.playStatus,
    completedAt: game.completedAt,
    playTimeMinutes: game.playTimeMinutes,
    legacyPlayMinutes: game.legacyPlayMinutes,
    sessionMinutes: game.playTimeMinutes - game.legacyPlayMinutes,
    ratingStars: game.ratingStars,
    reviewText: game.reviewText,
    isFeatured: game.isFeatured,
    isFavorite: Boolean(favorite),
    favoriteShownOnProfile: favorite?.showOnProfile ?? false,
    needsReview: game.needsReview,
    categories: game.categories
      .map((gc) => gc.category)
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')),
    images,
    coverUrl: coverOf(game),
    createdAt: game.createdAt,
    updatedAt: game.updatedAt,
  };
}

/** Seleção mínima para cartões (favoritos, coleções, perfil). */
export const gameCardSelect = {
  id: true,
  title: true,
  ownershipStatus: true,
  playStatus: true,
  ratingStars: true,
  playTimeMinutes: true,
  platform: { select: { id: true, name: true, slug: true } },
  images: { select: { url: true, isCover: true }, orderBy: [{ position: 'asc' }, { createdAt: 'asc' }] },
};

export function gameCardToDto(game) {
  return {
    id: game.id,
    title: game.title,
    ownershipStatus: game.ownershipStatus,
    playStatus: game.playStatus,
    ratingStars: game.ratingStars,
    playTimeMinutes: game.playTimeMinutes,
    platform: game.platform,
    coverUrl: coverOf(game),
  };
}

/**
 * Jogo como visitantes veem: lista de campos permitidos (allowlist). Nunca inclui
 * preços, loja, data de compra, avaliação escrita, imagens extras nem ids internos de loja.
 */
export function publicGameToDto(game, { showPlayStats }) {
  return {
    id: game.id,
    title: game.title,
    platform: { name: game.platform.name, slug: game.platform.slug },
    coverUrl: coverOf(game),
    ratingStars: game.ratingStars,
    ...(game.ownershipStatus === 'OWNED' && showPlayStats
      ? { playStatus: game.playStatus, playTimeMinutes: game.playTimeMinutes }
      : {}),
  };
}
