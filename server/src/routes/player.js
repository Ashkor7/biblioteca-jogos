// Rotas do Player Hub. Tudo aqui exige o proprietário autenticado, exceto publicRouter.
import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { config } from '../config.js';
import { AppError } from '../lib/errors.js';
import { requireAuth } from '../middleware/auth.js';
import { imageUpload } from '../middleware/upload.js';
import * as profiles from '../services/profileService.js';
import * as favorites from '../services/favoriteService.js';
import * as sessions from '../services/sessionService.js';
import * as collections from '../services/collectionService.js';
import * as goals from '../services/goalService.js';
import * as progression from '../services/progressionService.js';
import * as wishlist from '../services/wishlistService.js';
import * as publicProfiles from '../services/publicService.js';
import { listActivities } from '../services/activityService.js';
import * as stats from '../services/statisticsService.js';

export function profileRouter() {
  const router = Router();
  router.use(requireAuth);
  router.get('/', async (req, res) => res.json(await profiles.getOwnProfile(req.user.id)));
  router.patch('/', async (req, res) => res.json(await profiles.updateProfile(req.user.id, req.body)));
  router.patch('/privacy', async (req, res) => res.json(await profiles.updatePrivacy(req.user.id, req.body)));
  router.get('/stats', async (req, res) => res.json(await profiles.profileStats(req.user.id)));
  router.get('/preview', async (req, res) => res.json(await publicProfiles.previewOwnProfile(req.user.id)));
  for (const kind of ['avatar', 'banner']) {
    router.put(`/${kind}`, imageUpload.single('image'), async (req, res) => {
      res.json(await profiles.setProfileImage(req.user.id, kind, req.file));
    });
    router.delete(`/${kind}`, async (req, res) => res.json(await profiles.removeProfileImage(req.user.id, kind)));
  }
  return router;
}

export function favoritesRouter() {
  const router = Router();
  router.use(requireAuth);
  router.get('/', async (req, res) => res.json(await favorites.listFavorites(req.user.id)));
  router.post('/', async (req, res) => res.status(201).json(await favorites.addFavorite(req.user.id, req.body)));
  router.put('/order', async (req, res) => res.json(await favorites.reorderFavorites(req.user.id, req.body)));
  router.patch('/:gameId', async (req, res) => res.json(await favorites.updateFavorite(req.user.id, req.params.gameId, req.body)));
  router.delete('/:gameId', async (req, res) => res.json(await favorites.removeFavorite(req.user.id, req.params.gameId)));
  return router;
}

export function sessionsRouter() {
  const router = Router();
  router.use(requireAuth);
  router.get('/', async (req, res) => res.json(await sessions.listSessions(req.user.id, req.query)));
  router.get('/summary', async (req, res) => res.json(await sessions.diarySummary(req.user.id, req.query)));
  router.post('/', async (req, res) => res.status(201).json(await sessions.createSession(req.user.id, req.body)));
  router.patch('/:id', async (req, res) => res.json(await sessions.updateSession(req.user.id, req.params.id, req.body)));
  router.delete('/:id', async (req, res) => {
    await sessions.deleteSession(req.user.id, req.params.id);
    res.status(204).end();
  });
  return router;
}

export function collectionsRouter() {
  const router = Router();
  router.use(requireAuth);
  router.get('/', async (req, res) => res.json(await collections.listCollections(req.user.id)));
  router.post('/', async (req, res) => res.status(201).json(await collections.createCollection(req.user.id, req.body)));
  router.get('/of-game/:gameId', async (req, res) => res.json(await collections.collectionsOfGame(req.user.id, req.params.gameId)));
  router.get('/:id', async (req, res) => res.json(await collections.getCollection(req.user.id, req.params.id)));
  router.patch('/:id', async (req, res) => res.json(await collections.updateCollection(req.user.id, req.params.id, req.body)));
  router.delete('/:id', async (req, res) => {
    await collections.deleteCollection(req.user.id, req.params.id);
    res.status(204).end();
  });
  router.post('/:id/items', async (req, res) => res.json(await collections.addItems(req.user.id, req.params.id, req.body)));
  router.put('/:id/items/order', async (req, res) => res.json(await collections.reorderItems(req.user.id, req.params.id, req.body)));
  router.delete('/:id/items/:gameId', async (req, res) =>
    res.json(await collections.removeItem(req.user.id, req.params.id, req.params.gameId)),
  );
  return router;
}

