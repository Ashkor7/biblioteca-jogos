// Confere, sem alterar nada, que a migração v3 preservou os dados existentes.
// Uso: node scripts/verify-migration.js   (lê o DATABASE_URL do .env)
import { prisma } from '../src/db.js';

try {
  const [games] = await prisma.$queryRaw`
    SELECT count(*)::int AS total,
      count(*) FILTER (WHERE "legacyPlayMinutes" <> "playTimeMinutes")::int AS hours_mismatch,
      count(*) FILTER (WHERE "playStatus" = 'COMPLETED' AND "completedAt" IS NOT NULL)::int AS invented_dates,
      COALESCE(sum("playTimeMinutes"), 0)::int AS minutes
    FROM "Game"`;
  const sessions = await prisma.gameSession.count();
  const prices = await prisma.wishlistPriceEntry.count();
  const wishWithPrice = await prisma.game.count({ where: { ownershipStatus: 'WISHLIST', currentWishPrice: { not: null } } });
  const constraints = await prisma.$queryRaw`
    SELECT conname FROM pg_constraint WHERE conname IN ('Game_wishlist_without_purchase', 'Game_prices_non_negative')`;
  const partial = await prisma.$queryRaw`
    SELECT indexname FROM pg_indexes WHERE indexname IN ('GameImage_one_cover_per_game', 'Game_one_featured_per_owner')`;
  console.log({
    jogos: games.total,
    minutosTotais: games.minutes,
    jogosComSaldoDiferente: games.hours_mismatch,
    datasDeConclusaoInventadas: games.invented_dates,
    sessoes: sessions,
    historicoDePrecos: prices,
    desejosComPreco: wishWithPrice,
    checksDaInit: constraints.length,
    indicesParciaisDaInit: partial.length,
  });
  if (games.hours_mismatch || games.invented_dates || sessions || constraints.length !== 2 || partial.length !== 2) {
    process.exitCode = 1;
  }
} finally {
  await prisma.$disconnect();
}
