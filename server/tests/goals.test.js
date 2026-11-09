// Metas pessoais com progresso real.
import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { prisma, resetDb, ownerAgent, ownedGame, createGame } from './helpers.js';
import { todayIn } from '../../shared/domain.js';

const year = todayIn('America/Sao_Paulo').slice(0, 4);
const yearGoal = (overrides = {}) => ({
  name: `Zerar 2 jogos em ${year}`,
  type: 'COMPLETE_GAMES',
  startsOn: `${year}-01-01`,
  endsOn: `${year}-12-31`,
  targetValue: 2,
  ...overrides,
});

describe('metas', () => {
  let agent;
  let userId;
  beforeEach(async () => {
    await resetDb();
    agent = await ownerAgent();
    userId = (await prisma.user.findFirstOrThrow()).id;
  });
  afterAll(() => prisma.$disconnect());

  it('progresso usa jogos zerados no período e conclui com XP uma vez', async () => {
    const goal = (await agent.post('/api/goals').send(yearGoal())).body;
    expect(goal).toMatchObject({ progress: 0, status: 'ACTIVE', percent: 0 });
    const a = await createGame(agent, ownedGame({ title: 'A' }));
    const b = await createGame(agent, ownedGame({ title: 'B' }));
    await agent.patch(`/api/games/${a.id}`).send({ playStatus: 'COMPLETED' });
    let list = (await agent.get('/api/goals')).body.items;
    expect(list[0]).toMatchObject({ progress: 1, percent: 50, status: 'ACTIVE' });
    await agent.patch(`/api/games/${b.id}`).send({ playStatus: 'COMPLETED' });
    list = (await agent.get('/api/goals')).body.items;
    expect(list[0]).toMatchObject({ progress: 2, status: 'COMPLETED' });
    expect(list[0].completedAt).toBeTruthy();
    const goalXp = await prisma.xpTransaction.findMany({ where: { userId, source: 'GOAL_COMPLETED' } });
    expect(goalXp).toHaveLength(1);
    // Desmarcar e remarcar não paga a meta de novo
    await agent.patch(`/api/games/${b.id}`).send({ playStatus: 'PLAYING' });
    await agent.patch(`/api/games/${b.id}`).send({ playStatus: 'COMPLETED' });
    expect(await prisma.xpTransaction.count({ where: { userId, source: 'GOAL_COMPLETED' } })).toBe(1);
    expect(await prisma.playerActivity.count({ where: { userId, type: 'GOAL_COMPLETED' } })).toBe(1);
  });

  it('criar e editar metas não dá XP por si só', async () => {
    await agent.get('/api/profile');
    const before = await prisma.xpTransaction.aggregate({ where: { userId }, _sum: { amount: true } });
    const g = (await agent.post('/api/goals').send(yearGoal({ targetValue: 50 }))).body;
    for (const n of [40, 30, 20]) await agent.patch(`/api/goals/${g.id}`).send({ targetValue: n });
    const after = await prisma.xpTransaction.findMany({ where: { userId } });
    // Só a conquista "Planejador" (primeira meta) entra
    expect(after.map((x) => x.eventKey)).toEqual(['achievement:planner']);
    expect(before._sum.amount ?? 0).toBe(0);
  });

  it('horas no ano vêm do diário; categoria e acervo usam os dados reais', async () => {
    const rpg = await createGame(agent, ownedGame({ title: 'RPG', categories: ['RPG'] }));
    const hours = (await agent.post('/api/goals').send(yearGoal({ name: 'Jogar 3 h', type: 'PLAY_HOURS', targetValue: 3 }))).body;
    const category = (
      await agent.post('/api/goals').send(yearGoal({ name: '1 RPG', type: 'COMPLETE_CATEGORY', targetValue: 1, categoryName: 'rpg' }))
    ).body;
    await agent.post('/api/sessions').send({ gameId: rpg.id, playedOn: `${year}-01-10`, durationMinutes: 200 });
    await agent.patch(`/api/games/${rpg.id}`).send({ playStatus: 'COMPLETED' });
    const items = (await agent.get('/api/goals')).body.items;
    expect(items.find((g) => g.id === hours.id)).toMatchObject({ progress: 3, status: 'COMPLETED' });
    expect(items.find((g) => g.id === category.id)).toMatchObject({ progress: 1, status: 'COMPLETED' });
  });

  it('valida a meta e mostra metas antigas como encerradas', async () => {
    const bad = await agent.post('/api/goals').send({ name: '', type: 'COMPLETE_CATEGORY', startsOn: '2026-05-01', endsOn: '2026-01-01', targetValue: 0 });
    expect(bad.status).toBe(400);
    const old = (await agent.post('/api/goals').send(yearGoal({ name: 'Antiga', startsOn: '2020-01-01', endsOn: '2020-12-31' }))).body;
    expect(old.status).toBe('CLOSED');
    const filtered = (await agent.get('/api/goals?year=2020')).body.items;
    expect(filtered.map((g) => g.name)).toEqual(['Antiga']);
  });

  it('não acessa metas de outro usuário', async () => {
    const g = (await agent.post('/api/goals').send(yearGoal())).body;
    const other = await ownerAgent({ email: 'outro@biblioteca.test', password: 'outra-senha-123456' });
    expect((await other.patch(`/api/goals/${g.id}`).send({ targetValue: 1 })).status).toBe(404);
    expect((await other.delete(`/api/goals/${g.id}`)).status).toBe(404);
  });
});
