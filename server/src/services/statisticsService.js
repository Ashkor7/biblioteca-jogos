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
