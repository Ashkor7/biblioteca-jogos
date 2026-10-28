// Contratos de entrada da API (Zod). Usados pelo servidor para validar
// requisições e pelo cliente para validar o payload antes de enviá-lo.
import { z } from 'zod';
import {
  LIMITS,
  cleanDisplayName,
  normalizeKey,
  moneyToCents,
  centsToDecimalString,
} from './domain.js';

const MEDIA_VALUES = ['PHYSICAL', 'DIGITAL'];
const OWNERSHIP_VALUES = ['OWNED', 'WISHLIST'];
const PLAY_STATUS_VALUES = ['NOT_STARTED', 'COMPLETED', 'ABANDONED'];

/** Valor monetário em BRL ≥ 0. Saída: string decimal "199.90" ou null. */
export const moneyField = z
  .union([z.string(), z.number(), z.null()])
  .optional()
  .transform((value, ctx) => {
    const cents = moneyToCents(value);
    if (cents === null) return null;
    if (Number.isNaN(cents)) {
      ctx.addIssue({
        code: 'custom',
        message: 'Informe um valor em reais válido e não negativo (ex.: 199,90)',
      });
      return z.NEVER;
    }
    if (cents > LIMITS.priceMaxCents) {
      ctx.addIssue({ code: 'custom', message: 'Valor acima do limite permitido' });
      return z.NEVER;
    }
    return centsToDecimalString(cents);
  });

/** Nome digitável de plataforma/loja/categoria. */
export function lookupName(requiredMessage, max = LIMITS.lookupNameMax) {
  return z
    .string({ error: requiredMessage })
    .transform(cleanDisplayName)
    .superRefine((value, ctx) => {
      if (!value) ctx.addIssue({ code: 'custom', message: requiredMessage });
      else if (value.length > max)
        ctx.addIssue({ code: 'custom', message: `Use no máximo ${max} caracteres` });
      else if (!normalizeKey(value))
        ctx.addIssue({ code: 'custom', message: 'Use pelo menos uma letra ou número' });
    });
}

const optionalLookupName = z
  .union([z.string(), z.null()])
  .optional()
  .transform((value) => (value == null ? null : cleanDisplayName(value) || null))
  .superRefine((value, ctx) => {
    if (value === null) return;
    if (value.length > LIMITS.lookupNameMax)
      ctx.addIssue({ code: 'custom', message: `Use no máximo ${LIMITS.lookupNameMax} caracteres` });
    else if (!normalizeKey(value))
      ctx.addIssue({ code: 'custom', message: 'Use pelo menos uma letra ou número' });
  });

export const externalImageUrl = z
  .string()
  .trim()
  .max(2048, 'URL muito longa')
  .superRefine((value, ctx) => {
    let parsed;
    try {
      parsed = new URL(value);
    } catch {
      ctx.addIssue({ code: 'custom', message: 'URL de imagem inválida' });
      return;
    }
    if (parsed.protocol !== 'https:') {
      ctx.addIssue({ code: 'custom', message: 'Use um endereço https:// para a imagem' });
    }
  });

const categoriesField = z
  .array(z.string({ error: 'Categoria inválida' }), { error: 'Categorias inválidas' })
  .max(LIMITS.categoriesPerGame, `Máximo de ${LIMITS.categoriesPerGame} categorias`)
  .optional()
  .transform((list, ctx) => {
    const seen = new Map();
    for (const raw of list ?? []) {
      const name = cleanDisplayName(raw);
      if (!name) continue;
      if (name.length > LIMITS.categoryMax) {
        ctx.addIssue({
          code: 'custom',
          message: `Categoria "${name.slice(0, 20)}…" passa de ${LIMITS.categoryMax} caracteres`,
        });
        return z.NEVER;
      }
      const key = normalizeKey(name);
      if (!key) continue;
      if (!seen.has(key)) seen.set(key, name);
    }
    return [...seen.values()];
  });

/**
 * Esquema de campos de um jogo (tipos, limites e normalização).
 * As regras entre campos ficam em validateGame().
 */
export function buildGameSchema() {
  return z
    .object({
      title: z
        .string({ error: 'Informe o nome do jogo' })
        .transform(cleanDisplayName)
        .pipe(
          z
            .string()
            .min(1, 'Informe o nome do jogo')
            .max(LIMITS.titleMax, `Use no máximo ${LIMITS.titleMax} caracteres`),
        ),
      ownershipStatus: z.enum(OWNERSHIP_VALUES, {
        error: 'Escolha Físico, Digital ou Lista de desejos',
      }),
      mediaType: z
        .enum(MEDIA_VALUES, { error: 'Mídia inválida' })
        .nullish()
        .transform((v) => v ?? null),
      platform: lookupName('Informe a plataforma'),
      store: optionalLookupName,
      originalPrice: moneyField,
      paidPrice: moneyField,
      currentWishPrice: moneyField,
      purchasedAt: z.coerce
        .date({ error: 'Data de compra inválida' })
        .nullish()
        .transform((v) => v ?? null),
      playStatus: z.enum(PLAY_STATUS_VALUES, { error: 'Estado inválido' }).default('NOT_STARTED'),
      playTimeMinutes: z
        .number({ error: 'Horas inválidas' })
        .int('Horas inválidas')
        .min(0, 'As horas não podem ser negativas')
        .max(LIMITS.playTimeMaxMinutes, 'Horas acima do limite')
        .nullish()
        .transform((v) => v ?? 0),
      ratingStars: z
        .number({ error: 'Nota inválida' })
        .int('Nota inválida')
        .min(1, 'A nota vai de 1 a 5 estrelas')
        .max(5, 'A nota vai de 1 a 5 estrelas')
        .nullish()
        .transform((v) => v ?? null),
      reviewText: z
        .string()
        .max(LIMITS.reviewMax, `Use no máximo ${LIMITS.reviewMax} caracteres`)
        .nullish()
        .transform((v) => (v && v.trim() ? v.trim() : null)),
      categories: categoriesField,
      coverUrl: externalImageUrl.nullish().transform((v) => v || null),
    })
    .transform((game) => {
      if (game.ownershipStatus === 'WISHLIST') {
        // Desejos não têm mídia, preço pago nem loja (regra da especificação).
        return { ...game, mediaType: null, paidPrice: null, store: null, purchasedAt: null };
      }
      return { ...game, currentWishPrice: null };
    });
}

