import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';
import { config } from '../config.js';
import { AppError } from '../lib/errors.js';
import { parseOrThrow } from '../lib/validate.js';
import { requireAuth } from '../middleware/auth.js';
import * as account from '../services/steamAccountService.js';

const flag = (fallback) =>
  z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => (v === undefined ? fallback : v === 'true'));

const unlinkQuery = z.object({ keepAppIds: flag(true) });

/** Limite por usuário nas rotas que chamam a Steam (a Steam também limita a nossa chave). */
export function steamLimiter() {
  return rateLimit({
    windowMs: 60 * 1000,
    limit: config.STEAM_RATE_LIMIT,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    keyGenerator: (req) => `steam:${req.user.id}`,
    handler: (_req, _res, next) =>
      next(new AppError(429, 'Muitas consultas à Steam seguidas. Aguarde um minuto e tente de novo.')),
  });
}

export function steamRouter() {
  const router = Router();
  const limited = steamLimiter();
  // Tudo aqui é do usuário logado: leitura e escrita exigem sessão.
  router.use(requireAuth);

  router.get('/account', async (req, res) => {
    res.json(await account.getSteamStatus(req.user.id));
  });
  router.post('/account/lookup', limited, async (req, res) => {
    res.json(await account.lookupSteamProfile(req.body));
  });
  router.put('/account', limited, async (req, res) => {
    res.json(await account.linkSteamAccount(req.user.id, req.body));
  });
  router.delete('/account', async (req, res) => {
    const { keepAppIds } = parseOrThrow(unlinkQuery, req.query, 'Opção inválida');
    res.json(await account.unlinkSteamAccount(req.user.id, { keepAppIds }));
  });

  return router;
}
