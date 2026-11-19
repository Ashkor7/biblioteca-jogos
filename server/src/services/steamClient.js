// Cliente da Steam: só endereços fixos (api.steampowered.com e store.steampowered.com),
// com timeout, intervalo mínimo entre chamadas, espera com backoff em 429/5xx e erros
// tipados. A chave nunca aparece em mensagens de erro, logs ou respostas.
//
// Para testes: setSteamClient(fake) troca o cliente usado pelos serviços.
import { config } from '../config.js';
import { LIMITS } from '../../../shared/domain.js';
import { cleanSteamTitle, isSteamId64, sanitizeExternalText } from '../../../shared/steam.js';

const API_BASE = 'https://api.steampowered.com';
const STORE_BASE = 'https://store.steampowered.com';
const ICON_BASE = 'https://media.steampowered.com/steamcommunity/public/images/apps';

/** Erro da Steam com código estável (a mensagem é técnica; a rota traduz para o usuário). */
export class SteamError extends Error {
  /**
   * @param {'NOT_CONFIGURED'|'TIMEOUT'|'NETWORK'|'RATE_LIMITED'|'UNAVAILABLE'|'FORBIDDEN'|'NOT_FOUND'|'BAD_RESPONSE'} code
   */
  constructor(code, message, { status = null, retryAfterMs = null } = {}) {
    super(message);
    this.name = 'SteamError';
    this.code = code;
    this.status = status;
    this.retryAfterMs = retryAfterMs;
  }
}

const RETRYABLE = new Set(['TIMEOUT', 'NETWORK', 'RATE_LIMITED', 'UNAVAILABLE']);

/** Fila simples: cada chamada espera o intervalo mínimo desde a anterior. */
export function createThrottle(intervalMs, sleep) {
  let next = 0;
  return async function wait() {
    const now = Date.now();
    const at = Math.max(now, next);
    next = at + intervalMs;
    if (at > now) await sleep(at - now);
  };
}

const defaultSleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function retryAfterMs(response) {
  const header = response.headers?.get?.('retry-after');
  if (!header) return null;
  const seconds = Number(header);
  if (Number.isFinite(seconds)) return Math.min(seconds * 1000, 120_000);
  const at = Date.parse(header);
  return Number.isNaN(at) ? null : Math.max(0, Math.min(at - Date.now(), 120_000));
}

/**
 * @param {{ apiKey?: string, fetchImpl?: typeof fetch, timeoutMs?: number,
 *   apiIntervalMs?: number, storeIntervalMs?: number, retries?: number,
 *   backoffBaseMs?: number, sleep?: (ms:number)=>Promise<void> }} [options]
 */
