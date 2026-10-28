import { Router } from 'express';
import { requireAuth, requireReader } from '../middleware/auth.js';
import * as catalog from '../services/catalogService.js';
import * as games from '../services/gameService.js';
import * as stats from '../services/statisticsService.js';
import { importLegacy } from '../services/legacyImportService.js';

export function platformsRouter() {
  const router = Router();
  router.get('/', requireReader, async (req, res) => {
    res.json({ items: await catalog.listPlatforms(req.viewerId) });
  });
  router.get('/:slug', requireReader, async (req, res) => {
    res.json(await catalog.getPlatformBySlug(req.viewerId, req.params.slug));
  });
  router.patch('/:id', requireAuth, async (req, res) => {
    res.json(await catalog.renamePlatform(req.user.id, req.params.id, req.body));
  });
  return router;
}

export function storesRouter() {
  const router = Router();
  router.get('/', requireReader, async (req, res) => {
    res.json({ items: await catalog.listStores(req.viewerId) });
  });
  return router;
}

export function categoriesRouter() {
  const router = Router();
  router.get('/', requireReader, async (req, res) => {
    res.json({ items: await catalog.listCategories(req.viewerId) });
  });
  return router;
}

export function wishlistRouter() {
  const router = Router();
  router.get('/', requireReader, async (req, res) => {
    res.json(await games.listGames(req.viewerId, { sort: 'title', ...req.query, ownership: 'WISHLIST' }));
  });
  return router;
}

export function statisticsRouter() {
  const router = Router();
  router.use(requireReader);
  router.get('/overview', async (req, res) => res.json(await stats.overview(req.viewerId, req.query)));
  router.get('/platforms', async (req, res) => res.json(await stats.byPlatform(req.viewerId)));
  router.get('/stores', async (req, res) => res.json(await stats.byStore(req.viewerId, req.query)));
  router.get('/categories', async (req, res) => res.json(await stats.byCategory(req.viewerId)));
  return router;
}

export function importRouter() {
  const router = Router();
  router.post('/legacy', requireAuth, async (req, res) => {
    res.json(await importLegacy(req.user.id, req.body));
  });
  return router;
}
