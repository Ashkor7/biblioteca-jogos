// Dados da loja (appdetails) normalizados e em cache compartilhado (SteamAppCache).
// Texto externo é dado não confiável: tudo passa por sanitizeExternalText e pelo Zod.
import { prisma } from '../db.js';
import { config } from '../config.js';
import { AppError } from '../lib/errors.js';
import { isAllowedSteamImageUrl } from '../lib/remoteImage.js';
import { LIMITS, normalizeKey } from '../../../shared/domain.js';
import { steamAppDetailsSchema } from '../../../shared/schemas.js';
import { cleanSteamTitle, joinNames, parseSteamReleaseDate, sanitizeExternalText } from '../../../shared/steam.js';
import { callSteam } from './steamAccountService.js';

const httpsOrNull = (value, max = 2048) =>
  typeof value === 'string' && value.startsWith('https://') && value.length <= max && URL.canParse(value) ? value : null;

/** Resposta bruta da loja → formato do cache (validado). */
export function normalizeAppDetails(raw, appId) {
  const genres = new Map();
  for (const g of Array.isArray(raw?.genres) ? raw.genres : []) {
    const name = sanitizeExternalText(g?.description, LIMITS.categoryMax);
    const key = normalizeKey(name);
    if (key && !genres.has(key)) genres.set(key, name);
  }
  const release = parseSteamReleaseDate(raw?.release_date?.date);
  const score = raw?.metacritic?.score;
  const header = isAllowedSteamImageUrl(raw?.header_image) ? raw.header_image : null;
  const result = steamAppDetailsSchema.safeParse({
    appId,
    type: typeof raw?.type === 'string' ? raw.type.toLowerCase().slice(0, 30) : null,
    name: cleanSteamTitle(raw?.name) || null,
    description: sanitizeExternalText(raw?.short_description, LIMITS.descriptionMax),
    headerImage: header && header.length <= 2048 ? header : null,
    screenshots: (Array.isArray(raw?.screenshots) ? raw.screenshots : [])
      .map((s) => s?.path_full)
      .filter((u) => isAllowedSteamImageUrl(u) && u.length <= 2048)
      .slice(0, 20),
    genres: [...genres.values()].slice(0, LIMITS.categoriesPerGame),
    developer: joinNames(raw?.developers, LIMITS.companyMax),
    publisher: joinNames(raw?.publishers, LIMITS.companyMax),
    releaseDate: release.date,
    // O texto só é guardado quando a data não é exata ("Em breve", "2027").
    releaseDateText: release.date ? null : release.text,
    metacriticScore: Number.isInteger(score) && score >= 0 && score <= 100 ? score : null,
    website: httpsOrNull(raw?.website, LIMITS.websiteMax),
  });
  if (!result.success) throw new AppError(502, 'A Steam enviou dados do jogo em formato inesperado');
  return result.data;
}

const isFresh = (row) => row.fetchedAt.getTime() > Date.now() - config.STEAM_CACHE_DAYS * 86_400_000;

/** Tipos já conhecidos (para a prévia), sem chamar a loja. */
export async function cachedTypes(appIds) {
  if (!appIds.length) return new Map();
  const rows = await prisma.steamAppCache.findMany({
    where: { appId: { in: appIds }, found: true, type: { not: null } },
    select: { appId: true, type: true },
  });
  return new Map(rows.map((r) => [r.appId, r.type]));
}

/**
 * Dados do app: do cache quando estiver válido; senão consulta a loja e guarda.
 * Retorna null quando a loja não tem página para o app.
 */
export async function getAppData(appId, { refresh = false } = {}) {
  const cached = await prisma.steamAppCache.findUnique({ where: { appId } });
  if (cached && !refresh && isFresh(cached)) {
    if (!cached.found) return null;
    const parsed = steamAppDetailsSchema.safeParse(cached.data);
    if (parsed.success) return parsed.data;
  }
  const raw = await callSteam((steam) => steam.getAppDetails(appId));
  const data = raw ? normalizeAppDetails(raw, appId) : null;
  await prisma.steamAppCache.upsert({
    where: { appId },
    create: { appId, found: Boolean(data), type: data?.type ?? null, data: data ?? {}, fetchedAt: new Date() },
    update: { found: Boolean(data), type: data?.type ?? null, data: data ?? {}, fetchedAt: new Date() },
  });
  return data;
}
