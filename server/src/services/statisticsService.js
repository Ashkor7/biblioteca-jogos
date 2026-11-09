// Agregações calculadas no PostgreSQL. Valores monetários saem como string "0.00".
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../db.js';
import { parseOrThrow } from '../lib/validate.js';

const D = (value) => new Prisma.Decimal(value ?? 0);
const int = (value) => Number(value ?? 0);

/** Economia e desconto: (original - pago) / original * 100, só se original > 0. */
function savings(originalTotal, paidTotal) {
  const original = D(originalTotal);
  const paid = D(paidTotal);
  const diff = original.minus(paid);
  return {
    originalTotal: original.toFixed(2),
    paidTotal: paid.toFixed(2),
    savings: diff.toFixed(2),
    discountPercent: original.greaterThan(0) ? Number(diff.div(original).times(100).toFixed(2)) : null,
  };
}

const overviewQuery = z.object({ platformId: z.uuid('Plataforma inválida').optional() });

export async function overview(viewerId, rawQuery = {}) {
  const { platformId } = parseOrThrow(overviewQuery, rawQuery, 'Filtros inválidos');
  const platformFilter = platformId ? Prisma.sql`AND "platformId" = ${platformId}::uuid` : Prisma.empty;
  const [row] = await prisma.$queryRaw`
    SELECT
      count(*) FILTER (WHERE "ownershipStatus" = 'OWNED') AS owned,
      count(*) FILTER (WHERE "ownershipStatus" = 'OWNED' AND "playStatus" = 'COMPLETED') AS completed,
      count(*) FILTER (WHERE "ownershipStatus" = 'OWNED' AND "playStatus" = 'NOT_STARTED') AS not_started,
      count(*) FILTER (WHERE "ownershipStatus" = 'OWNED' AND "playStatus" = 'PLAYING') AS playing,
      count(*) FILTER (WHERE "ownershipStatus" = 'OWNED' AND "playStatus" = 'ABANDONED') AS abandoned,
      count(*) FILTER (WHERE "ownershipStatus" = 'OWNED' AND "mediaType" = 'PHYSICAL') AS physical,
      count(*) FILTER (WHERE "ownershipStatus" = 'OWNED' AND "mediaType" = 'DIGITAL') AS digital,
      count(*) FILTER (WHERE "ownershipStatus" = 'WISHLIST') AS wishlist,
      count(*) FILTER (WHERE "ownershipStatus" = 'WISHLIST' AND "currentWishPrice" IS NULL) AS wishlist_without_price,
      COALESCE(sum("currentWishPrice") FILTER (WHERE "ownershipStatus" = 'WISHLIST'), 0) AS wishlist_value,
      count(*) FILTER (WHERE "ownershipStatus" = 'OWNED' AND ("originalPrice" IS NULL OR "paidPrice" IS NULL)) AS owned_pending_prices,
      COALESCE(sum("originalPrice") FILTER (WHERE "ownershipStatus" = 'OWNED' AND "originalPrice" IS NOT NULL AND "paidPrice" IS NOT NULL), 0) AS original_total,
      COALESCE(sum("paidPrice") FILTER (WHERE "ownershipStatus" = 'OWNED' AND "originalPrice" IS NOT NULL AND "paidPrice" IS NOT NULL), 0) AS paid_total,
      count(*) FILTER (WHERE "ownershipStatus" = 'OWNED' AND "paidPrice" > "originalPrice") AS overpaid,
      COALESCE(sum("playTimeMinutes") FILTER (WHERE "ownershipStatus" = 'OWNED'), 0) AS minutes
    FROM "Game"
    WHERE "ownerId" = ${viewerId}::uuid ${platformFilter}`;
  const wishlistCount = int(row.wishlist);
  const withoutPrice = int(row.wishlist_without_price);
  return {
    library: {
      owned: int(row.owned),
      completed: int(row.completed),
      notStarted: int(row.not_started),
      playing: int(row.playing),
      abandoned: int(row.abandoned),
      physical: int(row.physical),
      digital: int(row.digital),
    },
    wishlist: {
      count: wishlistCount,
      currentValue: D(row.wishlist_value).toFixed(2),
      withoutPrice,
      isPartial: withoutPrice > 0,
    },
    finance: {
      ...savings(row.original_total, row.paid_total),
      overpaidGames: int(row.overpaid),
      pendingPriceReview: int(row.owned_pending_prices),
    },
    playTime: { totalMinutes: int(row.minutes) },
  };
}

