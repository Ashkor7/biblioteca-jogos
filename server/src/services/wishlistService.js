// Histórico MANUAL de preços da lista de desejos. Nada é consultado em lojas:
// todos os valores são digitados pelo usuário, com a data em que ele viu o preço.
import { Prisma } from '@prisma/client';
import { prisma } from '../db.js';
import { AppError, notFound } from '../lib/errors.js';
import { parseOrThrow, assertUuid } from '../lib/validate.js';
import { money, isoDate } from '../lib/serialize.js';
import { priceEntrySchema } from '../../../shared/schemas.js';
import { findOrCreateStore, pruneOrphans } from './lookupService.js';
import { findOwnedGame } from './gameService.js';
import { dateOnly } from './timeService.js';

const entrySelect = {
  id: true,
  price: true,
  recordedOn: true,
  note: true,
  createdAt: true,
  store: { select: { id: true, name: true } },
};

const entryToDto = (e) => ({
  id: e.id,
  price: money(e.price),
  recordedOn: isoDate(e.recordedOn),
  note: e.note,
  store: e.store,
  createdAt: e.createdAt,
});

/** O "último preço informado" do desejo passa a ser o registro mais recente do histórico. */
async function refreshLatest(tx, game) {
  if (game.ownershipStatus !== 'WISHLIST') return;
  const latest = await tx.wishlistPriceEntry.findFirst({
    where: { gameId: game.id },
    orderBy: [{ recordedOn: 'desc' }, { createdAt: 'desc' }],
  });
  await tx.game.update({
    where: { id: game.id },
    data: { currentWishPrice: latest?.price ?? null, wishPriceUpdatedAt: latest ? latest.recordedOn : null },
  });
}

export async function priceHistory(ownerId, gameId) {
  const game = await findOwnedGame(prisma, ownerId, gameId);
  const entries = await prisma.wishlistPriceEntry.findMany({
    where: { gameId: game.id },
    orderBy: [{ recordedOn: 'asc' }, { createdAt: 'asc' }],
    select: entrySelect,
  });
  const prices = entries.map((e) => e.price);
  const lowest = prices.length ? Prisma.Decimal.min(...prices) : null;
  const highest = prices.length ? Prisma.Decimal.max(...prices) : null;
  const latest = entries.at(-1) ?? null;
  const target = game.targetPrice;
  let targetState = null;
  let differenceToTarget = null;
  if (latest && target !== null) {
    const diff = latest.price.minus(target);
    differenceToTarget = diff.toFixed(2);
    targetState = diff.isNegative() ? 'BELOW' : diff.isZero() ? 'AT' : 'ABOVE';
  }
  return {
    gameId: game.id,
    targetPrice: money(target),
    referencePrice: money(game.originalPrice),
    lowest: money(lowest),
    highest: money(highest),
    latest: latest ? entryToDto(latest) : null,
    differenceToTarget,
    targetState,
    entries: entries.map(entryToDto),
    note: 'Preços registrados manualmente por você; não são consultados automaticamente nas lojas.',
  };
}

export async function addPriceEntry(ownerId, gameId, body) {
  const input = parseOrThrow(priceEntrySchema, body);
  await prisma.$transaction(async (tx) => {
    const game = await findOwnedGame(tx, ownerId, gameId);
    if (game.ownershipStatus !== 'WISHLIST') {
      throw new AppError(409, 'O histórico só recebe preços enquanto o jogo está na lista de desejos');
    }
    const store = input.store ? await findOrCreateStore(tx, input.store) : null;
    await tx.wishlistPriceEntry.create({
      data: {
        gameId: game.id,
        ownerId,
        price: input.price,
        storeId: store?.id ?? null,
        recordedOn: dateOnly(input.recordedOn),
        note: input.note,
      },
    });
    await refreshLatest(tx, game);
  });
  return priceHistory(ownerId, gameId);
}

export async function deletePriceEntry(ownerId, gameId, entryId) {
  assertUuid(entryId, 'Registro de preço');
  await prisma.$transaction(async (tx) => {
    const game = await findOwnedGame(tx, ownerId, gameId);
    const { count } = await tx.wishlistPriceEntry.deleteMany({ where: { id: entryId, gameId: game.id } });
    if (!count) throw notFound('Registro de preço');
    await refreshLatest(tx, game);
    await pruneOrphans(tx);
  });
  return priceHistory(ownerId, gameId);
}
