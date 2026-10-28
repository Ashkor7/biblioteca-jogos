// Teste F — fórmulas exatas da especificação.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma, resetDb, ownerAgent, createGame } from './helpers.js';

describe('estatísticas (teste F)', () => {
  let agent;
  beforeAll(async () => {
    await resetDb();
    agent = await ownerAgent();
    await createGame(agent, {
      title: 'Jogo A', ownershipStatus: 'OWNED', mediaType: 'DIGITAL', platform: 'Steam', store: 'Nuuvem',
      originalPrice: '200', paidPrice: '120', playTimeMinutes: 600, categories: ['RPG', 'Ação'], playStatus: 'COMPLETED',
    });
    await createGame(agent, {
      title: 'Jogo B', ownershipStatus: 'OWNED', mediaType: 'DIGITAL', platform: 'Xbox', store: 'Instant Gaming',
      originalPrice: '100', paidPrice: '70', playTimeMinutes: 300, categories: ['Ação'], playStatus: 'NOT_STARTED',
    });
    await createGame(agent, {
      title: 'Jogo C', ownershipStatus: 'WISHLIST', platform: 'Steam', currentWishPrice: '90', originalPrice: '120',
    });
  });
  afterAll(() => prisma.$disconnect());

  it('visão geral', async () => {
    const res = await agent.get('/api/statistics/overview');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      library: { owned: 2, completed: 1, notStarted: 1, abandoned: 0, physical: 0, digital: 2 },
      wishlist: { count: 1, currentValue: '90.00', withoutPrice: 0, isPartial: false },
      finance: {
        originalTotal: '300.00',
        paidTotal: '190.00',
        savings: '110.00',
        discountPercent: 36.67,
        overpaidGames: 0,
        pendingPriceReview: 0,
      },
      playTime: { totalMinutes: 900 },
    });
  });

  it('horas por categoria (podem somar mais que o total)', async () => {
    const res = (await agent.get('/api/statistics/categories')).body;
    const hours = Object.fromEntries(res.items.map((c) => [c.name, c.minutes / 60]));
    expect(hours).toEqual({ Ação: 15, RPG: 10 });
    expect(res.totalMinutes / 60).toBe(15);
    expect(res.note).toMatch(/pode passar do total/);
  });

  it('compras por loja com economia', async () => {
    const res = (await agent.get('/api/statistics/stores')).body;
    const byName = Object.fromEntries(res.items.map((s) => [s.name, s]));
    expect(byName.Nuuvem).toMatchObject({ games: 1, savings: '80.00', originalTotal: '200.00', paidTotal: '120.00', discountPercent: 40 });
    expect(byName['Instant Gaming']).toMatchObject({ games: 1, savings: '30.00', discountPercent: 30 });
    const bySavings = (await agent.get('/api/statistics/stores?sort=savings')).body.items.map((s) => s.name);
    expect(bySavings).toEqual(['Nuuvem', 'Instant Gaming']);
    const byPercent = (await agent.get('/api/statistics/stores?sort=percent')).body.items.map((s) => s.name);
    expect(byPercent).toEqual(['Nuuvem', 'Instant Gaming']);
  });

  it('plataforma e loja são dimensões diferentes', async () => {
    const res = (await agent.get('/api/statistics/platforms')).body.items;
    expect(res.map((p) => [p.name, p.games])).toEqual([
      ['Steam', 1],
      ['Xbox', 1],
    ]);
  });

  it('estatísticas locais de uma plataforma', async () => {
    const steam = (await agent.get('/api/platforms/steam')).body;
    const res = (await agent.get(`/api/statistics/overview?platformId=${steam.id}`)).body;
    expect(res.library.owned).toBe(1);
    expect(res.wishlist.count).toBe(1);
    expect(res.finance.paidTotal).toBe('120.00');
  });

  it('gasto acima da referência aparece como economia negativa', async () => {
    const g = await createGame(agent, {
      title: 'Colecionador', ownershipStatus: 'OWNED', mediaType: 'PHYSICAL', platform: 'Xbox', store: 'Mercado Livre',
      originalPrice: '100', paidPrice: '150',
    });
    const stores = (await agent.get('/api/statistics/stores')).body.items;
    expect(stores.find((s) => s.name === 'Mercado Livre')).toMatchObject({ savings: '-50.00', discountPercent: -50, overpaidGames: 1 });
    await agent.delete(`/api/games/${g.id}`).expect(204);
    const after = (await agent.get('/api/statistics/overview')).body;
    expect(after.finance.paidTotal).toBe('190.00');
  });
});
