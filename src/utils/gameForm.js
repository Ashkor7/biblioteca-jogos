// Conversão entre o formulário (textos digitados) e o contrato da API.
// A validação usa o MESMO esquema Zod do servidor (shared/schemas.js).
import { validateGame } from '../../shared/schemas.js';
import { hoursToMinutes } from '../../shared/domain.js';
import { moneyToInput, minutesToInput } from './format.js';

export const emptyGameForm = {
  title: '',
  condition: '',
  platform: '',
  store: '',
  originalPrice: '',
  paidPrice: '',
  currentWishPrice: '',
  purchasedAt: '',
  playStatus: 'NOT_STARTED',
  hours: '',
  ratingStars: null,
  reviewText: '',
  categories: [],
  coverUrl: '',
};

export function gameToForm(game) {
  return {
    title: game.title,
    condition: game.ownershipStatus === 'WISHLIST' ? 'WISHLIST' : (game.mediaType ?? ''),
    platform: game.platform.name,
    store: game.store?.name ?? '',
    originalPrice: moneyToInput(game.originalPrice),
    paidPrice: moneyToInput(game.paidPrice),
    currentWishPrice: moneyToInput(game.currentWishPrice),
    purchasedAt: game.purchasedAt ? game.purchasedAt.slice(0, 10) : '',
    playStatus: game.playStatus,
    hours: minutesToInput(game.playTimeMinutes),
    ratingStars: game.ratingStars,
    reviewText: game.reviewText ?? '',
    categories: game.categories.map((c) => c.name),
    coverUrl: '',
  };
}

const blankToNull = (v) => (typeof v === 'string' && v.trim() === '' ? null : v);

/** Valores do formulário → payload da API. */
export function formToPayload(values) {
  const wishlist = values.condition === 'WISHLIST';
  const minutes = hoursToMinutes(values.hours);
  return {
    title: values.title,
    ownershipStatus: values.condition ? (wishlist ? 'WISHLIST' : 'OWNED') : undefined,
    mediaType: wishlist || !values.condition ? null : values.condition,
    platform: values.platform,
    store: wishlist ? null : blankToNull(values.store),
    originalPrice: blankToNull(values.originalPrice),
    paidPrice: wishlist ? null : blankToNull(values.paidPrice),
    currentWishPrice: wishlist ? blankToNull(values.currentWishPrice) : null,
    purchasedAt: wishlist ? null : blankToNull(values.purchasedAt),
    playStatus: values.playStatus,
    playTimeMinutes: minutes === null ? 0 : minutes,
    ratingStars: values.ratingStars ?? null,
    reviewText: blankToNull(values.reviewText),
    categories: values.categories,
    coverUrl: blankToNull(values.coverUrl),
  };
}

// Nome do campo na API → nome do campo no formulário
const FIELD_MAP = {
  ownershipStatus: 'condition',
  mediaType: 'condition',
  playTimeMinutes: 'hours',
};

export function apiFieldsToForm(fields = {}) {
  const out = {};
  for (const [key, message] of Object.entries(fields)) {
    const formKey = FIELD_MAP[key] ?? key.split('.')[0];
    if (!out[formKey]) out[formKey] = message;
  }
  return out;
}

/** Resolver do react-hook-form usando o contrato compartilhado. */
export function makeGameResolver({ allowIncompletePurchase = false } = {}) {
  return async (values) => {
    const errors = {};
    if (!values.condition) errors.condition = 'Escolha Físico, Digital ou Lista de desejos';
    if (Number.isNaN(hoursToMinutes(values.hours))) errors.hours = 'Use números, ex.: 12,5';
    const payload = formToPayload(values);
    const result = validateGame(payload, { allowIncompletePurchase });
    if (!result.success) {
      for (const [key, message] of Object.entries(apiFieldsToForm(result.fields))) {
        errors[key] ??= message;
      }
    }
    if (Object.keys(errors).length) {
      return {
        values: {},
        errors: Object.fromEntries(Object.entries(errors).map(([k, message]) => [k, { type: 'validate', message }])),
      };
    }
    return { values, errors: {} };
  };
}