/**
 * Regras de compra que dependem de vários campos. Rodam sobre a entrada bruta
 * para que TODOS os erros apareçam juntos (o Zod interrompe refinamentos do
 * objeto quando algum campo já é inválido).
 */
function purchaseIssues(input, { allowIncompletePurchase }) {
  const issues = {};
  if (input?.ownershipStatus !== 'OWNED' || allowIncompletePurchase) return issues;
  const blank = (v) => v === null || v === undefined || (typeof v === 'string' && v.trim() === '');
  if (blank(input.mediaType)) issues.mediaType = 'Escolha Físico ou Digital';
  if (blank(input.originalPrice)) issues.originalPrice = 'Informe o preço original (sem desconto)';
  if (blank(input.paidPrice)) issues.paidPrice = 'Informe quanto você pagou (0 para gratuito)';
  if (blank(input.store) || !normalizeKey(input.store)) issues.store = 'Informe onde comprou';
  return issues;
}

/**
 * Valida um jogo completo (criação ou registro já mesclado na edição).
 * @returns {{ success: true, data: object } | { success: false, fields: Record<string,string> }}
 */
export function validateGame(input, { allowIncompletePurchase = false } = {}) {
  const result = buildGameSchema().safeParse(input);
  const fields = result.success ? {} : zodFieldErrors(result.error);
  for (const [key, message] of Object.entries(purchaseIssues(input, { allowIncompletePurchase }))) {
    fields[key] ??= message;
  }
  if (Object.keys(fields).length) return { success: false, fields };
  return { success: true, data: result.data };
}

export const markPurchasedSchema = z.object({
  mediaType: z.enum(MEDIA_VALUES, { error: 'Escolha Físico ou Digital' }),
  originalPrice: moneyField,
  paidPrice: moneyField.refine((v) => v !== null, 'Informe quanto você pagou (0 para gratuito)'),
  store: lookupName('Informe onde comprou'),
  purchasedAt: z.coerce
    .date({ error: 'Data de compra inválida' })
    .nullish()
    .transform((v) => v ?? null),
});

export const loginSchema = z.object({
  email: z
    .string({ error: 'Informe o e-mail' })
    .trim()
    .toLowerCase()
    .pipe(z.email('E-mail inválido')),
  password: z.string({ error: 'Informe a senha' }).min(1, 'Informe a senha').max(200),
});

export const platformRenameSchema = z.object({
  name: lookupName('Informe o novo nome da plataforma'),
});

export const featuredSchema = z.object({
  isFeatured: z.boolean({ error: 'Valor inválido para destaque' }),
});

export const imageOrderSchema = z.object({
  imageIds: z.array(z.uuid('Imagem inválida')).min(1, 'Informe a ordem das imagens'),
});

export const imagePatchSchema = z.object({
  isCover: z.literal(true, { error: 'Use isCover: true para definir a capa' }).optional(),
  altText: z
    .string()
    .max(200, 'Texto alternativo muito longo')
    .nullish()
    .transform((v) => (v && v.trim() ? v.trim() : null)),
});

export const externalImageSchema = z.object({
  url: externalImageUrl,
  isCover: z.boolean().optional().default(false),
});

/** Formato antigo salvo em localStorage['jogos'] pela versão 0 do app. */
export const legacyGameSchema = z.object({
  id: z.union([z.string(), z.number()]).transform(String),
  nome: z.string().min(1),
  categoria: z.string().optional().default(''),
  plataforma: z.string().optional().default(''),
  preco: z.union([z.string(), z.number()]).optional().nullable(),
  status: z.string().optional().default('Não iniciado'),
  capa: z.string().optional().nullable(),
  avaliacao: z.union([z.string(), z.number()]).optional().nullable(),
  destaque: z.boolean().optional().default(false),
});

/** Converte erros do Zod em { "campo": "mensagem" } para a UI. */
export function zodFieldErrors(error) {
  const fields = {};
  for (const issue of error.issues) {
    const key = issue.path.length ? issue.path.join('.') : '_';
    if (!fields[key]) fields[key] = issue.message;
  }
  return fields;
}
