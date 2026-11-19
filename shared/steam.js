// Regras da integração com a Steam usadas pelo servidor e pela interface.
// Tudo aqui é função pura: nada de rede, Node ou navegador.
import { LIMITS, cleanDisplayName, isIsoDate } from './domain.js';

const ID64_RE = /^7656119\d{10}$/;
const VANITY_RE = /^[A-Za-z0-9_-]{2,32}$/;

/**
 * Interpreta o que o usuário digitou para achar a conta Steam.
 * Aceita SteamID64, https://steamcommunity.com/profiles/<id>, https://steamcommunity.com/id/<apelido>
 * ou só o apelido. Retorna null quando não reconhece o formato.
 * @returns {{ kind: 'id64' | 'vanity', value: string } | null}
 */
export function parseSteamProfileInput(input) {
  const text = String(input ?? '').trim();
  if (!text || text.length > 200) return null;
  if (ID64_RE.test(text)) return { kind: 'id64', value: text };
  const url = /^(?:https?:\/\/)?(?:www\.)?steamcommunity\.com\/(profiles|id)\/([^/?#\s]+)\/?(?:[?#].*)?$/i.exec(text);
  if (url) {
    const [, kind, value] = url;
    if (kind.toLowerCase() === 'profiles') return ID64_RE.test(value) ? { kind: 'id64', value } : null;
    return VANITY_RE.test(value) ? { kind: 'vanity', value } : null;
  }
  if (/[/.:]/.test(text)) return null; // parece link, mas não é da comunidade Steam
  return VANITY_RE.test(text) ? { kind: 'vanity', value: text } : null;
}

export const isSteamId64 = (value) => ID64_RE.test(String(value ?? ''));

/** Página do app na loja (endereço fixo; o appId é sempre um inteiro). */
export function steamStoreUrl(appId) {
  const id = Number(appId);
  return Number.isInteger(id) && id > 0 ? `https://store.steampowered.com/app/${id}/` : null;
}

/** Classificação de cada app na prévia da importação. */
export const STEAM_PREVIEW_STATUS = Object.freeze({
  NEW: 'NEW',
  EXISTING: 'EXISTING',
  DUPLICATE: 'DUPLICATE',
  WISHLIST: 'WISHLIST',
  IGNORED: 'IGNORED',
  NOT_GAME: 'NOT_GAME',
});

export const STEAM_PREVIEW_LABELS = Object.freeze({
  NEW: 'Novo',
  EXISTING: 'Já na biblioteca',
  DUPLICATE: 'Possível duplicado',
  WISHLIST: 'Na lista de desejos',
  IGNORED: 'Ignorado',
  NOT_GAME: 'Não é jogo',
});

export const STEAM_APP_TYPE_LABELS = Object.freeze({
  game: 'Jogo',
  dlc: 'DLC',
  demo: 'Demo',
  mod: 'Mod',
  music: 'Trilha sonora',
  video: 'Vídeo',
  application: 'Ferramenta',
  tool: 'Ferramenta',
  advertising: 'Divulgação',
  episode: 'Episódio',
  series: 'Série',
  hardware: 'Hardware',
});

// Nomes típicos de apps que aparecem na conta mas não são jogos.
const NON_GAME_NAME_RE =
  /\b(soundtrack|o\.?s\.?t\.?|dedicated server|sdk|demo|playtest|benchmark|level editor|mod tools|authoring tools|artbook|wallpapers?)\b/i;

/**
 * Tipo provável de um app: o tipo da loja (quando já está no cache) manda; sem ele,
 * usa o nome. Retorna null quando parece ser jogo.
 */
export function nonGameType({ name, storeType } = {}) {
  if (storeType) return storeType === 'game' ? null : storeType;
  return NON_GAME_NAME_RE.test(String(name ?? '')) ? 'other' : null;
}

// ---------------------------------------------------------------------------
// Texto externo é dado não confiável: sem HTML, entidades decodificadas,
// sem caracteres de controle e cortado no limite.
// ---------------------------------------------------------------------------

const NAMED_ENTITIES = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  reg: '®',
  trade: '™',
  copy: '©',
  hellip: '…',
  mdash: '—',
  ndash: '–',
  laquo: '«',
  raquo: '»',
  lsquo: '‘',
  rsquo: '’',
  ldquo: '“',
  rdquo: '”',
  bull: '•',
  middot: '·',
};

function decodeEntities(text) {
  return text.replace(/&(#x[0-9a-f]{1,6}|#\d{1,7}|[a-z]{2,8});/gi, (match, code) => {
    if (code[0] === '#') {
      const n = code[1].toLowerCase() === 'x' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return n > 0 && n <= 0x10ffff && !(n >= 0xd800 && n <= 0xdfff) ? String.fromCodePoint(n) : '';
    }
    return NAMED_ENTITIES[code.toLowerCase()] ?? match;
  });
}

// eslint-disable-next-line no-control-regex -- remover caracteres de controle é exatamente o objetivo
const CONTROL_RE = /[\u0000-\u0008\u000B-\u001F\u007F\u200B-\u200F\u202A-\u202E\u2066-\u2069]/g;

/** HTML da Steam → texto simples de no máximo `max` caracteres (null se ficar vazio). */
export function sanitizeExternalText(value, max) {
  if (value === null || value === undefined) return null;
  let text = String(value)
    .replace(/<\s*(script|style)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, ' ')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]*>/g, ' ');
  text = decodeEntities(text)
    .replace(/<[^>]*>/g, ' ') // tags que só existiam codificadas (&lt;b&gt;)
    .replace(CONTROL_RE, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!text) return null;
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).trimEnd()}…`;
}

// Meses como a loja escreve em português ("10 dez. 2020") e em inglês ("Dec 10, 2020").
const MONTHS = {
  jan: 1, fev: 2, feb: 2, mar: 3, abr: 4, apr: 4, mai: 5, may: 5, jun: 6, jul: 7,
  ago: 8, aug: 8, set: 9, sep: 9, out: 10, oct: 10, nov: 11, dez: 12, dec: 12,
};

function isoFromParts(day, monthToken, year) {
  const month = MONTHS[String(monthToken).toLowerCase().slice(0, 3)];
  if (!month) return null;
  const iso = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  return isIsoDate(iso) ? iso : null;
}

/**
 * Data de lançamento da loja. Quando o texto não é uma data exata ("Em breve", "2027",
 * "T1 2027"), devolve date null e o texto original (cortado).
 * @returns {{ date: string | null, text: string | null }}
 */
export function parseSteamReleaseDate(value) {
  const text = sanitizeExternalText(value, LIMITS.releaseDateTextMax);
  if (!text) return { date: null, text: null };
  let m = /^(\d{1,2})(?:\s+de)?[\s/]+([a-zç]{3,5})\.?(?:\s+de)?[\s/]+(\d{4})$/i.exec(text);
  if (m) return { date: isoFromParts(m[1], m[2], m[3]), text };
  m = /^([a-z]{3,5})\.?\s+(\d{1,2}),?\s+(\d{4})$/i.exec(text);
  if (m) return { date: isoFromParts(m[2], m[1], m[3]), text };
  m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(text);
  if (m) {
    const iso = `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
    return { date: isIsoDate(iso) ? iso : null, text };
  }
  return { date: null, text };
}

/** Lista de nomes (desenvolvedoras, distribuidoras) → texto único dentro do limite. */
export function joinNames(list, max) {
  const names = (Array.isArray(list) ? list : [])
    .map((n) => sanitizeExternalText(n, max))
    .filter(Boolean);
  const unique = [...new Set(names)];
  let out = '';
  for (const name of unique) {
    const next = out ? `${out}, ${name}` : name;
    if (next.length > max) break;
    out = next;
  }
  return out || null;
}

/** Nome de um app (título do jogo) vindo da Steam. */
export function cleanSteamTitle(value) {
  return cleanDisplayName(sanitizeExternalText(value, LIMITS.titleMax) ?? '');
}
