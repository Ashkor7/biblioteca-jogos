import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { prisma } from '../db.js';
import { AppError } from '../lib/errors.js';

export const SESSION_COOKIE = 'bj_session';
const NIL_UUID = '00000000-0000-0000-0000-000000000000';

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    secure: config.cookieSecure,
    sameSite: 'lax',
    path: '/',
    maxAge: config.SESSION_TTL_HOURS * 60 * 60 * 1000,
  };
}

export function issueSession(res, user) {
  const token = jwt.sign({ sub: user.id }, config.SESSION_SECRET, {
    expiresIn: `${config.SESSION_TTL_HOURS}h`,
    algorithm: 'HS256',
  });
  res.cookie(SESSION_COOKIE, token, sessionCookieOptions());
}

export function clearSession(res) {
  const { maxAge: _ignored, ...options } = sessionCookieOptions();
  res.clearCookie(SESSION_COOKIE, options);
}

/** Lê o cookie de sessão (se houver) e popula req.user. Nunca bloqueia. */
export async function attachUser(req, _res, next) {
  const token = req.cookies?.[SESSION_COOKIE];
  req.user = null;
  if (token) {
    try {
      const payload = jwt.verify(token, config.SESSION_SECRET, { algorithms: ['HS256'] });
      req.user = await prisma.user.findUnique({
        where: { id: payload.sub },
        select: { id: true, email: true, createdAt: true },
      });
    } catch {
      req.user = null;
    }
  }
  next();
}

/** Escrita: somente o proprietário autenticado. */
export function requireAuth(req, _res, next) {
  if (!req.user) throw new AppError(401, 'Faça login para alterar a biblioteca');
  next();
}

/**
 * Leitura: proprietário autenticado ou, se PUBLIC_READ=true, visitante em modo
 * somente leitura vendo a coleção do proprietário.
 */
export async function requireReader(req, _res, next) {
  if (req.user) {
    req.viewerId = req.user.id;
    return next();
  }
  if (!config.PUBLIC_READ) throw new AppError(401, 'Faça login para ver a biblioteca');
  const owner = await prisma.user.findFirst({ orderBy: { createdAt: 'asc' }, select: { id: true } });
  req.viewerId = owner?.id ?? NIL_UUID;
  next();
}
