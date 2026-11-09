// Diário de jogatina: horas = saldo legado + sessões, sem contar nada duas vezes.
import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { prisma, resetDb, ownerAgent, ownedGame, createGame } from './helpers.js';

describe('diário de jogatina', () => {
  let agent;
  let game;
  beforeEach(async () => {
    await resetDb();
    agent = await ownerAgent();
    game = await createGame(agent, ownedGame({ playTimeMinutes: 600 })); // 10 h antigas
  });
  afterAll(() => prisma.$disconnect());

  const session = (overrides = {}) => ({ gameId: game.id, playedOn: '2026-11-09', durationMinutes: 150, ...overrides });
  const reload = async () => (await agent.get(`/api/games/${game.id}`)).body;

  it('preserva as horas antigas como saldo e soma as sessões', async () => {
    expect(game).toMatchObject({ playTimeMinutes: 600, legacyPlayMinutes: 600, sessionMinutes: 0 });
    const res = await agent.post('/api/sessions').send(session({ notes: 'Missão secundária' }));
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ playedOn: '2026-11-09', durationMinutes: 150, notes: 'Missão secundária' });
    expect(await reload()).toMatchObject({ playTimeMinutes: 750, legacyPlayMinutes: 600, sessionMinutes: 150 });
    const stats = (await agent.get('/api/statistics/overview')).body;
    expect(stats.playTime.totalMinutes).toBe(750);
  });

  it('editar e excluir sessões recalcula o total sem duplicar', async () => {
    const a = (await agent.post('/api/sessions').send(session())).body;
    await agent.post('/api/sessions').send(session({ durationMinutes: 30 }));
    expect((await reload()).playTimeMinutes).toBe(780);
    const edited = await agent.patch(`/api/sessions/${a.id}`).send({ durationMinutes: 60 });
    expect(edited.status).toBe(200);
    expect((await reload()).playTimeMinutes).toBe(690);
    // Editar de novo com o mesmo valor não muda nada
    await agent.patch(`/api/sessions/${a.id}`).send({ durationMinutes: 60 });
    expect((await reload()).playTimeMinutes).toBe(690);
    expect((await agent.delete(`/api/sessions/${a.id}`)).status).toBe(204);
    expect(await reload()).toMatchObject({ playTimeMinutes: 630, legacyPlayMinutes: 600 });
  });

  it('calcula a duração pelo início e fim', async () => {
    const res = await agent
      .post('/api/sessions')
      .send({ gameId: game.id, playedOn: '2026-11-09', startedAt: '2026-11-09T20:00:00Z', endedAt: '2026-11-09T22:30:00Z' });
    expect(res.status).toBe(201);
    expect(res.body.durationMinutes).toBe(150);
    const bad = await agent
      .post('/api/sessions')
      .send({ gameId: game.id, playedOn: '2026-11-09', startedAt: '2026-11-09T22:00:00Z', endedAt: '2026-11-09T20:00:00Z' });
    expect(bad.status).toBe(400);
    expect(bad.body.error.fields.endedAt).toBeDefined();
  });

  it('valida duração, data e jogo', async () => {
    const empty = await agent.post('/api/sessions').send({ gameId: game.id, playedOn: '2026-11-09' });
    expect(empty.body.error.fields.durationMinutes).toBeDefined();
    const tooLong = await agent.post('/api/sessions').send(session({ durationMinutes: 24 * 60 + 1 }));
    expect(tooLong.status).toBe(400);
    const future = await agent.post('/api/sessions').send(session({ playedOn: '2099-01-01' }));
    expect(future.body.error.fields.playedOn).toMatch(/futuro/);
    const wish = await createGame(agent, { title: 'Desejo', ownershipStatus: 'WISHLIST', platform: 'Steam' });
    const onWish = await agent.post('/api/sessions').send(session({ gameId: wish.id }));
    expect(onWish.body.error.fields.gameId).toMatch(/adquiridos/);
  });

  it('o total editado no jogo ajusta só o saldo antigo e não pode ficar abaixo das sessões', async () => {
    await agent.post('/api/sessions').send(session()); // 150 min
    const ok = await agent.patch(`/api/games/${game.id}`).send({ playTimeMinutes: 900 });
    expect(ok.body).toMatchObject({ playTimeMinutes: 900, legacyPlayMinutes: 750, sessionMinutes: 150 });
    const bad = await agent.patch(`/api/games/${game.id}`).send({ playTimeMinutes: 100 });
    expect(bad.status).toBe(400);
    expect(bad.body.error.fields.playTimeMinutes).toMatch(/diário/);
  });

  it('mudar o estado do jogo não apaga as sessões', async () => {
    await agent.post('/api/sessions').send(session());
    await agent.patch(`/api/games/${game.id}`).send({ playStatus: 'PLAYING' });
    await agent.patch(`/api/games/${game.id}`).send({ playStatus: 'COMPLETED' });
    const list = await agent.get(`/api/sessions?gameId=${game.id}`);
    expect(list.body.total).toBe(1);
    expect((await reload()).playTimeMinutes).toBe(750);
  });

  it('lista, filtra por período e resume semana/mês', async () => {
    await agent.post('/api/sessions').send(session({ playedOn: '2026-11-02', durationMinutes: 60 }));
    await agent.post('/api/sessions').send(session({ playedOn: '2026-11-09', durationMinutes: 90 }));
    await agent.post('/api/sessions').send(session({ playedOn: '2026-10-30', durationMinutes: 45 }));
    const filtered = await agent.get('/api/sessions?from=2026-11-01&to=2026-11-30');
    expect(filtered.body).toMatchObject({ total: 2, totalMinutes: 150 });
    expect(filtered.body.items.map((s) => s.playedOn)).toEqual(['2026-11-09', '2026-11-02']);
    const summary = await agent.get('/api/sessions/summary?month=2026-11');
    expect(summary.body.month).toMatchObject({ minutes: 150, activeDays: 2, sessions: 2 });
    expect(summary.body.topGames[0]).toMatchObject({ id: game.id, minutes: 195, sessions: 3 });
    expect(summary.body.allTime.activeDays).toBe(3);
  });

  it('sessão gera atividade e conquista "Diário Aberto" uma vez', async () => {
    await agent.post('/api/sessions').send(session());
    await agent.post('/api/sessions').send(session({ durationMinutes: 20 }));
    const user = await prisma.user.findFirstOrThrow();
    expect(await prisma.playerActivity.count({ where: { userId: user.id, type: 'SESSION_LOGGED' } })).toBe(2);
    expect(await prisma.userAchievement.count({ where: { userId: user.id, code: 'first-session' } })).toBe(1);
  });

  it('outro usuário não registra sessão no meu jogo nem vê as minhas', async () => {
    await agent.post('/api/sessions').send(session());
    const other = await ownerAgent({ email: 'outro@biblioteca.test', password: 'outra-senha-123456' });
    const res = await other.post('/api/sessions').send(session());
    expect(res.status).toBe(400);
    expect((await other.get('/api/sessions')).body.total).toBe(0);
    const mine = (await agent.get('/api/sessions')).body.items[0];
    expect((await other.patch(`/api/sessions/${mine.id}`).send({ durationMinutes: 1 })).status).toBe(404);
    expect((await other.delete(`/api/sessions/${mine.id}`)).status).toBe(404);
  });
});
