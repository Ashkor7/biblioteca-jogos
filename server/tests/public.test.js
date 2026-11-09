// Perfil público: somente leitura e somente o que o dono autorizou.
import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { prisma, request, app, resetDb, ownerAgent, ownedGame, createGame, OWNER } from './helpers.js';

const SENSITIVE = ['dono@biblioteca.test', 'passwordHash', 'paidPrice', 'originalPrice', 'purchasedAt', 'reviewText', 'Nuuvem', 'email', 'ownerId', 'userId'];

describe('perfil público', () => {
  let agent;
  let anon;
  let game;
  beforeEach(async () => {
    await resetDb();
    agent = await ownerAgent();
    anon = request(app);
    game = await createGame(agent, ownedGame({ playStatus: 'COMPLETED', ratingStars: 5, reviewText: 'Segredo da resenha', playTimeMinutes: 300 }));
    await createGame(agent, { title: 'Desejo secreto', ownershipStatus: 'WISHLIST', platform: 'PS5', currentWishPrice: '99' });
    await agent.post('/api/favorites').send({ gameId: game.id });
    await agent.patch('/api/profile').send({ username: 'ashkor', displayName: 'Ashkor', bio: 'Jogador' });
  });
  afterAll(() => prisma.$disconnect());

  it('perfil privado (padrão) responde 404 igual a um inexistente', async () => {
    const priv = await anon.get('/api/public/profiles/ashkor');
    const missing = await anon.get('/api/public/profiles/nao-existe');
    expect(priv.status).toBe(404);
    expect(missing.status).toBe(404);
    expect(priv.body).toEqual(missing.body);
  });

  it('público com padrões: sem finanças, sem biblioteca, sem desejos, sem atividades', async () => {
    await agent.patch('/api/profile/privacy').send({ isPublic: true });
    const res = await anon.get('/api/public/profiles/ashkor');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ username: 'ashkor', displayName: 'Ashkor', bio: 'Jogador', level: expect.any(Number) });
    expect(Object.keys(res.body.sections).sort()).toEqual(['achievements', 'collections', 'favorites', 'playStats']);
    expect(res.body.sections.favorites[0]).toMatchObject({ title: 'Cyberpunk 2077', ratingStars: 5, playStatus: 'COMPLETED' });
    const text = JSON.stringify(res.body);
    for (const word of SENSITIVE) expect(text).not.toContain(word);
    expect(text).not.toContain('Desejo secreto');
    expect(text).not.toContain('Segredo da resenha');
    expect(res.headers['cache-control']).toBe('no-store');
  });

  it('cada controle de privacidade é aplicado no servidor', async () => {
    await agent.patch('/api/profile/privacy').send({
      isPublic: true,
      showFavorites: false,
      showAchievements: false,
      showPlayStats: false,
      showActivity: true,
      showPaidTotal: true,
      showStoreRanking: true,
      showLibrary: true,
      showWishlist: true,
    });
    const s = (await anon.get('/api/public/profiles/ashkor')).body.sections;
    expect(s.favorites).toBeUndefined();
    expect(s.achievements).toBeUndefined();
    expect(s.playStats).toBeUndefined();
    expect(s.finance).toEqual({ paidTotal: '79.90' }); // original e economia continuam ocultos
    expect(s.storeRanking).toEqual([{ name: 'Nuuvem', purchases: 1 }]);
    expect(s.library.items[0]).not.toHaveProperty('playTimeMinutes'); // sem estatísticas de jogatina
    expect(s.library.items[0]).not.toHaveProperty('paidPrice');
    expect(s.wishlist.items.map((g) => g.title)).toEqual(['Desejo secreto']);
    expect(Object.keys(s.wishlist.items[0]).sort()).toEqual(['coverUrl', 'id', 'platform', 'ratingStars', 'title']);
    expect(s.activity.length).toBeGreaterThan(0);
    for (const a of s.activity) expect(Object.keys(a.data).every((k) => ['title', 'name', 'level', 'code', 'rarity', 'stars'].includes(k))).toBe(true);
    // Seções desligadas também não respondem nos endpoints paginados
    await agent.patch('/api/profile/privacy').send({ showLibrary: false });
    expect((await anon.get('/api/public/profiles/ashkor/library')).status).toBe(404);
    expect((await anon.get('/api/public/profiles/ashkor/wishlist')).status).toBe(200);
  });

  it('coleções: só as públicas aparecem e podem ser abertas', async () => {
    await agent.patch('/api/profile/privacy').send({ isPublic: true });
    const pub = (await agent.post('/api/collections').send({ name: 'Pública', isPublic: true })).body;
    const priv = (await agent.post('/api/collections').send({ name: 'Privada' })).body;
    await agent.post(`/api/collections/${pub.id}/items`).send({ gameIds: [game.id] });
    await agent.post(`/api/collections/${priv.id}/items`).send({ gameIds: [game.id] });
    const profile = (await anon.get('/api/public/profiles/ashkor')).body;
    expect(profile.sections.collections.map((c) => c.name)).toEqual(['Pública']);
    const open = await anon.get(`/api/public/profiles/ashkor/collections/${pub.id}`);
    expect(open.body.items.map((g) => g.title)).toEqual(['Cyberpunk 2077']);
    expect((await anon.get(`/api/public/profiles/ashkor/collections/${priv.id}`)).status).toBe(404);
  });

  it('visitante não usa rotas administrativas nem escreve nada', async () => {
    await agent.patch('/api/profile/privacy').send({ isPublic: true, showLibrary: true });
    expect((await anon.post('/api/public/profiles/ashkor').send({})).status).toBe(405);
    for (const [method, url] of [
      ['get', '/api/games'],
      ['get', `/api/games/${game.id}`],
      ['get', '/api/statistics/overview'],
      ['get', '/api/statistics/finance'],
      ['get', '/api/wishlist'],
      ['get', '/api/sessions'],
      ['get', '/api/collections'],
      ['get', '/api/progression/activities'],
      ['patch', `/api/games/${game.id}`],
      ['delete', `/api/games/${game.id}`],
      ['post', '/api/sessions'],
      ['post', '/api/collections'],
      ['post', '/api/goals'],
      ['post', '/api/favorites'],
      ['patch', '/api/profile/privacy'],
      ['post', '/api/progression/rebuild'],
    ]) {
      const res = await anon[method](url).send({});
      expect(res.status, `${method} ${url}`).toBe(401);
    }
    expect(await prisma.game.count()).toBe(2);
  });

  it('prévia do dono mostra o que um visitante veria, mesmo com o perfil privado', async () => {
    const preview = await agent.get('/api/profile/preview');
    expect(preview.status).toBe(200);
    expect(preview.body.isPublic).toBe(false);
    expect(Object.keys(preview.body.sections).sort()).toEqual(['achievements', 'collections', 'favorites', 'playStats']);
    expect(JSON.stringify(preview.body)).not.toContain(OWNER.email);
  });
});