export function goalsRouter() {
  const router = Router();
  router.use(requireAuth);
  router.get('/', async (req, res) => res.json(await goals.listGoals(req.user.id, req.query)));
  router.post('/', async (req, res) => res.status(201).json(await goals.createGoal(req.user.id, req.body)));
  router.patch('/:id', async (req, res) => res.json(await goals.updateGoal(req.user.id, req.params.id, req.body)));
  router.delete('/:id', async (req, res) => {
    await goals.deleteGoal(req.user.id, req.params.id);
    res.status(204).end();
  });
  return router;
}

export function progressionRouter() {
  const router = Router();
  router.use(requireAuth);
  router.get('/achievements', async (req, res) => res.json(await progression.listAchievements(req.user.id)));
  router.get('/activities', async (req, res) => res.json(await listActivities(req.user.id, req.query)));
  router.get('/xp', async (req, res) => res.json(await progression.xpHistory(req.user.id, req.query)));
  router.get('/notifications', async (req, res) => res.json(await progression.pendingNotifications(req.user.id)));
  router.post('/notifications/ack', async (req, res) => {
    await progression.acknowledgeNotifications(req.user.id, req.body?.upTo);
    res.status(204).end();
  });
  router.post('/rebuild', async (req, res) => res.json(await progression.rebuild(req.user.id)));
  return router;
}

/** Histórico manual de preços: /api/games/:id/prices */
export function priceRouter() {
  const router = Router({ mergeParams: true });
  router.use(requireAuth);
  router.get('/', async (req, res) => res.json(await wishlist.priceHistory(req.user.id, req.params.id)));
  router.post('/', async (req, res) => res.status(201).json(await wishlist.addPriceEntry(req.user.id, req.params.id, req.body)));
  router.delete('/:entryId', async (req, res) =>
    res.json(await wishlist.deletePriceEntry(req.user.id, req.params.id, req.params.entryId)),
  );
  return router;
}

export function financeRouter() {
  const router = Router();
  router.use(requireAuth);
  router.get('/', async (req, res) => res.json(await stats.finance(req.user.id, req.query)));
  return router;
}

/** Somente leitura e sem sessão: o que o dono autorizou no perfil público. */
export function publicRouter() {
  const router = Router();
  router.use(
    rateLimit({
      windowMs: 60 * 1000,
      limit: config.PUBLIC_RATE_LIMIT,
      standardHeaders: 'draft-7',
      legacyHeaders: false,
      handler: (_req, _res, next) => next(new AppError(429, 'Muitas requisições. Aguarde um pouco e tente de novo.')),
    }),
  );
  router.use((req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') throw new AppError(405, 'O perfil público é somente leitura');
    res.set('Cache-Control', 'no-store');
    res.set('X-Robots-Tag', 'noindex');
    next();
  });
  router.get('/profiles/:username', async (req, res) => res.json(await publicProfiles.getPublicProfile(req.params.username)));
  router.get('/profiles/:username/library', async (req, res) =>
    res.json(await publicProfiles.getPublicGames(req.params.username, 'OWNED', req.query)),
  );
  router.get('/profiles/:username/wishlist', async (req, res) =>
    res.json(await publicProfiles.getPublicGames(req.params.username, 'WISHLIST', req.query)),
  );
  router.get('/profiles/:username/collections/:id', async (req, res) =>
    res.json(await publicProfiles.getPublicCollection(req.params.username, req.params.id)),
  );
  return router;
}
