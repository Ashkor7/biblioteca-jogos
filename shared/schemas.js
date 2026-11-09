// Contratos de entrada da API (Zod). Usados pelo servidor para validar
// requisições e pelo cliente para validar o payload antes de enviá-lo.
import { z } from 'zod';
import {
  LIMITS,
  RESERVED_USERNAMES,
  cleanDisplayName,
  normalizeKey,
  moneyToCents,
  centsToDecimalString,
  isIsoDate,
} from './domain.js';

const MEDIA_VALUES = ['PHYSICAL', 'DIGITAL'];
const OWNERSHIP_VALUES = ['OWNED', 'WISHLIST'];
const PLAY_STATUS_VALUES = ['NOT_STARTED', 'PLAYING', 'COMPLETED', 'ABANDONED'];
const PRIORITY_VALUES = ['LOW', 'MEDIUM', 'HIGH'];
const GOAL_TYPE_VALUES = ['COMPLETE_GAMES', 'PLAY_HOURS', 'COMPLETE_CATEGORY', 'COMPLETE_BACKLOG'];

export { PLAY_STATUS_VALUES, PRIORITY_VALUES, GOAL_TYPE_VALUES };

/** Texto livre opcional: apara espaços; vazio vira null. */
function optionalText(max) {
  return z
    .string({ error: 'Texto inválido' })
    .max(max, `Use no máximo ${max} caracteres`)
    .nullish()
    .transform((v) => (v && v.trim() ? v.trim() : null));
}

