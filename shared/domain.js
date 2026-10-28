// Regras de domínio compartilhadas entre o frontend (React) e a API (Express).
// Este arquivo não pode depender de APIs exclusivas do navegador ou do Node.

export const OWNERSHIP = Object.freeze({ OWNED: 'OWNED', WISHLIST: 'WISHLIST' });
export const MEDIA = Object.freeze({ PHYSICAL: 'PHYSICAL', DIGITAL: 'DIGITAL' });
export const PLAY_STATUS = Object.freeze({
  NOT_STARTED: 'NOT_STARTED',
  COMPLETED: 'COMPLETED',
  ABANDONED: 'ABANDONED',
});

export const PLAY_STATUS_LABELS = Object.freeze({
  NOT_STARTED: 'Não iniciado',
  COMPLETED: 'Zerado',
  ABANDONED: 'Abandonado',
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
});

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
