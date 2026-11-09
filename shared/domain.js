// Regras de domínio compartilhadas entre o frontend (React) e a API (Express).
// Este arquivo não pode depender de APIs exclusivas do navegador ou do Node.

export const OWNERSHIP = Object.freeze({ OWNED: 'OWNED', WISHLIST: 'WISHLIST' });
export const MEDIA = Object.freeze({ PHYSICAL: 'PHYSICAL', DIGITAL: 'DIGITAL' });
export const PLAY_STATUS = Object.freeze({
  NOT_STARTED: 'NOT_STARTED',
  PLAYING: 'PLAYING',
  COMPLETED: 'COMPLETED',
  ABANDONED: 'ABANDONED',
});

export const PLAY_STATUS_LABELS = Object.freeze({
  NOT_STARTED: 'Não iniciado',
  PLAYING: 'Jogando',
  COMPLETED: 'Zerado',
  ABANDONED: 'Abandonado',
});

export const WISH_PRIORITY_LABELS = Object.freeze({
  HIGH: 'Alta',
  MEDIUM: 'Média',
  LOW: 'Baixa',
});

export const GOAL_TYPE_LABELS = Object.freeze({
  COMPLETE_GAMES: 'Zerar jogos',
  PLAY_HOURS: 'Jogar horas (diário)',
  COMPLETE_CATEGORY: 'Zerar jogos de uma categoria',
  COMPLETE_BACKLOG: 'Zerar jogos que já estavam no acervo',
});

export const MEDIA_LABELS = Object.freeze({
  PHYSICAL: 'Físico',
  DIGITAL: 'Digital',
});

// Condição exibida no formulário: junta mídia e posse em uma única escolha.
export const COLLECTION_CONDITIONS = Object.freeze([
  { value: 'PHYSICAL', label: 'Físico', ownershipStatus: 'OWNED', mediaType: 'PHYSICAL' },
  { value: 'DIGITAL', label: 'Digital', ownershipStatus: 'OWNED', mediaType: 'DIGITAL' },
  { value: 'WISHLIST', label: 'Lista de desejos', ownershipStatus: 'WISHLIST', mediaType: null },
]);

export const LIMITS = Object.freeze({
  titleMax: 160,
  lookupNameMax: 60,
  categoryMax: 40,
  categoriesPerGame: 20,
  reviewMax: 5000,
  priceMaxCents: 999_999_999_99, // DECIMAL(12,2)
  playTimeMaxMinutes: 1_000_000 * 60,
  sessionMaxMinutes: 24 * 60,
  sessionNotesMax: 1000,
  usernameMin: 3,
  usernameMax: 30,
  displayNameMax: 60,
  bioMax: 400,
  collectionNameMax: 80,
  collectionDescriptionMax: 500,
  wishNotesMax: 1000,
  priceNoteMax: 200,
  goalNameMax: 80,
  favoritesOnProfileHeader: 6,
});

/** Usernames reservados (rotas e termos que confundiriam visitantes). */
export const RESERVED_USERNAMES = Object.freeze(['admin', 'api', 'login', 'perfil', 'u', 'uploads', 'configuracoes', 'suporte']);

/** Mantém a grafia escolhida pelo usuário, mas remove espaços sobrando. */
export function cleanDisplayName(value) {
  return String(value ?? '')
    .normalize('NFKC')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Chave de comparação: sem acentos, minúscula, pontuação e espaços colapsados.
 * "Xbox 360", "xbox-360" e " XBOX  360 " geram a mesma chave.
 */
export function normalizeKey(value) {
  return cleanDisplayName(value)
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Slug estável usado nas rotas: /plataformas/xbox-360 */
export function slugify(value) {
  return normalizeKey(value).replace(/ /g, '-');
}

const MONEY_RE = /^\d{1,10}([.,]\d{1,2})?$/;

/**
 * Converte "199,90", "199.90", "1.299,90", 199.9 → centavos inteiros (19990).
 * Retorna null para vazio e NaN para entradas inválidas/negativas.
 */
export function moneyToCents(input) {
  if (input === null || input === undefined) return null;
  if (typeof input === 'number') {
    if (!Number.isFinite(input) || input < 0) return Number.NaN;
    return Math.round(input * 100);
  }
  let text = String(input).trim().replace(/^R\$\s*/i, '').replace(/\s/g, '');
  if (text === '') return null;
  if (text.startsWith('-')) return Number.NaN;
  // Formato brasileiro com separador de milhar: 1.299,90
  if (/^\d{1,3}(\.\d{3})+(,\d{1,2})?$/.test(text)) {
    text = text.replace(/\./g, '');
  }
  if (!MONEY_RE.test(text)) return Number.NaN;
  const [intPart, decPart = ''] = text.replace(',', '.').split('.');
  return Number(intPart) * 100 + Number(decPart.padEnd(2, '0'));
}

/** Centavos → string decimal com 2 casas ("199.90"), formato aceito pelo PostgreSQL. */
export function centsToDecimalString(cents) {
  if (cents === null || cents === undefined) return null;
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(cents);
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, '0')}`;
}

/** "12,5" horas → 750 minutos. Retorna null para vazio e NaN para inválido. */
export function hoursToMinutes(input) {
  if (input === null || input === undefined) return null;
  const text = String(input).trim().replace(',', '.');
  if (text === '') return null;
  if (!/^\d{1,7}(\.\d{1,2})?$/.test(text)) return Number.NaN;
  return Math.round(Number(text) * 60);
}

export function minutesToHours(minutes) {
  return Math.round(((minutes ?? 0) / 60) * 100) / 100;
}

/** "2026-11-09" válido (data de calendário, sem horário). */
export function isIsoDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

/** Data de hoje (AAAA-MM-DD) num fuso horário IANA. */
export function todayIn(timeZone = 'America/Sao_Paulo', now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

/** Soma dias a uma data AAAA-MM-DD. */
export function addDays(isoDate, days) {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Segunda-feira da semana de uma data AAAA-MM-DD. */
export function startOfWeek(isoDate) {
  const day = new Date(`${isoDate}T00:00:00Z`).getUTCDay(); // 0 = domingo
  return addDays(isoDate, day === 0 ? -6 : 1 - day);
}

/** "2h30" a partir de minutos. */
export function formatDuration(minutes) {
  const m = Math.max(0, Math.round(minutes ?? 0));
  const h = Math.floor(m / 60);
  const rest = m % 60;
  if (h === 0) return `${rest} min`;
  return rest ? `${h}h${String(rest).padStart(2, '0')}` : `${h}h`;
}
