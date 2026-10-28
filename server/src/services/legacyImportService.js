// Importação única dos dados da versão antiga (localStorage['jogos']).
// Não inventa valores: preço pago e loja ficam vazios e o jogo é marcado para revisão.
import { prisma } from '../db.js';
import { AppError } from '../lib/errors.js';
import { gameInclude } from '../lib/serialize.js';
import { saveImageBuffer, removeStoredFiles, dataUrlToBuffer } from '../lib/storage.js';
import { cleanDisplayName, normalizeKey, moneyToCents, centsToDecimalString, LIMITS } from '../../../shared/domain.js';
import { legacyGameSchema, externalImageUrl } from '../../../shared/schemas.js';
import { findOrCreatePlatform, findOrCreateCategories } from './lookupService.js';

const STATUS_MAP = {
  'zerado': 'COMPLETED',
  'abandonado': 'ABANDONED',
  'nao iniciado': 'NOT_STARTED',
};

export function mapLegacyGame(item) {
  const title = cleanDisplayName(item.nome).slice(0, LIMITS.titleMax);
  const platform = cleanDisplayName(item.plataforma).slice(0, LIMITS.lookupNameMax);
  const category = cleanDisplayName(item.categoria).slice(0, LIMITS.categoryMax);
  const cents = moneyToCents(item.preco === '' ? null : item.preco);
  const stars = Number(item.avaliacao);
  return {
    legacyId: item.id.slice(0, 64),
    title,
    platform: normalizeKey(platform) ? platform : 'Não informada',
    categories: normalizeKey(category) ? [category] : [],
    originalPrice: Number.isFinite(cents) ? centsToDecimalString(cents) : null,
    playStatus: STATUS_MAP[normalizeKey(item.status)] ?? 'NOT_STARTED',
    ratingStars: Number.isInteger(stars) && stars >= 1 && stars <= 5 ? stars : null,
    isFeatured: Boolean(item.destaque),
    cover: item.capa || null,
  };
}

export async function importLegacy(ownerId, body) {
  const list = Array.isArray(body) ? body : body?.games;
  if (!Array.isArray(list)) {
    throw new AppError(400, 'Envie a lista de jogos exportada (um array JSON)');
  }
  const report = { received: list.length, imported: 0, skipped: 0, failed: [], warnings: [] };
  let featuredAssigned = (await prisma.game.count({ where: { ownerId, isFeatured: true } })) > 0;

  for (const [index, raw] of list.entries()) {
    const parsed = legacyGameSchema.safeParse(raw);
    if (!parsed.success) {
      report.failed.push({ index, legacyId: raw?.id ?? null, message: 'Registro sem nome ou em formato desconhecido' });
      continue;
    }
    const game = mapLegacyGame(parsed.data);
    if (!game.title) {
      report.failed.push({ index, legacyId: game.legacyId, message: 'Registro sem nome' });
      continue;
    }
    const exists = await prisma.game.findUnique({
      where: { ownerId_legacyId: { ownerId, legacyId: game.legacyId } },
      select: { id: true },
    });
    if (exists) {
      report.skipped += 1;
      continue;
    }

    let image = null;
    if (game.cover?.startsWith('data:')) {
      try {
        const buffer = dataUrlToBuffer(game.cover);
        if (!buffer) throw new AppError(415, 'capa em formato desconhecido');
        image = await saveImageBuffer(buffer);
      } catch (error) {
        report.warnings.push({ legacyId: game.legacyId, message: `Capa ignorada: ${error.message}` });
      }
    } else if (game.cover && externalImageUrl.safeParse(game.cover).success) {
      image = { url: game.cover };
    }

    const makeFeatured = game.isFeatured && !featuredAssigned;
    try {
      await prisma.$transaction(async (tx) => {
        const platform = await findOrCreatePlatform(tx, game.platform);
        const categories = await findOrCreateCategories(tx, game.categories);
        await tx.game.create({
          data: {
            ownerId,
            legacyId: game.legacyId,
            title: game.title,
            platformId: platform.id,
            ownershipStatus: 'OWNED',
            mediaType: null,
            originalPrice: game.originalPrice,
            paidPrice: null,
            storeId: null,
            playStatus: game.playStatus,
            ratingStars: game.ratingStars,
            isFeatured: makeFeatured,
            needsReview: true,
            categories: { create: categories.map((c) => ({ categoryId: c.id })) },
            ...(image ? { images: { create: [{ ...image, isCover: true, position: 0 }] } } : {}),
          },
          include: gameInclude,
        });
      });
      if (makeFeatured) featuredAssigned = true;
      report.imported += 1;
    } catch (error) {
      if (image?.storageKey) await removeStoredFiles([image.storageKey]);
      report.failed.push({ index, legacyId: game.legacyId, message: error.message });
    }
  }
  return report;
}
