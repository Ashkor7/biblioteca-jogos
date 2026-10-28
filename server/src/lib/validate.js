import { AppError } from './errors.js';
import { zodFieldErrors, validateGame } from '../../../shared/schemas.js';

/** Valida com Zod e lança 400 com mensagens por campo. */
export function parseOrThrow(schema, data, message = 'Confira os campos destacados') {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new AppError(400, message, { fields: zodFieldErrors(result.error) });
  }
  return result.data;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function assertUuid(value, what = 'Registro') {
  if (!UUID_RE.test(String(value))) throw new AppError(404, `${what} não encontrado`);
  return value;
}

/** Validação completa de jogo (campos + regras entre campos). */
export function validateGameOrThrow(input, options) {
  const result = validateGame(input, options);
  if (!result.success) throw new AppError(400, 'Confira os campos destacados', { fields: result.fields });
  return result.data;
}
