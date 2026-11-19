import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { config } from './config.js';
import { prisma } from './db.js';
import { PROJECT_ROOT } from './env.js';
import { attachUser } from './middleware/auth.js';
import { verifyOrigin } from './middleware/origin.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { getStorage, isStorageKey } from './lib/storage.js';
import { authRouter } from './routes/auth.js';
import { gamesRouter } from './routes/games.js';
import {
  platformsRouter,
  storesRouter,
  categoriesRouter,
  wishlistRouter,
  statisticsRouter,
  importRouter,
} from './routes/catalog.js';
import {
  profileRouter,
  favoritesRouter,
  sessionsRouter,
  collectionsRouter,
  goalsRouter,
  progressionRouter,
  priceRouter,
  financeRouter,
  publicRouter,
} from './routes/player.js';
import { steamRouter } from './routes/steam.js';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  if (config.TRUST_PROXY) app.set('trust proxy', 1);

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
          styleSrc: ["'self'", "'unsafe-inline'"],
          fontSrc: ["'self'", 'data:'],
          connectSrc: ["'self'"],
          objectSrc: ["'none'"],
          frameAncestors: ["'none'"],
        },
      },
    }),
  );
  app.use(cors({ origin: config.allowedOrigins, credentials: true }));
  app.use(cookieParser());

  const smallJson = express.json({ limit: '1mb' });
  const importJson = express.json({ limit: `${config.LEGACY_IMPORT_MAX_MB}mb` });
  app.use((req, res, next) => (req.path.startsWith('/api/import') ? importJson : smallJson)(req, res, next));

  app.use(attachUser);
  app.use('/api', verifyOrigin);

  app.get('/api/health', async (_req, res) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      res.json({ status: 'ok', database: 'ok' });
    } catch {
      res.status(503).json({ status: 'degraded', database: 'unavailable' });
    }
  });

  app.use('/api/auth', authRouter());
  app.use('/api/games/:id/prices', priceRouter());
  app.use('/api/games', gamesRouter());
  app.use('/api/platforms', platformsRouter());
  app.use('/api/stores', storesRouter());
  app.use('/api/categories', categoriesRouter());
  app.use('/api/wishlist', wishlistRouter());
  app.use('/api/statistics', statisticsRouter());
  app.use('/api/import', importRouter());
  app.use('/api/statistics/finance', financeRouter());
  app.use('/api/profile', profileRouter());
  app.use('/api/favorites', favoritesRouter());
  app.use('/api/sessions', sessionsRouter());
  app.use('/api/collections', collectionsRouter());
  app.use('/api/goals', goalsRouter());
  app.use('/api/progression', progressionRouter());
  app.use('/api/public', publicRouter());
  app.use('/api/steam', steamRouter());
  app.use('/api', notFoundHandler);

  // Imagens: pasta local servida direto, ou objetos do R2 lidos pela API (bucket privado).
  if (config.STORAGE_DRIVER === 'local') {
    app.use('/uploads', express.static(config.uploadDir, { index: false, dotfiles: 'deny', maxAge: '7d', immutable: true }));
  } else {
    app.get('/uploads/:key', async (req, res, next) => {
      try {
        if (!isStorageKey(req.params.key)) return res.status(404).end();
        const file = await getStorage().get(req.params.key);
        if (!file) return res.status(404).end();
        res.set({
          'Content-Type': file.mime,
          'Cache-Control': 'public, max-age=31536000, immutable',
          'X-Content-Type-Options': 'nosniff',
          ...(file.size ? { 'Content-Length': String(file.size) } : {}),
        });
        file.body.on('error', next);
        file.body.pipe(res);
      } catch (error) {
        next(error);
      }
    });
  }

  // Produção: a própria API serve o build do Vite (um único processo/porta).
  const distDir = path.join(PROJECT_ROOT, 'dist');
  if (config.isProduction && fs.existsSync(path.join(distDir, 'index.html'))) {
    app.use(express.static(distDir, { index: false, maxAge: '1h' }));
    app.get('/{*path}', (_req, res) => res.sendFile(path.join(distDir, 'index.html')));
  }

  app.use(errorHandler);
  return app;
}
