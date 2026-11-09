import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { prisma } from '../db.js';
import { AppError } from '../lib/errors.js';

export const SESSION_COOKIE = 'bj_session';

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
 * Leitura das rotas administrativas: só o proprietário autenticado.
 * Até a v2, PUBLIC_READ=true abria estas rotas a qualquer visitante — inclusive
 * preços pagos e lojas. Visitantes agora usam /api/public/*, que devolve apenas o
 * que o perfil público autoriza (publicService).
 */
export function requireReader(req, _res, next) {
  if (!req.user) throw new AppError(401, 'Faça login para ver a biblioteca');
  req.viewerId = req.user.id;
  next();
}
