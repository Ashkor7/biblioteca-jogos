// Progressão: curva de XP, idempotência, conquistas e processamento retroativo.
import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { prisma, resetDb, ownerAgent, ownedGame, createGame } from './helpers.js';
import { xpForLevel, levelForXp, levelProgress, XP_RULES } from '../../shared/progression.js';

describe('curva de XP (unidade)', () => {
  it('cada nível pede 100 XP a mais que o anterior', () => {
    expect([1, 2, 3, 4, 5, 10].map(xpForLevel)).toEqual([0, 100, 300, 600, 1000, 4500]);
    expect(levelForXp(0)).toBe(1);
    expect(levelForXp(99)).toBe(1);
    expect(levelForXp(100)).toBe(2);
    expect(levelForXp(1850)).toBe(6);
  });

  it('barra de progresso do nível', () => {
    expect(levelProgress(150)).toMatchObject({ level: 2, levelStartXp: 100, nextLevelXp: 300, xpIntoLevel: 50, xpForNext: 150, percent: 25 });
  });
});

describe('progressão (API)', () => {
  let agent;
  let userId;
  beforeEach(async () => {
    await resetDb();
    agent = await ownerAgent();
    userId = (await prisma.user.findFirstOrThrow()).id;
  });
  afterAll(() => prisma.$disconnect());

  const ledger = () => prisma.xpTransaction.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } });

  it('primeiro jogo desbloqueia "Primeira Aquisição" uma única vez', async () => {
    await createGame(agent, ownedGame());
    await createGame(agent, ownedGame({ title: 'Hades' }));
    const achievements = await prisma.userAchievement.findMany({ where: { userId } });
    expect(achievements.map((a) => a.code)).toEqual(['first-acquisition']);
    const xp = await ledger();
    expect(xp.filter((x) => x.eventKey === 'achievement:first-acquisition')).toHaveLength(1);
    const activities = await prisma.playerActivity.count({ where: { userId, type: 'ACHIEVEMENT_UNLOCKED' } });
    expect(activities).toBe(1);
  });

  it('zerar, desmarcar e zerar de novo não paga XP nem cria atividade duas vezes', async () => {
    const game = await createGame(agent, ownedGame());
    for (const status of ['COMPLETED', 'NOT_STARTED', 'COMPLETED', 'PLAYING', 'COMPLETED']) {
      const res = await agent.patch(`/api/games/${game.id}`).send({ playStatus: status });
      expect(res.status).toBe(200);
    }
    const xp = await ledger();
    expect(xp.filter((x) => x.eventKey === `game-completed:${game.id}`)).toHaveLength(1);
    expect(await prisma.playerActivity.count({ where: { userId, type: 'GAME_COMPLETED' } })).toBe(1);
    expect(await prisma.playerActivity.count({ where: { userId, type: 'GAME_STARTED' } })).toBe(1);
    const profile = await agent.get('/api/profile');
    const total = xp.reduce((s, x) => s + x.amount, 0);
    expect(profile.body.progress.totalXp).toBe(total);
  });

  it('editar o mesmo jogo várias vezes não gera XP', async () => {
    const game = await createGame(agent, ownedGame({ ratingStars: 4 }));
    const before = (await ledger()).length;
    for (const title of ['A', 'B', 'C']) await agent.patch(`/api/games/${game.id}`).send({ title, ratingStars: 5 });
    expect((await ledger()).length).toBe(before);
  });

  it('limite em janela de 24 h para jogos zerados', async () => {
    const cap = XP_RULES.GAME_COMPLETED.cap;
    for (let i = 0; i < cap + 2; i += 1) {
      await createGame(agent, ownedGame({ title: `Jogo ${i}`, playStatus: 'COMPLETED' }));
    }
    const completedXp = (await ledger()).filter((x) => x.source === 'GAME_COMPLETED');
    expect(completedXp).toHaveLength(cap);
  });

  it('processa a biblioteca existente retroativamente, sem duplicar', async () => {
    // Simula dados de antes da v3: jogos criados direto no banco, sem perfil.
    const platform = await prisma.platform.create({ data: { name: 'Steam', normalizedName: 'steam', slug: 'steam' } });
    for (let i = 0; i < 12; i += 1) {
      await prisma.game.create({
        data: {
          ownerId: userId,
          title: `Antigo ${i}`,
          platformId: platform.id,
          ownershipStatus: 'OWNED',
          playStatus: i < 7 ? 'COMPLETED' : 'NOT_STARTED',
          playTimeMinutes: 600,
          legacyPlayMinutes: 600,
        },
      });
    }
    const first = await agent.get('/api/profile');
    expect(first.status).toBe(200);
    const codes = (await prisma.userAchievement.findMany({ where: { userId } })).map((a) => a.code).sort();
    expect(codes).toEqual(['collector-10', 'first-acquisition', 'first-completed', 'marathoner']);
    const retro = await prisma.userAchievement.findMany({ where: { userId, retroactive: true } });
    expect(retro).toHaveLength(4);
    // Retroativo: os 7 jogos zerados pagam, mesmo acima do limite diário.
    expect((await ledger()).filter((x) => x.source === 'GAME_COMPLETED' && x.retroactive)).toHaveLength(7);
    const xpAfterFirst = first.body.progress.totalXp;

    const again = await agent.get('/api/profile');
    await agent.post('/api/progression/rebuild');
    expect(again.body.progress.totalXp).toBe(xpAfterFirst);
    expect((await agent.get('/api/profile')).body.progress.totalXp).toBe(xpAfterFirst);
    // Eventos retroativos não viram aviso na tela.
    expect((await agent.get('/api/progression/notifications')).body.items).toEqual([]);
  });

  it('avisos aparecem uma vez e somem depois de confirmados', async () => {
    await agent.get('/api/profile'); // perfil criado antes (sem retroativos)
    await createGame(agent, ownedGame());
    const pending = await agent.get('/api/progression/notifications');
    expect(pending.body.items.map((i) => i.type)).toContain('ACHIEVEMENT_UNLOCKED');
    const upTo = pending.body.items.at(-1).occurredAt;
    expect((await agent.post('/api/progression/notifications/ack').send({ upTo })).status).toBe(204);
    expect((await agent.get('/api/progression/notifications')).body.items).toEqual([]);
  });

  it('subir de nível registra a atividade de nível', async () => {
    await agent.get('/api/profile');
    await createGame(agent, ownedGame({ playStatus: 'COMPLETED', ratingStars: 5 }));
    const profile = (await agent.get('/api/profile')).body;
    // 50 (Primeira Aquisição) + 50 (Primeiro Finalizado) + 50 (zerou) + 10 (nota) = 160 → nível 2
    expect(profile.progress).toMatchObject({ totalXp: 160, level: 2 });
    expect(await prisma.playerActivity.count({ where: { userId, type: 'LEVEL_UP' } })).toBe(1);
  });

  it('lista conquistas com progresso real e não confia no cliente', async () => {
    await createGame(agent, ownedGame({ playTimeMinutes: 73 * 60 }));
    const res = await agent.get('/api/progression/achievements');
    const marathoner = res.body.items.find((a) => a.code === 'marathoner');
    expect(marathoner).toMatchObject({ current: 73, target: 100, percent: 73, unlocked: false, xp: 150 });
    // Não existe rota para o cliente desbloquear conquistas ou somar XP.
    expect((await agent.post('/api/progression/achievements').send({ code: 'marathoner' })).status).toBe(404);
  });

  it('título bloqueado não pode ser escolhido; desbloqueado pode', async () => {
    const locked = await agent.patch('/api/profile').send({ titleCode: 'lenda-da-biblioteca' });
    expect(locked.status).toBe(400);
    expect(locked.body.error.fields.titleCode).toMatch(/bloqueado/);
    const ok = await agent.patch('/api/profile').send({ titleCode: 'novato-digital' });
    expect(ok.status).toBe(200);
    expect(ok.body.title).toEqual({ code: 'novato-digital', name: 'Novato Digital' });
  });
});