export async function byPlatform(viewerId) {
  const rows = await prisma.$queryRaw`
    SELECT p.id, p.name, p.slug,
      count(g.id) AS games,
      count(g.id) FILTER (WHERE g."playStatus" = 'COMPLETED') AS completed,
      COALESCE(sum(g."playTimeMinutes"), 0) AS minutes,
      COALESCE(sum(g."paidPrice"), 0) AS paid_total
    FROM "Platform" p
    JOIN "Game" g ON g."platformId" = p.id
    WHERE g."ownerId" = ${viewerId}::uuid AND g."ownershipStatus" = 'OWNED'
    GROUP BY p.id, p.name, p.slug
    ORDER BY games DESC, p.name ASC`;
  return {
    items: rows.map((r) => ({
      id: r.id,
      name: r.name,
      slug: r.slug,
      games: int(r.games),
      completed: int(r.completed),
      minutes: int(r.minutes),
      paidTotal: D(r.paid_total).toFixed(2),
    })),
  };
}

const storeQuery = z.object({ sort: z.enum(['count', 'savings', 'percent']).default('count') });

export async function byStore(viewerId, rawQuery = {}) {
  const { sort } = parseOrThrow(storeQuery, rawQuery, 'Filtros inválidos');
  const rows = await prisma.$queryRaw`
    SELECT s.id, s.name,
      count(g.id) AS games,
      count(g.id) FILTER (WHERE g."originalPrice" IS NOT NULL AND g."paidPrice" IS NOT NULL) AS priced_games,
      COALESCE(sum(g."originalPrice") FILTER (WHERE g."originalPrice" IS NOT NULL AND g."paidPrice" IS NOT NULL), 0) AS original_total,
      COALESCE(sum(g."paidPrice") FILTER (WHERE g."originalPrice" IS NOT NULL AND g."paidPrice" IS NOT NULL), 0) AS paid_total,
      count(g.id) FILTER (WHERE g."paidPrice" > g."originalPrice") AS overpaid
    FROM "Store" s
    JOIN "Game" g ON g."storeId" = s.id
    WHERE g."ownerId" = ${viewerId}::uuid AND g."ownershipStatus" = 'OWNED'
    GROUP BY s.id, s.name`;
  const [missing] = await prisma.$queryRaw`
    SELECT count(*) AS n FROM "Game"
    WHERE "ownerId" = ${viewerId}::uuid AND "ownershipStatus" = 'OWNED' AND "storeId" IS NULL`;
  const items = rows.map((r) => ({
    id: r.id,
    name: r.name,
    games: int(r.games),
    pricedGames: int(r.priced_games),
    overpaidGames: int(r.overpaid),
    ...savings(r.original_total, r.paid_total),
  }));
  const comparators = {
    count: (a, b) => b.games - a.games || Number(b.savings) - Number(a.savings),
    savings: (a, b) => D(b.savings).comparedTo(D(a.savings)) || b.games - a.games,
    percent: (a, b) => (b.discountPercent ?? -Infinity) - (a.discountPercent ?? -Infinity) || b.games - a.games,
  };
  items.sort((a, b) => comparators[sort](a, b) || a.name.localeCompare(b.name, 'pt-BR'));
  return { sort, items, gamesWithoutStore: int(missing.n) };
}

