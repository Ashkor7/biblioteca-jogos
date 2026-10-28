// Teste C — lista de desejos separada e conversão em compra.
import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { prisma, resetDb, ownerAgent, ownedGame, createGame } from './helpers.js';

const wish = (overrides = {}) => ({
  title: 'Elden Ring',
  ownershipStatus: 'WISHLIST',
  platform: 'PS5',
  originalPrice: '249,90',
  currentWishPrice: '149,90',
  categories: ['Soulslike'],
  ...overrides,
});

describe('lista de desejos', () => {
  let agent;
  beforeEach(async () => {
    await resetDb();
    agent = await ownerAgent();
  });
  afterAll(() => prisma.$disconnect());

  it('não exige preço pago, loja nem mídia — e grava esses campos como nulos', async () => {
    const game = await createGame(agent, wish({ mediaType: 'PHYSICAL', paidPrice: '10', store: 'Amazon' }));
    expect(game).toMatchObject({
      ownershipStatus: 'WISHLIST',
      mediaType: null,
      paidPrice: null,
      store: null,
      currentWishPrice: '149.90',
      originalPrice: '249.90',
    });
    expect(game.wishPriceUpdatedAt).toBeTruthy();
    expect(await prisma.store.count()).toBe(0);
  });

  it('aparece só em /api/wishlist e não conta como adquirido nem gasto', async () => {
    await createGame(agent, ownedGame());
    await createGame(agent, wish({ playStatus: 'COMPLETED', playTimeMinutes: 600 }));
    const wishlist = await agent.get('/api/wishlist');
    expect(wishlist.body.items.map((g) => g.title)).toEqual(['Elden Ring']);
    const owned = await agent.get('/api/games?ownership=OWNED');
    expect(owned.body.items.map((g) => g.title)).toEqual(['Cyberpunk 2077']);

    const stats = (await agent.get('/api/statistics/overview')).body;
    expect(stats.library).toMatchObject({ owned: 1, completed: 0 });
    expect(stats.finance).toMatchObject({ originalTotal: '199.90', paidTotal: '79.90' });
    expect(stats.playTime.totalMinutes).toBe(0);
    expect(stats.wishlist).toMatchObject({ count: 1, currentValue: '149.90', withoutPrice: 0, isPartial: false });
  });

  it('valor atual é parcial quando há itens sem preço informado', async () => {
    await createGame(agent, wish());
    await createGame(agent, wish({ title: 'Hollow Knight Silksong', currentWishPrice: null }));
    const stats = (await agent.get('/api/statistics/overview')).body;
    expect(stats.wishlist).toMatchObject({ count: 2, currentValue: '149.90', withoutPrice: 1, isPartial: true });
  });

  it('atualizar o preço atual renova a data de atualização', async () => {
    const game = await createGame(agent, wish());
    await new Promise((r) => setTimeout(r, 20));
    const res = await agent.patch(`/api/games/${game.id}`).send({ currentWishPrice: '129,90' });
    expect(res.body.currentWishPrice).toBe('129.90');
    expect(new Date(res.body.wishPriceUpdatedAt) > new Date(game.wishPriceUpdatedAt)).toBe(true);
    const same = await agent.patch(`/api/games/${game.id}`).send({ title: 'Elden Ring GOTY' });
    expect(same.body.wishPriceUpdatedAt).toBe(res.body.wishPriceUpdatedAt);
  });

  it('marcar como comprado exige mídia, preço pago e loja', async () => {
    const game = await createGame(agent, wish());
    const res = await agent.patch(`/api/games/${game.id}/mark-purchased`).send({});
    expect(res.status).toBe(400);
    expect(Object.keys(res.body.error.fields)).toEqual(expect.arrayContaining(['mediaType', 'paidPrice', 'store']));
  });

  it('exige preço original se o desejo não tinha referência', async () => {
    const game = await createGame(agent, wish({ originalPrice: null }));
    const res = await agent
      .patch(`/api/games/${game.id}/mark-purchased`)
      .send({ mediaType: 'DIGITAL', paidPrice: '100', store: 'PS Store' });
    expect(res.status).toBe(400);
    expect(res.body.error.fields.originalPrice).toBeDefined();
  });

  it('converte em compra e atualiza todos os contadores', async () => {
    const game = await createGame(agent, wish());
    const res = await agent
      .patch(`/api/games/${game.id}/mark-purchased`)
      .send({ mediaType: 'PHYSICAL', paidPrice: '159,90', store: 'Amazon' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      ownershipStatus: 'OWNED',
      mediaType: 'PHYSICAL',
      originalPrice: '249.90',
      paidPrice: '159.90',
      store: { name: 'Amazon' },
      currentWishPrice: null,
      priceDifference: '90.00',
    });
    expect(res.body.purchasedAt).toBeTruthy();
    expect((await agent.get('/api/wishlist')).body.total).toBe(0);
    const stats = (await agent.get('/api/statistics/overview')).body;
    expect(stats.library.owned).toBe(1);
    expect(stats.wishlist.count).toBe(0);
    expect(stats.finance).toMatchObject({ originalTotal: '249.90', paidTotal: '159.90', savings: '90.00' });
    const stores = (await agent.get('/api/statistics/stores')).body.items;
    expect(stores).toEqual([expect.objectContaining({ name: 'Amazon', games: 1, savings: '90.00' })]);

    const again = await agent.patch(`/api/games/${game.id}/mark-purchased`).send({
      mediaType: 'PHYSICAL', paidPrice: '1', store: 'X',
    });
    expect(again.status).toBe(409);
  });
});
