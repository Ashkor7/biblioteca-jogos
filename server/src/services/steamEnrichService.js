// Aplica os dados da loja a um jogo. Por padrão só preenche campos VAZIOS; sobrescrever
// é uma escolha explícita (botão "Completar com dados da Steam" + confirmação).
// Usado pelo job em segundo plano e pela rota POST /api/games/:id/steam-fill.
import { config } from '../config.js';
import { downloadSteamImage, isAllowedSteamImageUrl } from '../lib/remoteImage.js';
import { removeStoredFiles } from '../lib/storage.js';
import { LIMITS, normalizeKey } from '../../../shared/domain.js';
import { findOrCreateCategories } from './lookupService.js';

/** Baixa uma imagem; se falhar, guarda a URL https da Steam como imagem externa. */
async function fetchImage(url) {
  try {
    return { ...(await downloadSteamImage(url)), downloaded: true };
  } catch {
    return isAllowedSteamImageUrl(url) ? { url, downloaded: false } : null;
  }
}

/**
 * Baixa capa e screenshots ANTES da transação (rede fora do lock do banco).
 * @returns {Promise<Array<{ url: string, storageKey?: string, mimeType?: string, sizeBytes?: number, cover: boolean }>>}
 */
export async function collectSteamImages(game, data, { screenshots = 0, overwrite = false } = {}) {
  if (!data) return [];
  const images = game.images ?? [];
  let room = config.MAX_IMAGES_PER_GAME - images.length;
  const known = new Set(images.map((img) => img.url));
  const result = [];
  const hasCover = images.some((img) => img.isCover);
  if (data.headerImage && room > 0 && (!hasCover || overwrite) && !known.has(data.headerImage)) {
    const image = await fetchImage(data.headerImage);
    if (image) {
      result.push({ ...image, cover: true });
      room -= 1;
    }
  }
  for (const url of data.screenshots.slice(0, Math.max(0, Math.min(screenshots, room)))) {
    if (known.has(url)) continue;
    const image = await fetchImage(url);
    if (image) result.push({ ...image, cover: false });
  }
  return result;
}

export async function discardImages(images) {
  await removeStoredFiles(images.map((img) => img.storageKey).filter(Boolean));
}

const empty = (v) => v === null || v === undefined || v === '';

/**
 * Grava os dados no jogo dentro da transação recebida.
 * @param game registro com images e categories (relido dentro da transação)
 * @returns {{ filled: string[], unused: object[] }} campos preenchidos e imagens que não couberam (apagar)
 */
export async function applySteamData(tx, game, data, { overwrite = false, genresAsCategories = true, images = [], achievements } = {}) {
  const update = { steamSyncedAt: new Date() };
  const filled = [];
  let unused = [];
  if (data) {
    for (const field of ['description', 'developer', 'publisher', 'metacriticScore']) {
      if (!empty(data[field]) && (overwrite || empty(game[field]))) {
        update[field] = data[field];
        filled.push(field);
      }
    }
    const hasRelease = !empty(data.releaseDate) || !empty(data.releaseDateText);
    if (hasRelease && (overwrite || (empty(game.releaseDate) && empty(game.releaseDateText)))) {
      update.releaseDate = data.releaseDate ? new Date(`${data.releaseDate}T00:00:00.000Z`) : null;
      update.releaseDateText = data.releaseDate ? null : data.releaseDateText;
      filled.push('releaseDate');
    }
    const current = (game.categories ?? []).map((gc) => gc.category.name);
    if (genresAsCategories && data.genres.length && (overwrite || current.length === 0)) {
      // Sobrescrever junta os gêneros às categorias do usuário (não apaga as dele).
      const merged = new Map(current.map((n) => [normalizeKey(n), n]));
      for (const g of data.genres) if (!merged.has(normalizeKey(g))) merged.set(normalizeKey(g), g);
      const names = [...merged.values()].slice(0, LIMITS.categoriesPerGame);
      if (names.length > current.length) {
        const categories = await findOrCreateCategories(tx, names);
        await tx.gameCategory.deleteMany({ where: { gameId: game.id } });
        await tx.gameCategory.createMany({ data: categories.map((c) => ({ gameId: game.id, categoryId: c.id })), skipDuplicates: true });
        filled.push('categories');
      }
    }
  }
  if (achievements) {
    update.steamAchievementsUnlocked = Math.min(achievements.unlocked, achievements.total);
    update.steamAchievementsTotal = achievements.total;
    filled.push('achievements');
  }
  if (images.length) {
    const count = await tx.gameImage.count({ where: { gameId: game.id } });
    const usable = images.slice(0, Math.max(0, config.MAX_IMAGES_PER_GAME - count));
    unused = images.slice(usable.length);
    const cover = usable.find((img) => img.cover);
    if (cover) {
      await tx.gameImage.updateMany({ where: { gameId: game.id, isCover: true }, data: { isCover: false } });
      await tx.gameImage.updateMany({ where: { gameId: game.id }, data: { position: { increment: 1 } } });
    }
    const last = await tx.gameImage.aggregate({ where: { gameId: game.id }, _max: { position: true } });
    let position = (last._max.position ?? -1) + 1;
    for (const img of usable) {
      await tx.gameImage.create({
        data: {
          gameId: game.id,
          url: img.url,
          storageKey: img.storageKey ?? null,
          mimeType: img.mimeType ?? null,
          sizeBytes: img.sizeBytes ?? null,
          altText: img.cover ? `Capa de ${game.title}` : `Imagem de ${game.title}`,
          isCover: img === cover,
          position: img === cover ? 0 : position++,
        },
      });
    }
    if (usable.length) filled.push('images');
  }
  await tx.game.update({ where: { id: game.id }, data: update });
  return { filled, unused };
}
