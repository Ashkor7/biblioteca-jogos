// Dashboard financeiro 2.0: mesmas fórmulas da visão geral, agrupadas por período.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma, resetDb, ownerAgent, ownedGame, createGame } from './helpers.js';

describe('dashboard financeiro', () => {
  let agent;
  beforeAll(async () => {
    await resetDb();
    agent = await ownerAgent();
    await createGame(agent, ownedGame({ title: 'A', originalPrice: '200', paidPrice: '100', purchasedAt: '2026-01-15', store: 'Nuuvem', platform: 'Steam' }));
    await createGame(agent, ownedGame({ title: 'B', originalPrice: '100', paidPrice: '80', purchasedAt: '2026-01-20', store: 'Steam', platform: 'Steam' }));
    // Pago acima da referência: reduz a economia
    await createGame(agent, ownedGame({ title: 'C', originalPrice: '50', paidPrice: '70', purchasedAt: '2026-03-02', store: 'Amazon', platform: 'Switch', mediaType: 'PHYSICAL' }));
    await createGame(agent, ownedGame({ title: 'D', originalPrice: '60', paidPrice: '30', purchasedAt: '2025-12-31', store: 'Nuuvem', platform: 'Steam' }));
    // Sem data
    await createGame(agent, ownedGame({ title: 'E', originalPrice: '40', paidPrice: '10', purchasedAt: null, store: 'Nuuvem', platform: 'Steam' }));
    // Desejo: nunca é compra
    await createGame(agent, { title: 'W', ownershipStatus: 'WISHLIST', platform: 'Steam', originalPrice: '999', currentWishPrice: '500' });
  });
  afterAll(() => prisma.$disconnect());

  it('totais batem com a visão geral e excluem a lista de desejos', async () => {
    const [finance, overview] = await Promise.all([agent.get('/api/statistics/finance'), agent.get('/api/statistics/overview')]);
    expect(finance.status).toBe(200);
    const t = finance.body.totals;
    expect(t).toMatchObject({
      purchases: 5,
      pricedPurchases: 5,
      originalTotal: '450.00',
      paidTotal: '290.00',
      savings: '160.00',
      overpaidGames: 1,
      undatedPurchases: 1,
      averagePaid: '58.00',
    });
    expect(t.weightedDiscountPercent).toBeCloseTo(35.56, 2);
    expect(overview.body.finance).toMatchObject({ originalTotal: t.originalTotal, paidTotal: t.paidTotal, savings: t.savings });
  });

  it('agrupa por mês e ano, com acumulado e "sem data" à parte', async () => {
    const { monthly, yearly, undated } = (await agent.get('/api/statistics/finance')).body;
    expect(monthly.map((m) => [m.period, m.paidTotal, m.savings, m.cumulativePaid])).toEqual([
      ['2025-12', '30.00', '30.00', '30.00'],
      ['2026-01', '180.00', '120.00', '210.00'],
      ['2026-03', '70.00', '-20.00', '280.00'],
    ]);
    expect(yearly.map((y) => [y.period, y.purchases])).toEqual([['2025', 1], ['2026', 3]]);
    expect(undated).toMatchObject({ purchases: 1, paidTotal: '10.00', savings: '30.00' });
  });

  it('filtra por ano, mês, loja e plataforma', async () => {
    const year = (await agent.get('/api/statistics/finance?year=2026')).body;
    expect(year.totals).toMatchObject({ purchases: 3, paidTotal: '250.00', savings: '100.00' });
    expect(year.undated).toBeNull();
    const jan = (await agent.get('/api/statistics/finance?year=2026&month=1')).body;
    expect(jan.totals.paidTotal).toBe('180.00');
    const stores = (await agent.get('/api/statistics/finance')).body.stores;
    const nuuvem = stores.find((s) => s.name === 'Nuuvem');
    const byStore = (await agent.get(`/api/statistics/finance?storeId=${nuuvem.id}`)).body;
    expect(byStore.totals).toMatchObject({ purchases: 3, paidTotal: '140.00' });
    const switchId = (await agent.get('/api/platforms')).body.items.find((p) => p.name === 'Switch').id;
    const bySwitch = (await agent.get(`/api/statistics/finance?platformId=${switchId}`)).body;
    expect(bySwitch.totals).toMatchObject({ savings: '-20.00', overpaidGames: 1 });
    expect((await agent.get('/api/statistics/finance?month=3')).status).toBe(400);
  });

  it('ranking das maiores economias individuais (só positivas)', async () => {
    const top = (await agent.get('/api/statistics/finance')).body.topSavings;
    expect(top.map((g) => [g.title, g.savings])).toEqual([
      ['A', '100.00'],
      ['D', '30.00'],
      ['E', '30.00'],
      ['B', '20.00'],
    ]);
    expect(top[0].discountPercent).toBe(50);
  });

  it('jogos com dados incompletos não distorcem os totais', async () => {
    await prisma.game.create({
      data: {
        ownerId: (await prisma.user.findFirstOrThrow()).id,
        title: 'Importado',
        platformId: (await prisma.platform.findFirstOrThrow({ where: { name: 'Steam' } })).id,
        ownershipStatus: 'OWNED',
        originalPrice: '300',
        needsReview: true,
      },
    });
    const t = (await agent.get('/api/statistics/finance')).body.totals;
    expect(t).toMatchObject({ purchases: 6, pricedPurchases: 5, incompleteGames: 1, originalTotal: '450.00' });
  });
});
