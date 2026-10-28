import { config } from '../config.js';
import { AppError } from '../lib/errors.js';

const SAFE = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Proteção CSRF complementar ao cookie SameSite=Lax: requisições que alteram
 * dados vindas de navegadores precisam ter Origin igual ao do app.
 */
export function verifyOrigin(req, _res, next) {
  if (SAFE.has(req.method)) return next();
  const origin = req.get('origin');
  if (!origin) return next(); // clientes sem navegador (curl, testes) não enviam Origin
  const self = `${req.protocol}://${req.get('host')}`;
  if (origin === self || config.allowedOrigins.includes(origin)) return next();
  throw new AppError(403, 'Origem da requisição não permitida');
}