export function createSteamClient(options = {}) {
  const {
    apiKey,
    fetchImpl = globalThis.fetch,
    timeoutMs = 10_000,
    apiIntervalMs = 250,
    storeIntervalMs = 1500,
    retries = 3,
    backoffBaseMs = 2000,
    sleep = defaultSleep,
  } = options;
  const apiThrottle = createThrottle(apiIntervalMs, sleep);
  const storeThrottle = createThrottle(storeIntervalMs, sleep);

  async function once(url, throttle) {
    await throttle();
    let response;
    try {
      response = await fetchImpl(url, {
        headers: { accept: 'application/json' },
        redirect: 'error',
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (error) {
      const timeout = error?.name === 'TimeoutError' || error?.name === 'AbortError';
      // Sem a URL na mensagem: ela contém a chave.
      throw new SteamError(timeout ? 'TIMEOUT' : 'NETWORK', timeout ? 'A Steam demorou demais para responder' : 'Falha de rede ao falar com a Steam');
    }
    const { status } = response;
    if (status === 429) throw new SteamError('RATE_LIMITED', 'Limite de uso da Steam', { status, retryAfterMs: retryAfterMs(response) });
    if (status >= 500) throw new SteamError('UNAVAILABLE', `Steam indisponível (${status})`, { status, retryAfterMs: retryAfterMs(response) });
    if (status === 401 || status === 403) throw new SteamError('FORBIDDEN', `A Steam recusou o acesso (${status})`, { status });
    if (status === 404) throw new SteamError('NOT_FOUND', 'Recurso não encontrado na Steam', { status });
    const body = await response.json().catch(() => null);
    if (status >= 400) {
      const error = new SteamError('BAD_RESPONSE', `Resposta inesperada da Steam (${status})`, { status });
      error.body = body;
      throw error;
    }
    if (body === null || typeof body !== 'object') throw new SteamError('BAD_RESPONSE', 'Resposta da Steam em formato inesperado', { status });
    return body;
  }

  async function getJson(url, throttle) {
    for (let attempt = 0; ; attempt += 1) {
      try {
        return await once(url, throttle);
      } catch (error) {
        if (!(error instanceof SteamError) || !RETRYABLE.has(error.code) || attempt >= retries) throw error;
        const wait = error.retryAfterMs ?? Math.min(backoffBaseMs * 2 ** attempt, 60_000);
        await sleep(wait);
      }
    }
  }

  function apiUrl(path, params) {
    if (!apiKey) throw new SteamError('NOT_CONFIGURED', 'STEAM_API_KEY não definida');
    const url = new URL(path, API_BASE);
    url.searchParams.set('key', apiKey);
    url.searchParams.set('format', 'json');
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));
    return url;
  }

  const assertId = (steamId64) => {
    if (!isSteamId64(steamId64)) throw new SteamError('BAD_RESPONSE', 'SteamID64 inválido');
  };

  return {
    /** Apelido (steamcommunity.com/id/<apelido>) → SteamID64, ou null se não existir. */
    async resolveVanity(vanity) {
      const body = await getJson(apiUrl('/ISteamUser/ResolveVanityURL/v1/', { vanityurl: vanity }), apiThrottle);
      const r = body.response ?? {};
      return r.success === 1 && isSteamId64(r.steamid) ? r.steamid : null;
    },

    /** Nome, avatar, link e visibilidade do perfil; null se a conta não existir. */
    async getPlayerSummary(steamId64) {
      assertId(steamId64);
      const body = await getJson(apiUrl('/ISteamUser/GetPlayerSummaries/v2/', { steamids: steamId64 }), apiThrottle);
      const p = body.response?.players?.[0];
      if (!p || p.steamid !== steamId64) return null;
      const https = (u) => (typeof u === 'string' && u.startsWith('https://') && u.length <= 2048 ? u : null);
      return {
        steamId64,
        personaName: sanitizeExternalText(p.personaname, LIMITS.steamPersonaMax) ?? 'Jogador Steam',
        avatarUrl: https(p.avatarfull) ?? https(p.avatarmedium) ?? https(p.avatar),
        profileUrl: https(p.profileurl) ?? `https://steamcommunity.com/profiles/${steamId64}/`,
        // 3 = público; 1 = privado (ou só amigos, do ponto de vista da API)
        visibility: p.communityvisibilitystate === 3 ? 'public' : 'private',
      };
    },

    /**
     * Jogos da conta. `visible: false` quando a Steam esconde a lista (detalhes de
     * jogos privados): a resposta vem vazia, sem game_count.
     */
    async getOwnedGames(steamId64, { includeFreeGames = false } = {}) {
      assertId(steamId64);
      const body = await getJson(
        apiUrl('/IPlayerService/GetOwnedGames/v1/', {
          steamid: steamId64,
          include_appinfo: 1,
          include_played_free_games: includeFreeGames ? 1 : 0,
        }),
        apiThrottle,
      );
      const r = body.response ?? {};
      const visible = 'game_count' in r || Array.isArray(r.games);
      const games = (Array.isArray(r.games) ? r.games : [])
        .filter((g) => Number.isInteger(g?.appid) && g.appid > 0)
        .map((g) => {
          const icon = typeof g.img_icon_url === 'string' && /^[0-9a-f]{40}$/.test(g.img_icon_url) ? g.img_icon_url : null;
          const minutes = (v) => (Number.isInteger(v) && v >= 0 ? v : 0);
          return {
            appId: g.appid,
            name: cleanSteamTitle(g.name) || `App ${g.appid}`,
            playtimeMinutes: minutes(g.playtime_forever),
            playtime2WeeksMinutes: minutes(g.playtime_2weeks),
            lastPlayedAt: Number.isInteger(g.rtime_last_played) && g.rtime_last_played > 0 ? new Date(g.rtime_last_played * 1000) : null,
            iconUrl: icon ? `${ICON_BASE}/${g.appid}/${icon}.jpg` : null,
            hasStats: Boolean(g.has_community_visible_stats),
          };
        });
      return { visible, games };
    },

    /** Conquistas desbloqueadas/total; null se o jogo não tem conquistas ou estão privadas. */
    async getPlayerAchievements(steamId64, appId) {
      assertId(steamId64);
      try {
        const body = await getJson(
          apiUrl('/ISteamUserStats/GetPlayerAchievements/v1/', { steamid: steamId64, appid: appId }),
          apiThrottle,
        );
        const list = body.playerstats?.success ? body.playerstats.achievements : null;
        if (!Array.isArray(list) || list.length === 0) return null;
        return { unlocked: list.filter((a) => a?.achieved === 1).length, total: list.length };
      } catch (error) {
        // 400/403 aqui significam "jogo sem estatísticas" ou "perfil privado": não é falha.
        if (error instanceof SteamError && (error.status === 400 || error.code === 'FORBIDDEN')) return null;
        throw error;
      }
    },

    /** Dados brutos da loja (não documentado; limite baixo). null se o app não tem página. */
    async getAppDetails(appId) {
      const url = new URL('/api/appdetails', STORE_BASE);
      url.searchParams.set('appids', String(appId));
      url.searchParams.set('l', 'brazilian');
      url.searchParams.set('cc', 'br');
      const body = await getJson(url, storeThrottle);
      const entry = body[String(appId)];
      return entry?.success && entry.data && typeof entry.data === 'object' ? entry.data : null;
    },
  };
}

let current = null;

/** Cliente usado pelos serviços (criado a partir do .env na primeira vez). */
export function getSteamClient() {
  current ??= createSteamClient({
    apiKey: config.STEAM_API_KEY,
    timeoutMs: config.STEAM_TIMEOUT_MS,
    apiIntervalMs: config.STEAM_API_INTERVAL_MS,
    storeIntervalMs: config.STEAM_STORE_INTERVAL_MS,
  });
  return current;
}

/** Troca o cliente (testes). null volta ao cliente real. */
export function setSteamClient(client) {
  current = client;
}

export const isSteamConfigured = () => Boolean(config.STEAM_API_KEY);
