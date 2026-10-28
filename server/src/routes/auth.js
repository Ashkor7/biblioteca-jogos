import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { config } from '../config.js';
import { AppError } from '../lib/errors.js';
import { parseOrThrow } from '../lib/validate.js';
import { loginSchema } from '../../../shared/schemas.js';
import { verifyCredentials } from '../services/authService.js';
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

  router.post('/logout', (_req, res) => {
    clearSession(res);
    res.status(204).end();
  });

  router.get('/me', (req, res) => {
    res.json({ user: req.user, publicRead: config.PUBLIC_READ });
  });

  return router;
}
