// Vínculo da conta Steam (um por usuário). Tudo filtrado por userId.
import { prisma } from '../db.js';
import { AppError } from '../lib/errors.js';
import { parseOrThrow } from '../lib/validate.js';
import { steamLookupSchema, steamLinkSchema } from '../../../shared/schemas.js';
import { parseSteamProfileInput } from '../../../shared/steam.js';
import { getSteamClient, isSteamConfigured, SteamError } from './steamClient.js';

export const STEAM_DISABLED_MESSAGE =
  'A importação da Steam está desativada: falta a STEAM_API_KEY no .env do servidor. Veja a seção "Steam" do README para gerar a chave.';

/** 503 claro quando não há chave configurada. */
export function ensureSteamEnabled() {
  if (!isSteamConfigured()) throw new AppError(503, STEAM_DISABLED_MESSAGE, { code: 'STEAM_NOT_CONFIGURED' });
}

/** Erros técnicos da Steam → mensagens em PT-BR (nunca com URL ou chave). */
export function toSteamAppError(error) {
  if (!(error instanceof SteamError)) return error;
  switch (error.code) {
    case 'NOT_CONFIGURED':
      return new AppError(503, STEAM_DISABLED_MESSAGE, { code: 'STEAM_NOT_CONFIGURED' });
    case 'RATE_LIMITED':
      return new AppError(503, 'A Steam limitou as consultas por agora. Espere alguns minutos e tente de novo.', { code: 'STEAM_RATE_LIMITED' });
    case 'FORBIDDEN':
      return new AppError(502, 'A Steam recusou a consulta. Confira se a STEAM_API_KEY é válida e se o perfil permite ver os jogos.', { code: 'STEAM_FORBIDDEN' });
    case 'TIMEOUT':
    case 'NETWORK':
    case 'UNAVAILABLE':
      return new AppError(502, 'A Steam não respondeu. Tente de novo em alguns minutos.', { code: 'STEAM_UNAVAILABLE' });
    default:
      return new AppError(502, 'A Steam respondeu em um formato inesperado. Tente de novo mais tarde.', { code: 'STEAM_BAD_RESPONSE' });
  }
}

/** Executa uma chamada à Steam traduzindo os erros. */
export async function callSteam(fn) {
  try {
    return await fn(getSteamClient());
  } catch (error) {
    throw toSteamAppError(error);
  }
}

export function accountToDto(account) {
  if (!account) return null;
  return {
    steamId64: account.steamId64,
    personaName: account.personaName,
    avatarUrl: account.avatarUrl,
    profileUrl: account.profileUrl,
    linkedAt: account.linkedAt,
    lastSyncAt: account.lastSyncAt,
  };
}

export async function getLinkedAccount(userId) {
  return prisma.steamAccount.findUnique({ where: { userId } });
}

export async function requireLinkedAccount(userId) {
  const account = await getLinkedAccount(userId);
  if (!account) throw new AppError(409, 'Vincule sua conta Steam em Configurações antes de importar', { code: 'STEAM_NOT_LINKED' });
  return account;
}

/** Estado da integração para a tela (funciona mesmo sem chave). */
export async function getSteamStatus(userId) {
  const [account, ignored, lastJob, steamGames] = await Promise.all([
    getLinkedAccount(userId),
    prisma.steamIgnoredApp.count({ where: { userId } }),
    prisma.steamSyncJob.findFirst({ where: { userId }, orderBy: { createdAt: 'desc' }, select: { id: true, status: true } }),
    prisma.game.count({ where: { ownerId: userId, steamAppId: { not: null } } }),
  ]);
  return {
    enabled: isSteamConfigured(),
    disabledReason: isSteamConfigured() ? null : STEAM_DISABLED_MESSAGE,
    account: accountToDto(account),
    ignoredCount: ignored,
    linkedGames: steamGames,
    lastJob,
  };
}

/** Acha o perfil pelo que o usuário digitou, sem salvar (para confirmar nome e avatar). */
export async function lookupSteamProfile(body) {
  ensureSteamEnabled();
  const { input } = parseOrThrow(steamLookupSchema, body);
  const parsed = parseSteamProfileInput(input);
  if (!parsed) {
    throw new AppError(400, 'Confira os campos destacados', {
      fields: { input: 'Use o SteamID64 (17 dígitos), o link do perfil (steamcommunity.com/profiles/… ou /id/…) ou o apelido' },
    });
  }
  const steamId64 =
    parsed.kind === 'id64' ? parsed.value : await callSteam((steam) => steam.resolveVanity(parsed.value));
  if (!steamId64) {
    throw new AppError(404, `Não encontramos um perfil da Steam com o apelido "${parsed.value}". Confira o link do seu perfil.`, {
      code: 'STEAM_PROFILE_NOT_FOUND',
    });
  }
  const summary = await callSteam((steam) => steam.getPlayerSummary(steamId64));
  if (!summary) throw new AppError(404, 'Esse perfil da Steam não existe', { code: 'STEAM_PROFILE_NOT_FOUND' });
  return summary;
}

/** Salva o vínculo (o servidor consulta a Steam de novo: não confia no nome enviado). */
export async function linkSteamAccount(userId, body) {
  ensureSteamEnabled();
  const { steamId64 } = parseOrThrow(steamLinkSchema, body);
  const summary = await callSteam((steam) => steam.getPlayerSummary(steamId64));
  if (!summary) throw new AppError(404, 'Esse perfil da Steam não existe', { code: 'STEAM_PROFILE_NOT_FOUND' });
  const data = {
    steamId64,
    personaName: summary.personaName,
    avatarUrl: summary.avatarUrl,
    profileUrl: summary.profileUrl,
  };
  const account = await prisma.steamAccount.upsert({
    where: { userId },
    create: { userId, ...data },
    update: { ...data, linkedAt: new Date(), lastSyncAt: null },
  });
  return { account: accountToDto(account), visibility: summary.visibility };
}

/**
 * Desvincula. Os jogos ficam; com keepAppIds=false eles perdem o vínculo com o app
 * (e as leituras da Steam), virando jogos sem ligação com a conta.
 */
export async function unlinkSteamAccount(userId, { keepAppIds }) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.steamAccount.findUnique({ where: { userId } });
    if (!existing) throw new AppError(404, 'Nenhuma conta Steam vinculada');
    await tx.steamSyncJob.updateMany({
      where: { userId, status: { in: ['PENDING', 'RUNNING'] } },
      data: { status: 'CANCELLED', finishedAt: new Date() },
    });
    let unlinkedGames = 0;
    if (!keepAppIds) {
      const result = await tx.game.updateMany({
        where: { ownerId: userId, steamAppId: { not: null } },
        data: {
          steamAppId: null,
          steamPlaytimeMinutes: null,
          steamLastPlayedAt: null,
          steamSyncedAt: null,
          steamAchievementsUnlocked: null,
          steamAchievementsTotal: null,
        },
      });
      unlinkedGames = result.count;
    }
    await tx.steamAccount.delete({ where: { userId } });
    const games = await tx.game.count({ where: { ownerId: userId, source: 'STEAM' } });
    return { unlinked: true, keptAppIds: keepAppIds, unlinkedGames, steamGamesKept: games };
  });
}
