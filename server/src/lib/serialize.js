export const gameInclude = {
  platform: { select: { id: true, name: true, slug: true } },
  store: { select: { id: true, name: true } },
  categories: { include: { category: { select: { id: true, name: true } } } },
  images: { orderBy: [{ position: 'asc' }, { createdAt: 'asc' }] },
};

export const money = (value) => (value === null || value === undefined ? null : value.toFixed(2));

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
  const cover = images.find((img) => img.isCover) ?? images[0] ?? null;
  const priceDifference =
    game.originalPrice !== null && game.paidPrice !== null
      ? game.originalPrice.minus(game.paidPrice).toFixed(2)
      : null;
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
    purchasedAt: game.purchasedAt,
    playStatus: game.playStatus,
    playTimeMinutes: game.playTimeMinutes,
    ratingStars: game.ratingStars,
    reviewText: game.reviewText,
    isFeatured: game.isFeatured,
    needsReview: game.needsReview,
    categories: game.categories
      .map((gc) => gc.category)
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')),
    images,
    coverUrl: cover?.url ?? null,
    createdAt: game.createdAt,
    updatedAt: game.updatedAt,
  };
}