export async function byCategory(viewerId) {
  const rows = await prisma.$queryRaw`
    SELECT c.id, c.name, count(g.id) AS games, COALESCE(sum(g."playTimeMinutes"), 0) AS minutes
    FROM "Category" c
    JOIN "GameCategory" gc ON gc."categoryId" = c.id
    JOIN "Game" g ON g.id = gc."gameId"
    WHERE g."ownerId" = ${viewerId}::uuid AND g."ownershipStatus" = 'OWNED'
    GROUP BY c.id, c.name
    ORDER BY minutes DESC, c.name ASC`;
  const [totals] = await prisma.$queryRaw`
    SELECT
      COALESCE(sum(g."playTimeMinutes"), 0) AS total_minutes,
      count(*) FILTER (WHERE NOT EXISTS (SELECT 1 FROM "GameCategory" gc WHERE gc."gameId" = g.id)) AS uncategorized_games,
      COALESCE(sum(g."playTimeMinutes") FILTER (WHERE NOT EXISTS (SELECT 1 FROM "GameCategory" gc WHERE gc."gameId" = g.id)), 0) AS uncategorized_minutes
    FROM "Game" g
    WHERE g."ownerId" = ${viewerId}::uuid AND g."ownershipStatus" = 'OWNED'`;
  return {
    items: rows.map((r) => ({ id: r.id, name: r.name, games: int(r.games), minutes: int(r.minutes) })),
    totalMinutes: int(totals.total_minutes),
    uncategorized: { games: int(totals.uncategorized_games), minutes: int(totals.uncategorized_minutes) },
    note: 'Um jogo com várias categorias soma suas horas em cada uma delas; por isso a soma por categoria pode passar do total geral.',
  };
}

// ---------------------------------------------------------------------------
// Dashboard financeiro 2.0 — mesma regra da visão geral: só jogos ADQUIRIDOS com
// preço original E pago entram nas somas. Compras acima da referência entram com
// economia negativa (reduzem o total, não são ignoradas). Sem data = "Sem data".
// ---------------------------------------------------------------------------

const PRICED = Prisma.sql`g."originalPrice" IS NOT NULL AND g."paidPrice" IS NOT NULL`;

const financeQuery = z
  .object({
    year: z.coerce.number().int().min(1970).max(2200).optional(),
    month: z.coerce.number().int().min(1).max(12).optional(),
    storeId: z.uuid('Loja inválida').optional(),
    platformId: z.uuid('Plataforma inválida').optional(),
  })
  .refine((q) => !q.month || q.year, { path: ['month'], message: 'Escolha o ano para filtrar por mês' });

function moneyRow(r) {
  return {
    purchases: int(r.purchases),
    pricedPurchases: int(r.priced),
    ...savings(r.original_total, r.paid_total),
  };
}

