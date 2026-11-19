// Ressincronizar, completar com dados da Steam, ignorados e privacidade do perfil público.
import { describe, it, expect, beforeEach, afterEach, afterAll } from 'vitest';
import { prisma, request, app, resetDb, ownerAgent, ownedGame, createGame, PNG } from './helpers.js';
import { setSteamClient } from '../src/services/steamClient.js';
import { setRemoteImageFetch } from '../src/lib/remoteImage.js';
import { processSteamJob, configureSteamRunner } from '../src/services/steamJobRunner.js';
import { fakeSteamClient, STEAM_ID } from './fixtures/steam.js';

describe('ressincronização e manutenção', () => {
  let agent;
  let steam;
  beforeEach(async () => {
    await resetDb();
    agent = await ownerAgent();
    steam = fakeSteamClient();
    setSteamClient(steam);
    setRemoteImageFetch(async () => new Response(PNG, { status: 200 }));
    configureSteamRunner({ pauseMs: 0, sleep: async () => {} });
    await agent.put('/api/steam/account').send({ steamId64: STEAM_ID });
  });
  afterEach(() => {
    setSteamClient(null);
    setRemoteImageFetch(null);
  });
  afterAll(() => prisma.$disconnect());

  const steamGame = (appId) => prisma.game.findFirst({ where: { steamAppId: appId } });
  const setOwned = (games) => {
    steam.state.owned[STEAM_ID].games = games;
  };
  const fixture = () => fakeSteamClient().state.owned[STEAM_ID].games;

  async function importApps(appIds) {
    const res = await agent.post('/api/steam/import').send({ items: appIds.map((appId) => ({ appId, action: 'IMPORT' })) });
    expect(res.status, JSON.stringify(res.body)).toBe(201);
    if (res.body.jobId) await processSteamJob(res.body.jobId);
    return res.body;
  }

  it('só cria o que falta e não sobrescreve campos editados', async () => {
    await importApps([620]);
    const portal = await steamGame(620);
    const edited = await agent.patch(`/api/games/${portal.id}`).send({
      title: 'Portal 2 (meu)',
      platform: 'PC',
      playStatus: 'COMPLETED',
      description: 'Minha descrição',
      categories: ['Puzzle'],
      ratingStars: 5,
    });
    expect(edited.status).toBe(200);

    const res = await agent.post('/api/steam/resync').send({});
    expect(res.status).toBe(201);
    // Hades, Stardew, Witcher, Ori e a DLC (tipo ainda fora do cache; o nome não a denuncia).
    // A trilha sonora fica de fora pelo nome.
    expect(res.body).toMatchObject({ created: 5, updated: 0 });
    expect(await steamGame(440)).toBeNull();
    await processSteamJob(res.body.jobId);

    const after = (await agent.get(`/api/games/${portal.id}`)).body;
    expect(after).toMatchObject({
      title: 'Portal 2 (meu)',
      platform: { name: 'PC' },
      playStatus: 'COMPLETED',
      description: 'Minha descrição',
      ratingStars: 5,
    });
    expect(after.categories.map((c) => c.name)).toEqual(['Puzzle']);
    expect(await prisma.game.count({ where: { steamAppId: 620 } })).toBe(1);

    const again = await agent.post('/api/steam/resync').send({});
    expect(again.body).toMatchObject({ created: 0, jobId: null });
  });

  it('atualiza horas pelo máximo sem tocar no diário nem no estado', async () => {
    await importApps([620]);
    const portal = await steamGame(620);
    expect(portal).toMatchObject({ playTimeMinutes: 1200, legacyPlayMinutes: 1200, playStatus: 'NOT_STARTED' });
    await agent.post('/api/sessions').send({ gameId: portal.id, playedOn: '2026-11-15', durationMinutes: 300 });
    expect(await steamGame(620)).toMatchObject({ playTimeMinutes: 1500, legacyPlayMinutes: 1200 });

    // Sem a opção: nada muda.
    setOwned(fixture().map((g) => (g.appId === 620 ? { ...g, playtimeMinutes: 2000, playtime2WeeksMinutes: 60 } : g)));
    await agent.post('/api/steam/resync').send({});
    expect(await steamGame(620)).toMatchObject({ playTimeMinutes: 1500, steamPlaytimeMinutes: 1200 });

    // Steam abaixo do total atual (sessões do diário somadas): não diminui.
    setOwned(fixture().map((g) => (g.appId === 620 ? { ...g, playtimeMinutes: 1400, playtime2WeeksMinutes: 60 } : g)));
    const low = await agent.post('/api/steam/resync').send({ updatePlaytime: true });
    expect(low.status).toBe(201);
    expect(await steamGame(620)).toMatchObject({ playTimeMinutes: 1500, legacyPlayMinutes: 1200, steamPlaytimeMinutes: 1400 });

    // Steam acima: novo total, diário preservado (300 min), estado não muda.
    setOwned(fixture().map((g) => (g.appId === 620 ? { ...g, playtimeMinutes: 2000, lastPlayedAt: new Date('2026-11-18T10:00:00Z') } : g)));
    const high = await agent.post('/api/steam/resync').send({ updatePlaytime: true });
    expect(high.body.updated).toBeGreaterThanOrEqual(1);
    const game = (await agent.get(`/api/games/${portal.id}`)).body;
    expect(game).toMatchObject({ playTimeMinutes: 2000, legacyPlayMinutes: 1700, sessionMinutes: 300, playStatus: 'NOT_STARTED' });
    expect(game.steam).toMatchObject({ playtimeMinutes: 2000, lastPlayedAt: '2026-11-18T10:00:00.000Z' });
    expect(await prisma.gameSession.count()).toBe(1);
  });

  it('atualizar conquistas na ressincronização', async () => {
    await importApps([1145360]);
    steam.state.achievements[1145360] = { unlocked: 40, total: 49 };
    const res = await agent.post('/api/steam/resync').send({ updatePlaytime: true });
    await processSteamJob(res.body.jobId);
    expect(await steamGame(1145360)).toMatchObject({ steamAchievementsUnlocked: 40, steamAchievementsTotal: 49 });
  });

  it('excluir com "não importar de novo" ignora o app, e desfazer volta a importar', async () => {
    await importApps([620, 1145360]);
    const portal = await steamGame(620);
    const hades = await steamGame(1145360);
    expect((await agent.delete(`/api/games/${portal.id}?ignoreSteam=true`)).status).toBe(204);
    expect((await agent.delete(`/api/games/${hades.id}?ignoreSteam=false`)).status).toBe(204);
    expect((await agent.delete(`/api/games/${hades.id}?ignoreSteam=talvez`)).status).toBe(400);

    const ignored = (await agent.get('/api/steam/ignored')).body.items;
    expect(ignored).toEqual([expect.objectContaining({ appId: 620, title: 'Portal 2', storeUrl: 'https://store.steampowered.com/app/620/' })]);

    const preview = (await agent.post('/api/steam/preview').send({})).body.items;
    expect(preview.find((i) => i.appId === 620).status).toBe('IGNORED');
    await agent.post('/api/steam/resync').send({});
    expect(await steamGame(620)).toBeNull();
    expect(await steamGame(1145360)).not.toBeNull(); // excluído sem marcar: volta

    expect((await agent.delete('/api/steam/ignored/620')).status).toBe(204);
    expect((await agent.delete('/api/steam/ignored/620')).status).toBe(404);
    expect((await agent.delete('/api/steam/ignored/abc')).status).toBe(404);
    await agent.post('/api/steam/resync').send({});
    expect(await steamGame(620)).not.toBeNull();
  });

  it('"Completar com dados da Steam" preenche só o vazio e sobrescreve só com confirmação', async () => {
    const res = await agent.post('/api/steam/import').send({ items: [{ appId: 620, action: 'IMPORT' }] });
    const portal = await steamGame(620);
    await prisma.steamSyncJob.update({ where: { id: res.body.jobId }, data: { status: 'CANCELLED' } });
    await agent.patch(`/api/games/${portal.id}`).send({ developer: 'Eu mesmo', categories: ['Puzzle'] });

    const fill = await agent.post(`/api/games/${portal.id}/steam-fill`).send({});
    expect(fill.status).toBe(200);
    expect(fill.body.game).toMatchObject({ developer: 'Eu mesmo', publisher: 'Valve', metacriticScore: 95 });
    expect(fill.body.game.categories.map((c) => c.name)).toEqual(['Puzzle']);
    expect(fill.body.filled).toEqual(expect.arrayContaining(['description', 'publisher', 'images']));
    expect(fill.body.filled).not.toContain('developer');
    expect(fill.body.game.images).toHaveLength(1);

    const over = await agent.post(`/api/games/${portal.id}/steam-fill`).send({ overwrite: true });
    expect(over.body.game.developer).toBe('Valve');
    expect(over.body.game.categories.map((c) => c.name)).toEqual(['Ação', 'Aventura', 'Puzzle']);
    expect(over.body.game.images).toHaveLength(2);
    expect(over.body.game.images.filter((i) => i.isCover)).toHaveLength(1);

    const manual = await createGame(agent, ownedGame({ title: 'Sem vínculo' }));
    const noLink = await agent.post(`/api/games/${manual.id}/steam-fill`).send({});
    expect(noLink.status).toBe(409);

    const other = await ownerAgent({ email: 'outra@biblioteca.test', password: 'outra-senha-de-teste' });
    expect((await other.post(`/api/games/${portal.id}/steam-fill`).send({})).status).toBe(404);
    expect((await request(app).post(`/api/games/${portal.id}/steam-fill`).send({})).status).toBe(401);
  });

  it('o perfil público não mostra nada da Steam', async () => {
    await agent.patch('/api/profile').send({ username: 'jogador-publico' });
    await agent.patch('/api/profile/privacy').send({ isPublic: true, showLibrary: true, showActivity: true, showPlayStats: true });
    // Plataforma "PC": o nome da plataforma é dado do usuário, não da conta Steam.
    const imp = await agent
      .post('/api/steam/import')
      .send({ items: [{ appId: 620, action: 'IMPORT' }, { appId: 1145360, action: 'IMPORT' }], options: { platform: 'PC' } });
    await processSteamJob(imp.body.jobId);

    const profile = await request(app).get('/api/public/profiles/jogador-publico');
    const library = await request(app).get('/api/public/profiles/jogador-publico/library');
    expect(profile.status).toBe(200);
    expect(library.status).toBe(200);
    expect(library.body.items.map((g) => g.title).sort()).toEqual(['Hades', 'Portal 2']);
    for (const res of [profile, library]) {
      const text = JSON.stringify(res.body);
      expect(text).not.toContain(STEAM_ID);
      expect(text).not.toContain('Jogador Teste'); // nome da conta Steam
      expect(text).not.toMatch(/steam/i);
      expect(text).not.toContain('STEAM_IMPORTED');
    }
  });
});