/** Data de calendário "AAAA-MM-DD". */
export function isoDateField(message = 'Data inválida') {
  return z.string({ error: message }).trim().refine(isIsoDate, message);
}

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
      // Data em que zerou (opcional). Só vale para playStatus COMPLETED.
      completedAt: z.coerce
        .date({ error: 'Data de conclusão inválida' })
        .nullish()
        .transform((v) => v ?? null),
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
      targetPrice: moneyField,
      wishPriority: z
        .enum(PRIORITY_VALUES, { error: 'Prioridade inválida' })
        .nullish()
        .transform((v) => v ?? null),
      preferredStore: optionalLookupName,
      wishNotes: optionalText(LIMITS.wishNotesMax),
    })
    .transform((game) => {
      if (game.playStatus !== 'COMPLETED') game = { ...game, completedAt: null };
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

// ---------------------------------------------------------------------------
// Player Hub (v3)
// ---------------------------------------------------------------------------

export const usernameField = z
  .string({ error: 'Informe o nome de usuário' })
  .trim()
  .toLowerCase()
  .superRefine((value, ctx) => {
    if (value.length < LIMITS.usernameMin || value.length > LIMITS.usernameMax) {
      ctx.addIssue({ code: 'custom', message: `Use de ${LIMITS.usernameMin} a ${LIMITS.usernameMax} caracteres` });
    } else if (!/^[a-z0-9][a-z0-9_-]+$/.test(value)) {
      ctx.addIssue({
        code: 'custom',
        message: 'Use letras minúsculas sem acento, números, hífen ou sublinhado (começando por letra ou número)',
      });
    } else if (RESERVED_USERNAMES.includes(value)) {
      ctx.addIssue({ code: 'custom', message: 'Esse nome de usuário é reservado' });
    }
  });

// Caracteres de controle e de direção de texto não têm uso legítimo em nomes e biografias.
// eslint-disable-next-line no-control-regex -- remover caracteres de controle é exatamente o objetivo
const CONTROL_RE = /[\u0000-\u0009\u000B-\u001F\u007F\u200B-\u200F\u202A-\u202E\u2066-\u2069]/g;
const stripControl = (v) => String(v).replace(CONTROL_RE, '');

function displayText(requiredMessage, max) {
  return z
    .string({ error: requiredMessage })
    .transform((v) => cleanDisplayName(stripControl(v)))
    .pipe(z.string().min(1, requiredMessage).max(max, `Use no máximo ${max} caracteres`));
}

export const profileUpdateSchema = z
  .object({
    displayName: displayText('Informe o nome de exibição', LIMITS.displayNameMax),
    username: usernameField,
    bio: z
      .string({ error: 'Biografia inválida' })
      .nullish()
      .transform((v) => (v ? stripControl(v).replace(/\n{3,}/g, '\n\n').trim() || null : null))
      .pipe(z.string().max(LIMITS.bioMax, `Use no máximo ${LIMITS.bioMax} caracteres`).nullable()),
    titleCode: z.string().max(40).nullish().transform((v) => v || null),
  })
  .partial();

export const PRIVACY_KEYS = [
  'isPublic',
  'showFavorites',
  'showAchievements',
  'showActivity',
  'showPlayStats',
  'showLibrary',
  'showWishlist',
  'showOriginalValue',
  'showPaidTotal',
  'showSavings',
  'showStoreRanking',
];

export const privacySchema = z
  .strictObject(Object.fromEntries(PRIVACY_KEYS.map((key) => [key, z.boolean({ error: 'Use verdadeiro ou falso' })])))
  .partial();

const uuidField = (what) => z.uuid(`${what} inválido`);

export const favoriteAddSchema = z.object({
  gameId: uuidField('Jogo'),
  showOnProfile: z.boolean().optional().default(true),
});
export const favoritePatchSchema = z.object({ showOnProfile: z.boolean({ error: 'Valor inválido' }) });
export const favoritesOrderSchema = z.object({
  gameIds: z.array(uuidField('Jogo')).min(1, 'Informe a ordem dos favoritos').max(500),
});

export const collectionSchema = z.object({
  name: displayText('Informe o nome da coleção', LIMITS.collectionNameMax).refine(
    (v) => normalizeKey(v) !== '',
    'Use pelo menos uma letra ou número',
  ),
  description: optionalText(LIMITS.collectionDescriptionMax),
  isPublic: z.boolean({ error: 'Valor inválido' }).optional().default(false),
  coverGameId: uuidField('Jogo').nullish().transform((v) => v ?? null),
});
export const collectionPatchSchema = z.object({
  name: collectionSchema.shape.name.optional(),
  description: optionalText(LIMITS.collectionDescriptionMax).optional(),
  isPublic: z.boolean({ error: 'Valor inválido' }).optional(),
  coverGameId: uuidField('Jogo').nullable().optional(),
});
export const collectionItemsSchema = z.object({
  gameIds: z.array(uuidField('Jogo')).min(1, 'Escolha pelo menos um jogo').max(500),
});

const optionalDateTime = z.coerce
  .date({ error: 'Horário inválido' })
  .nullish()
  .transform((v) => v ?? null);

export const sessionSchema = z
  .object({
    gameId: uuidField('Jogo'),
    playedOn: isoDateField('Informe a data da sessão'),
    durationMinutes: z
      .number({ error: 'Duração inválida' })
      .int('Duração inválida')
      .nullish()
      .transform((v) => v ?? null),
    startedAt: optionalDateTime,
    endedAt: optionalDateTime,
    notes: optionalText(LIMITS.sessionNotesMax),
  })
  .transform((s, ctx) => {
    if (s.startedAt && s.endedAt && s.endedAt <= s.startedAt) {
      ctx.addIssue({ code: 'custom', path: ['endedAt'], message: 'O fim precisa ser depois do início' });
      return z.NEVER;
    }
    const fromInterval = s.startedAt && s.endedAt ? Math.round((s.endedAt - s.startedAt) / 60000) : null;
    const durationMinutes = s.durationMinutes ?? fromInterval;
    if (durationMinutes === null) {
      ctx.addIssue({
        code: 'custom',
        path: ['durationMinutes'],
        message: 'Informe a duração (horas e minutos) ou o início e o fim',
      });
      return z.NEVER;
    }
    if (durationMinutes < 1 || durationMinutes > LIMITS.sessionMaxMinutes) {
      ctx.addIssue({ code: 'custom', path: ['durationMinutes'], message: 'Uma sessão precisa ter entre 1 minuto e 24 horas' });
      return z.NEVER;
    }
    return { ...s, durationMinutes };
  });

export const priceEntrySchema = z.object({
  price: moneyField.refine((v) => v !== null, 'Informe o preço encontrado'),
  store: optionalLookupName,
  recordedOn: isoDateField('Informe a data em que viu o preço'),
  note: optionalText(LIMITS.priceNoteMax),
});

export const goalSchema = z
  .object({
    name: displayText('Dê um nome para a meta', LIMITS.goalNameMax),
    type: z.enum(GOAL_TYPE_VALUES, { error: 'Escolha o tipo de meta' }),
    startsOn: isoDateField('Informe o início do período'),
    endsOn: isoDateField('Informe o fim do período'),
    targetValue: z
      .number({ error: 'Informe o objetivo' })
      .int('Use um número inteiro')
      .min(1, 'O objetivo precisa ser pelo menos 1')
      .max(100_000, 'Objetivo grande demais'),
    categoryName: z
      .string()
      .max(LIMITS.categoryMax, `Use no máximo ${LIMITS.categoryMax} caracteres`)
      .nullish()
      .transform((v) => (v ? cleanDisplayName(v) || null : null)),
  })
  .transform((g, ctx) => {
    if (g.endsOn < g.startsOn) {
      ctx.addIssue({ code: 'custom', path: ['endsOn'], message: 'O fim precisa ser igual ou depois do início' });
      return z.NEVER;
    }
    if (g.type === 'COMPLETE_CATEGORY' && !normalizeKey(g.categoryName)) {
      ctx.addIssue({ code: 'custom', path: ['categoryName'], message: 'Informe a categoria' });
      return z.NEVER;
    }
    return g.type === 'COMPLETE_CATEGORY' ? g : { ...g, categoryName: null };
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
