// Prévia, importação e enriquecimento em segundo plano (cliente Steam e downloads falsos).
import { describe, it, expect, beforeEach, afterEach, afterAll } from 'vitest';
import { prisma, resetDb, ownerAgent, ownedGame, createGame, PNG, uploadedFileExists } from './helpers.js';
import { config } from '../src/config.js';
import { setSteamClient } from '../src/services/steamClient.js';
import { setRemoteImageFetch } from '../src/lib/remoteImage.js';
import { processSteamJob, configureSteamRunner } from '../src/services/steamJobRunner.js';
import { fakeSteamClient, STEAM_ID, PRIVATE_STEAM_ID, OTHER_STEAM_ID } from './fixtures/steam.js';

const byApp = (items) => Object.fromEntries(items.map((i) => [i.appId, i]));

describe('importação da Steam', () => {
  let agent;
  let steam;
  let downloads;
  beforeEach(async () => {
    await resetDb();
    agent = await ownerAgent();
    steam = fakeSteamClient();
    setSteamClient(steam);
    downloads = [];
    setRemoteImageFetch(async (url) => {
      downloads.push(url);
      return new Response(PNG, { status: 200 });
    });
    configureSteamRunner({ pauseMs: 0, sleep: async () => {} });
    await agent.put('/api/steam/account').send({ steamId64: STEAM_ID });
  });
  afterEach(() => {
    setSteamClient(null);
    setRemoteImageFetch(null);
  });
  afterAll(() => prisma.$disconnect());

  async function importAll(items, options = {}) {
    const res = await agent.post('/api/steam/import').send({ items, options });
    expect(res.status, JSON.stringify(res.body)).toBe(201);
    return res.body;
  }

  it('classifica cada jogo da conta na prévia', async () => {
    // Já na biblioteca (mesmo appId), possível duplicado (mesmo título), desejo e ignorado.
    const linked = await createGame(agent, ownedGame({ title: 'Portal 2 (antigo)' }));
    await prisma.game.update({ where: { id: linked.id }, data: { steamAppId: 620 } });
    const dup = await createGame(agent, ownedGame({ title: 'HADES' }));
    const wish = await createGame(agent, { title: 'Stardew  Valley', ownershipStatus: 'WISHLIST', platform: 'PC' });
    await prisma.steamIgnoredApp.create({ data: { userId: (await prisma.user.findFirst()).id, appId: 292030, title: 'The Witcher 3' } });
    // Tipo conhecido no cache → "não é jogo"; trilha sonora reconhecida pelo nome.
    await prisma.steamAppCache.create({ data: { appId: 323170, type: 'dlc', data: {} } });

    const res = await agent.post('/api/steam/preview').send({});
    expect(res.status).toBe(200);
    const items = byApp(res.body.items);
    expect(items[620]).toMatchObject({ status: 'EXISTING', match: { gameId: linked.id } });
    expect(items[1145360]).toMatchObject({ status: 'DUPLICATE', match: { gameId: dup.id, title: 'HADES' } });
    expect(items[413150]).toMatchObject({ status: 'WISHLIST', match: { gameId: wish.id, ownershipStatus: 'WISHLIST' } });
    expect(items[292030].status).toBe('IGNORED');
    expect(items[323170]).toMatchObject({ status: 'NOT_GAME', appType: 'dlc' });
    expect(items[440].status).toBe('NOT_GAME');
    expect(items[1057090]).toMatchObject({ status: 'NEW', storeUrl: 'https://store.steampowered.com/app/1057090/' });
    expect(res.body.counts).toMatchObject({ NEW: 1, EXISTING: 1, DUPLICATE: 1, WISHLIST: 1, IGNORED: 1, NOT_GAME: 2 });
    // A prévia só lê: nada foi criado e a loja (appdetails) não foi consultada.
    expect(await prisma.game.count()).toBe(3);
    expect(steam.state.calls.getAppDetails).toBe(0);
  });

  it('explica perfil privado e lista vazia', async () => {
    await agent.put('/api/steam/account').send({ steamId64: PRIVATE_STEAM_ID });
    const priv = await agent.post('/api/steam/preview').send({});
    expect(priv.status).toBe(200);
    expect(priv.body).toMatchObject({ visible: false, total: 0, items: [] });
    expect(priv.body.notice).toMatch(/Detalhes de jogos/);
    const imp = await agent.post('/api/steam/import').send({ items: [{ appId: 620, action: 'IMPORT' }] });
    expect(imp.status).toBe(409);
    expect(imp.body.error.code).toBe('STEAM_PRIVATE');

    steam.state.owned[PRIVATE_STEAM_ID] = { visible: true, games: [] };
    const empty = await agent.post('/api/steam/preview').send({});
    expect(empty.body).toMatchObject({ visible: true, total: 0 });
    expect(empty.body.notice).toMatch(/vazia/);
  });

  it('sem conta vinculada ou sem chave, explica o motivo', async () => {
    await agent.delete('/api/steam/account');
    const unlinked = await agent.post('/api/steam/preview').send({});
    expect(unlinked.status).toBe(409);
    expect(unlinked.body.error.code).toBe('STEAM_NOT_LINKED');

    const saved = config.STEAM_API_KEY;
    config.STEAM_API_KEY = undefined;
    try {
      const res = await agent.post('/api/steam/import').send({ items: [{ appId: 620, action: 'IMPORT' }] });
      expect(res.status).toBe(503);
    } finally {
      config.STEAM_API_KEY = saved;
    }
  });

  it('importa com as regras de mapeamento e é idempotente', async () => {
    const body = await importAll(
      [
        { appId: 620, action: 'IMPORT' },
        { appId: 1145360, action: 'IMPORT' },
        { appId: 292030, action: 'IGNORE' },
        { appId: 99999, action: 'IMPORT' },
      ],
      { platform: 'PC (Steam)', store: 'Steam' },
    );
    expect(body).toMatchObject({ created: 2, linked: 0, ignored: 1 });
    expect(body.skipped).toEqual([{ appId: 99999, reason: expect.stringMatching(/não está na sua conta/) }]);

    const games = (await agent.get('/api/games?source=STEAM&sort=title')).body.items;
    expect(games.map((g) => g.title)).toEqual(['Hades', 'Portal 2']);
    const [hades, portal] = games;
    expect(portal).toMatchObject({
      ownershipStatus: 'OWNED',
      mediaType: 'DIGITAL',
      platform: { name: 'PC (Steam)' },
      store: { name: 'Steam' },
      originalPrice: null,
      paidPrice: null,
      purchasedAt: null,
      needsReview: true,
      playStatus: 'NOT_STARTED',
      playTimeMinutes: 1200,
      legacyPlayMinutes: 1200,
      source: 'STEAM',
      steam: { appId: 620, playtimeMinutes: 1200 },
    });
    expect(hades.playStatus).toBe('PLAYING'); // jogou nas últimas 2 semanas

    // Não entra nas somas de dinheiro.
    const stats = (await agent.get('/api/statistics/overview')).body;
    expect(stats.finance).toMatchObject({ paidTotal: '0.00', pendingPriceReview: 2 });

    // De novo: não duplica nada.
    const again = await importAll([{ appId: 620, action: 'IMPORT' }, { appId: 1145360, action: 'IMPORT' }]);
    expect(again).toMatchObject({ created: 0, jobId: null });
    expect(again.skipped).toHaveLength(2);
    expect(await prisma.game.count({ where: { source: 'STEAM' } })).toBe(2);
    expect(await prisma.steamIgnoredApp.count()).toBe(1);
  });

  it('XP retroativo, uma atividade só e nenhum aviso na tela', async () => {
    await agent.get('/api/profile'); // biblioteca já processada antes da importação
    await importAll(['620', '1145360', '413150', '292030'].map((id) => ({ appId: Number(id), action: 'IMPORT' })));

    // Sem opções: plataforma e loja padrão "Steam" (regressão: o Zod 4 não aplica defaults internos com .default({})).
    const sample = (await agent.get('/api/games?source=STEAM')).body.items[0];
    expect(sample).toMatchObject({ platform: { name: 'Steam', slug: 'steam' }, store: { name: 'Steam' } });

    const activities = await prisma.playerActivity.findMany({ where: { type: { in: ['GAME_ADDED', 'STEAM_IMPORTED'] } } });
    expect(activities).toHaveLength(1);
    expect(activities[0]).toMatchObject({ type: 'STEAM_IMPORTED', data: { count: 4, linked: 0 } });

    const unlocked = await prisma.userAchievement.findMany();
    expect(unlocked.find((a) => a.code === 'first-acquisition')).toMatchObject({ retroactive: true });
    expect(await prisma.xpTransaction.count({ where: { retroactive: false } })).toBe(0);
    expect((await agent.get('/api/progression/notifications')).body.items).toEqual([]);
  });

  it('o job completa os dados em segundo plano, só em campos vazios', async () => {
    const { jobId } = await importAll([{ appId: 620, action: 'IMPORT' }], { screenshots: 5 });
    const before = (await agent.get(`/api/steam/jobs/${jobId}`)).body;
    expect(before).toMatchObject({ status: 'PENDING', total: 1, processed: 0, summary: { created: 1 } });

    await processSteamJob(jobId);
    const job = (await agent.get(`/api/steam/jobs/${jobId}`)).body;
    expect(job).toMatchObject({ status: 'COMPLETED', total: 1, processed: 1, failed: 0, percent: 100 });

    const game = (await agent.get('/api/games?source=STEAM')).body.items[0];
    expect(game).toMatchObject({
      description: 'Portal 2 & o modo cooperativo — puzzles com "portais".',
      developer: 'Valve',
      publisher: 'Valve',
      releaseDate: '2011-04-18',
      releaseDateText: null,
      metacriticScore: 95,
      steam: { achievementsUnlocked: 30, achievementsTotal: 51 },
    });
    expect(game.categories.map((c) => c.name)).toEqual(['Ação', 'Aventura']);
    // Capa + 2 screenshots da allowlist (a 3ª é de outro host e foi descartada).
    expect(game.images).toHaveLength(3);
    expect(game.coverUrl).toMatch(/^\/uploads\/[0-9a-f-]{36}\.png$/);
    expect(uploadedFileExists(game.coverUrl)).toBe(true);
    expect(downloads.every((u) => u.startsWith('https://shared.akamai.steamstatic.com/'))).toBe(true);

    // Processar de novo (API reiniciada) não refaz nada.
    await processSteamJob(jobId);
    expect((await prisma.gameImage.count())).toBe(3);
    expect(steam.state.calls.getAppDetails).toBe(1);
  });

  it('usa o cache compartilhado e guarda a URL da Steam se o download falhar', async () => {
    setRemoteImageFetch(async () => new Response('erro', { status: 500 }));
    const { jobId } = await importAll([{ appId: 1145360, action: 'IMPORT' }], { importAchievements: false, genresAsCategories: false });
    await processSteamJob(jobId);
    const game = (await agent.get('/api/games?source=STEAM')).body.items[0];
    expect(game.coverUrl).toBe('https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1145360/header.jpg');
    expect(game.images[0].external).toBe(true);
    expect(game.categories).toEqual([]);
    expect(game.steam.achievementsTotal).toBeNull();
    expect(await prisma.steamAppCache.count()).toBe(1);

    // Outro usuário importando o mesmo app reaproveita o cache (sem nova chamada à loja).
    const other = await ownerAgent({ email: 'outra@biblioteca.test', password: 'outra-senha-de-teste' });
    steam.state.owned[OTHER_STEAM_ID].games = [{ ...steam.state.owned[STEAM_ID].games[1] }];
    await other.put('/api/steam/account').send({ steamId64: OTHER_STEAM_ID });
    const otherJob = (await other.post('/api/steam/import').send({ items: [{ appId: 1145360, action: 'IMPORT' }] })).body.jobId;
    await processSteamJob(otherJob);
    expect(steam.state.calls.getAppDetails).toBe(1);
  });

  it('falhas da Steam contam como erro no resumo sem parar o job', async () => {
    steam.state.failAppDetails.add(620);
    const { jobId } = await importAll([{ appId: 620, action: 'IMPORT' }, { appId: 413150, action: 'IMPORT' }]);
    await processSteamJob(jobId);
    const job = (await agent.get(`/api/steam/jobs/${jobId}`)).body;
    expect(job).toMatchObject({ status: 'COMPLETED', processed: 2, failed: 1 });
    expect(job.summary.errors).toEqual([{ appId: 620, title: 'Portal 2', message: expect.stringMatching(/Steam/) }]);
    // O jogo continua na biblioteca com os dados básicos.
    expect(await prisma.game.count({ where: { source: 'STEAM' } })).toBe(2);
  });

  it('jogo excluído durante o job vira item ignorado', async () => {
    const { jobId } = await importAll([{ appId: 620, action: 'IMPORT' }]);
    const game = await prisma.game.findFirst();
    await agent.delete(`/api/games/${game.id}`);
    await processSteamJob(jobId);
    const job = await prisma.steamSyncJob.findUnique({ where: { id: jobId }, include: { items: true } });
    expect(job).toMatchObject({ status: 'COMPLETED', processed: 1, failed: 0 });
    expect(job.items[0].status).toBe('SKIPPED');
  });

  it('vincula um possível duplicado ao jogo manual, preenchendo só o que está vazio', async () => {
    const manual = await createGame(agent, ownedGame({ title: 'Hades', developer: 'Meu texto', playTimeMinutes: 600 }));
    await agent.post('/api/sessions').send({ gameId: manual.id, playedOn: '2026-11-01', durationMinutes: 120 });
    const { jobId, linked } = await importAll([{ appId: 1145360, action: 'LINK', gameId: manual.id }]);
    expect(linked).toBe(1);
    await processSteamJob(jobId);

    const game = (await agent.get(`/api/games/${manual.id}`)).body;
    expect(game).toMatchObject({
      source: 'MANUAL',
      title: 'Hades',
      developer: 'Meu texto', // preenchido pelo usuário: não muda
      publisher: 'Supergiant Games',
      paidPrice: '79.90',
      store: { name: 'Nuuvem' },
      needsReview: false,
      // max(720, 3000) = 3000; o diário (120) continua separado do saldo legado
      playTimeMinutes: 3000,
      legacyPlayMinutes: 2880,
      sessionMinutes: 120,
      steam: { appId: 1145360 },
    });
    expect((await agent.post('/api/steam/preview').send({})).body.items.find((i) => i.appId === 1145360).status).toBe('EXISTING');
  });

  it('isola jobs e vínculos entre usuários', async () => {
    const mine = await createGame(agent, ownedGame({ title: 'Hades' }));
    const { jobId } = await importAll([{ appId: 620, action: 'IMPORT' }]);
    const other = await ownerAgent({ email: 'outra@biblioteca.test', password: 'outra-senha-de-teste' });
    expect((await other.get(`/api/steam/jobs/${jobId}`)).status).toBe(404);
    expect((await other.post('/api/steam/preview').send({})).body.error.code).toBe('STEAM_NOT_LINKED');

    await other.put('/api/steam/account').send({ steamId64: STEAM_ID });
    // Não consegue vincular a um jogo de outro usuário nem enxerga a biblioteca dele.
    const res = await other.post('/api/steam/import').send({ items: [{ appId: 1145360, action: 'LINK', gameId: mine.id }] });
    expect(res.body.linked).toBe(0);
    expect(res.body.skipped[0].reason).toMatch(/não encontrado/);
    const preview = (await other.post('/api/steam/preview').send({})).body;
    expect(preview.items.every((i) => i.status === 'NEW' || i.status === 'NOT_GAME')).toBe(true);
    expect((await prisma.game.findUnique({ where: { id: mine.id } })).steamAppId).toBeNull();
  });

  it('valida o corpo da importação', async () => {
    const dup = await agent.post('/api/steam/import').send({ items: [{ appId: 620, action: 'IMPORT' }, { appId: 620, action: 'IMPORT' }] });
    expect(dup.status).toBe(400);
    const link = await agent.post('/api/steam/import').send({ items: [{ appId: 620, action: 'LINK' }] });
    expect(link.body.error.fields['items.0.gameId']).toBeDefined();
    const shots = await agent.post('/api/steam/import').send({ items: [{ appId: 620, action: 'IMPORT' }], options: { screenshots: 11 } });
    expect(shots.status).toBe(400);
  });
});