export async function finance(viewerId, rawQuery = {}) {
  const q = parseOrThrow(financeQuery, rawQuery, 'Filtros inválidos');
  const scope = Prisma.sql`g."ownerId" = ${viewerId}::uuid AND g."ownershipStatus" = 'OWNED'
    ${q.storeId ? Prisma.sql`AND g."storeId" = ${q.storeId}::uuid` : Prisma.empty}
    ${q.platformId ? Prisma.sql`AND g."platformId" = ${q.platformId}::uuid` : Prisma.empty}`;
  const period = q.year
    ? Prisma.sql`AND g."purchasedAt" IS NOT NULL AND extract(year FROM g."purchasedAt") = ${q.year}
        ${q.month ? Prisma.sql`AND extract(month FROM g."purchasedAt") = ${q.month}` : Prisma.empty}`
    : Prisma.empty;
  const sums = Prisma.sql`
    count(*) AS purchases,
    count(*) FILTER (WHERE ${PRICED}) AS priced,
    COALESCE(sum(g."originalPrice") FILTER (WHERE ${PRICED}), 0) AS original_total,
    COALESCE(sum(g."paidPrice") FILTER (WHERE ${PRICED}), 0) AS paid_total`;

  const [totals] = await prisma.$queryRaw`
    SELECT ${sums},
      count(*) FILTER (WHERE ${PRICED} AND g."paidPrice" > g."originalPrice") AS overpaid,
      count(*) FILTER (WHERE NOT (${PRICED})) AS incomplete,
      count(*) FILTER (WHERE g."purchasedAt" IS NULL) AS undated
    FROM "Game" g WHERE ${scope} ${period}`;
  const monthly = await prisma.$queryRaw`
    SELECT to_char(g."purchasedAt", 'YYYY-MM') AS period, ${sums}
    FROM "Game" g WHERE ${scope} ${period} AND g."purchasedAt" IS NOT NULL
    GROUP BY 1 ORDER BY 1`;
  const yearly = await prisma.$queryRaw`
    SELECT to_char(g."purchasedAt", 'YYYY') AS period, ${sums}
    FROM "Game" g WHERE ${scope} ${period} AND g."purchasedAt" IS NOT NULL
    GROUP BY 1 ORDER BY 1`;
  const [undated] = q.year
    ? [null]
    : await prisma.$queryRaw`SELECT ${sums} FROM "Game" g WHERE ${scope} AND g."purchasedAt" IS NULL`;
  const stores = await prisma.$queryRaw`
    SELECT s.id, s.name, ${sums}
    FROM "Game" g JOIN "Store" s ON s.id = g."storeId"
    WHERE ${scope} ${period} GROUP BY s.id, s.name`;
  const platforms = await prisma.$queryRaw`
    SELECT p.id, p.name, p.slug, ${sums}
    FROM "Game" g JOIN "Platform" p ON p.id = g."platformId"
    WHERE ${scope} ${period} GROUP BY p.id, p.name, p.slug`;
  const top = await prisma.$queryRaw`
    SELECT g.id, g.title, p.name AS platform, s.name AS store, g."purchasedAt",
      g."originalPrice" AS original, g."paidPrice" AS paid, (g."originalPrice" - g."paidPrice") AS saved
    FROM "Game" g JOIN "Platform" p ON p.id = g."platformId" LEFT JOIN "Store" s ON s.id = g."storeId"
    WHERE ${scope} ${period} AND ${PRICED} AND g."originalPrice" > g."paidPrice"
    ORDER BY saved DESC, g.title ASC LIMIT 10`;

  const total = moneyRow(totals);
  const paid = D(total.paidTotal);
  let running = D(0);
  const monthlyRows = monthly.map((r) => {
    const row = { period: r.period, ...moneyRow(r) };
    running = running.plus(row.paidTotal);
    return { ...row, cumulativePaid: running.toFixed(2) };
  });
  const byMoney = (a, b) => D(b.paidTotal).comparedTo(D(a.paidTotal)) || b.purchases - a.purchases;

  return {
    filters: q,
    totals: {
      ...total,
      // Desconto médio ponderado = economia total / valor original total
      weightedDiscountPercent: total.discountPercent,
      averagePaid: total.pricedPurchases ? paid.div(total.pricedPurchases).toFixed(2) : null,
      overpaidGames: int(totals.overpaid),
      incompleteGames: int(totals.incomplete),
      undatedPurchases: int(totals.undated),
    },
    monthly: monthlyRows,
    yearly: yearly.map((r) => ({ period: r.period, ...moneyRow(r) })),
    undated: undated ? moneyRow(undated) : null,
    stores: stores.map((r) => ({ id: r.id, name: r.name, ...moneyRow(r) })).sort(byMoney),
    platforms: platforms.map((r) => ({ id: r.id, name: r.name, slug: r.slug, ...moneyRow(r) })).sort(byMoney),
    topSavings: top.map((r) => ({
      id: r.id,
      title: r.title,
      platform: r.platform,
      store: r.store,
      purchasedAt: r.purchasedAt,
      originalPrice: D(r.original).toFixed(2),
      paidPrice: D(r.paid).toFixed(2),
      savings: D(r.saved).toFixed(2),
      discountPercent: Number(D(r.saved).div(D(r.original)).times(100).toFixed(2)),
    })),
    notes: [
      'Valor original = soma dos preços de referência informados (sem desconto). Não é o valor de mercado atual da coleção.',
      'Só entram nas somas jogos adquiridos com preço original e pago. Itens da lista de desejos nunca contam como compra.',
      'Compras sem data aparecem em "Sem data" e ficam fora da linha do tempo.',
    ],
  };
}
