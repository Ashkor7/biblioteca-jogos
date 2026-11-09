// Lista de desejos avançada: preço-alvo, prioridade, histórico manual e conversão.
import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { prisma, resetDb, ownerAgent, createGame } from './helpers.js';

const wish = (overrides = {}) => ({
  title: 'Elden Ring',
  ownershipStatus: 'WISHLIST',
  platform: 'PS5',
  originalPrice: '249,90',
  targetPrice: '120,00',
  wishPriority: 'HIGH',
  preferredStore: 'PS Store',
  wishNotes: 'Esperar a DLC',
  ...overrides,
});

describe('lista de desejos avançada', () => {
  let agent;
  beforeEach(async () => {
    await resetDb();
    agent = await ownerAgent();
  });
  afterAll(() => prisma.$disconnect());

  it('guarda preço-alvo, prioridade, loja preferida e notas sem violar a regra de desejo', async () => {
    const game = await createGame(agent, wish());
    expect(game).toMatchObject({
      targetPrice: '120.00',
      wishPriority: 'HIGH',
      preferredStore: { name: 'PS Store' },
      wishNotes: 'Esperar a DLC',
      store: null,
      paidPrice: null,
    });
    // A loja preferida não some no pruneOrphans enquanto for usada
    expect(await prisma.store.count()).toBe(1);
  });

  it('histórico manual: menor, maior, último e diferença para o alvo', async () => {
    const game = await createGame(agent, wish());
    const add = (price, recordedOn, store) => agent.post(`/api/games/${game.id}/prices`).send({ price, recordedOn, store });
    expect((await add('199,90', '2026-09-01', 'PS Store')).status).toBe(201);
    await add('149,90', '2026-10-01', 'Nuuvem');
    const last = await add('129,90', '2026-11-01');
    expect(last.body).toMatchObject({
      lowest: '129.90',
      highest: '199.90',
      latest: { price: '129.90', recordedOn: '2026-11-01' },
      differenceToTarget: '9.90',
      targetState: 'ABOVE',
    });
    expect(last.body.entries.map((e) => e.price)).toEqual(['199.90', '149.90', '129.90']);
    // O último preço informado do jogo acompanha o histórico
    const reloaded = (await agent.get(`/api/games/${game.id}`)).body;
    expect(reloaded.currentWishPrice).toBe('129.90');
    const at = await add('120', '2026-11-05');
    expect(at.body.targetState).toBe('AT');
    const below = await add('99,90', '2026-11-08');
    expect(below.body.targetState).toBe('BELOW');
    // Um preço registrado com data antiga não vira o "último"
    const older = await add('300', '2026-01-01');
    expect(older.body.latest.price).toBe('99.90');
    const removed = await agent.delete(`/api/games/${game.id}/prices/${below.body.latest.id}`);
    expect(removed.body.latest.price).toBe('120.00');
  });

  it('valida o registro de preço', async () => {
    const game = await createGame(agent, wish());
    const res = await agent.post(`/api/games/${game.id}/prices`).send({ price: '-1', recordedOn: '2026-13-40' });
    expect(res.status).toBe(400);
    expect(Object.keys(res.body.error.fields).sort()).toEqual(['price', 'recordedOn']);
  });

  it('filtra por prioridade, loja preferida, preço e alvo atingido', async () => {
    const a = await createGame(agent, wish({ title: 'A', currentWishPrice: '100' }));
    await createGame(agent, wish({ title: 'B', wishPriority: 'LOW', currentWishPrice: '200', preferredStore: 'Steam' }));
    const high = await agent.get('/api/wishlist?priority=HIGH');
    expect(high.body.items.map((g) => g.title)).toEqual(['A']);
    const reached = await agent.get('/api/wishlist?targetReached=true');
    expect(reached.body.items.map((g) => g.id)).toEqual([a.id]);
    const cheap = await agent.get('/api/wishlist?maxPrice=150');
    expect(cheap.body.items.map((g) => g.title)).toEqual(['A']);
    const steam = (await agent.get('/api/stores')).body.items;
    expect(steam).toEqual([]); // loja preferida não é "loja onde comprou"
    const byPriority = await agent.get('/api/wishlist?sort=priority');
    expect(byPriority.body.items.map((g) => g.title)).toEqual(['A', 'B']);
  });

  it('converte em compra no mesmo registro, preserva o histórico e registra a atividade', async () => {
    const game = await createGame(agent, wish({ currentWishPrice: '150' }));
    await agent.post(`/api/games/${game.id}/prices`).send({ price: '130', recordedOn: '2026-11-01' });
    const res = await agent
      .patch(`/api/games/${game.id}/mark-purchased`)
      .send({ mediaType: 'DIGITAL', paidPrice: '125,00', store: 'PS Store', purchasedAt: '2026-11-09' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: game.id, ownershipStatus: 'OWNED', paidPrice: '125.00' });
    expect(await prisma.game.count()).toBe(1);
    expect(await prisma.wishlistPriceEntry.count({ where: { gameId: game.id } })).toBe(2);
    const user = await prisma.user.findFirstOrThrow();
    expect(await prisma.playerActivity.count({ where: { userId: user.id, type: 'WISHLIST_PURCHASED' } })).toBe(1);
    expect(await prisma.userAchievement.count({ where: { userId: user.id, code: 'smart-buyer' } })).toBe(1);
    const stats = (await agent.get('/api/statistics/overview')).body;
    expect(stats.finance).toMatchObject({ paidTotal: '125.00', originalTotal: '249.90' });
    // Repetir a conversão é recusado e não duplica nada
    const again = await agent.patch(`/api/games/${game.id}/mark-purchased`).send({ mediaType: 'DIGITAL', paidPrice: '1', store: 'X' });
    expect(again.status).toBe(409);
    expect(await prisma.playerActivity.count({ where: { userId: user.id, type: 'WISHLIST_PURCHASED' } })).toBe(1);
    // Histórico continua consultável; novos preços não entram depois da compra
    expect((await agent.get(`/api/games/${game.id}/prices`)).body.entries).toHaveLength(2);
    expect((await agent.post(`/api/games/${game.id}/prices`).send({ price: '1', recordedOn: '2026-11-09' })).status).toBe(409);
  });
});
