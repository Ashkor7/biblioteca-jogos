import { Router } from 'express';
import { requireAuth, requireReader } from '../middleware/auth.js';
import { imageUpload } from '../middleware/upload.js';
import { parseOrThrow } from '../lib/validate.js';
import { featuredSchema } from '../../../shared/schemas.js';
import * as games from '../services/gameService.js';
import * as images from '../services/imageService.js';

export function gamesRouter() {
  const router = Router();

  router.get('/', requireReader, async (req, res) => {
    res.json(await games.listGames(req.viewerId, req.query));
  });

  router.post('/', requireAuth, imageUpload.single('cover'), async (req, res) => {
    const game = await games.createGame(req.user.id, games.readGamePayload(req), req.file);
    res.status(201).location(`/api/games/${game.id}`).json(game);
  });

  router.get('/:id', requireReader, async (req, res) => {
    res.json(await games.getGame(req.viewerId, req.params.id));
  });

  router.patch('/:id', requireAuth, async (req, res) => {
    res.json(await games.updateGame(req.user.id, req.params.id, req.body));
  });

  router.delete('/:id', requireAuth, async (req, res) => {
    await games.deleteGame(req.user.id, req.params.id);
    res.status(204).end();
  });

  router.patch('/:id/featured', requireAuth, async (req, res) => {
    const { isFeatured } = parseOrThrow(featuredSchema, req.body);
    res.json(await games.setFeatured(req.user.id, req.params.id, isFeatured));
  });

  router.patch('/:id/mark-purchased', requireAuth, async (req, res) => {
    res.json(await games.markPurchased(req.user.id, req.params.id, req.body));
  });

  // Imagens: multipart (campo "images", vários arquivos) ou JSON { url, isCover } para URL externa.
  router.post('/:id/images', requireAuth, imageUpload.array('images'), async (req, res) => {
    const result = req.is('multipart/form-data')
      ? await images.addUploadedImages(req.user.id, req.params.id, req.files, {
          makeCover: req.body?.cover === 'true',
        })
      : await images.addExternalImage(req.user.id, req.params.id, req.body);
    res.status(201).json(result);
  });

  router.put('/:id/images/order', requireAuth, async (req, res) => {
    res.json(await images.reorderImages(req.user.id, req.params.id, req.body));
  });

  router.patch('/:id/images/:imageId', requireAuth, async (req, res) => {
    res.json(await images.updateImage(req.user.id, req.params.id, req.params.imageId, req.body));
  });

  router.delete('/:id/images/:imageId', requireAuth, async (req, res) => {
    res.json(await images.deleteImage(req.user.id, req.params.id, req.params.imageId));
  });

  return router;
}
