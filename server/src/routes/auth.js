import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { config } from '../config.js';
import { AppError } from '../lib/errors.js';
import { parseOrThrow } from '../lib/validate.js';
import { loginSchema, registerSchema } from '../../../shared/schemas.js';
import { verifyCredentials, registerUser } from '../services/authService.js';
import { issueSession, clearSession } from '../middleware/auth.js';

export function authRouter() {
  const router = Router();
  const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: config.LOGIN_RATE_LIMIT,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    handler: (_req, _res, next) =>
      next(new AppError(429, 'Muitas tentativas de login. Aguarde alguns minutos e tente de novo.')),
  });

  router.post('/login', loginLimiter, async (req, res) => {
    const { email, password } = parseOrThrow(loginSchema, req.body);
    const user = await verifyCredentials(email, password);
    issueSession(res, user);
    res.json({ user });
  });

  const signupLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    limit: config.SIGNUP_RATE_LIMIT,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    handler: (_req, _res, next) => next(new AppError(429, 'Muitos cadastros deste endereço. Tente de novo mais tarde.')),
  });

  router.post('/register', signupLimiter, async (req, res) => {
    if (!config.ALLOW_SIGNUP) throw new AppError(403, 'O cadastro de novas contas está desativado neste site.', { code: 'SIGNUP_DISABLED' });
    if (req.user) throw new AppError(409, 'Você já está conectado. Saia para criar outra conta.');
    const { email, password } = parseOrThrow(registerSchema, req.body);
    const user = await registerUser(email, password);
    issueSession(res, user);
    res.status(201).json({ user });
  });

  router.post('/logout', (_req, res) => {
    clearSession(res);
    res.status(204).end();
  });

  router.get('/me', (req, res) => {
    res.json({ user: req.user, publicAppUrl: config.PUBLIC_APP_URL ?? null, signupEnabled: config.ALLOW_SIGNUP });
  });

  return router;
}
