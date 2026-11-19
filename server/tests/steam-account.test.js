// Vínculo da conta Steam: ID64, links, apelido, sem chave, desvincular e isolamento.
import { describe, it, expect, beforeEach, afterEach, afterAll } from 'vitest';
import { prisma, request, app, resetDb, ownerAgent, ownedGame, createGame } from './helpers.js';
import { config } from '../src/config.js';
import { setSteamClient } from '../src/services/steamClient.js';
import { fakeSteamClient, STEAM_ID, OTHER_STEAM_ID } from './fixtures/steam.js';

describe('conta Steam', () => {
  let agent;
  let steam;
  beforeEach(async () => {
    await resetDb();
    agent = await ownerAgent();
    steam = fakeSteamClient();
    setSteamClient(steam);
  });
  afterEach(() => setSteamClient(null));
  afterAll(() => prisma.$disconnect());

  it.each([
    ['SteamID64', STEAM_ID],
    ['link /profiles/', `https://steamcommunity.com/profiles/${STEAM_ID}/`],
    ['link /id/', 'https://steamcommunity.com/id/jogador/'],
    ['apelido', 'jogador'],
  ])('encontra o perfil pelo %s', async (_label, input) => {
    const res = await agent.post('/api/steam/account/lookup').send({ input });
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    expect(res.body).toMatchObject({ steamId64: STEAM_ID, personaName: 'Jogador Teste', visibility: 'public' });
    // Só consulta: nada foi salvo ainda.
    expect(await prisma.steamAccount.count()).toBe(0);
  });

  it('explica apelido inexistente e formato inválido', async () => {
    const missing = await agent.post('/api/steam/account/lookup').send({ input: 'ninguem-aqui' });
    expect(missing.status).toBe(404);
    expect(missing.body.error.code).toBe('STEAM_PROFILE_NOT_FOUND');
    expect(missing.body.error.message).toMatch(/ninguem-aqui/);

    const bad = await agent.post('/api/steam/account/lookup').send({ input: 'https://evil.example/id/x' });
    expect(bad.status).toBe(400);
    expect(bad.body.error.fields.input).toMatch(/SteamID64/);
  });

  it('vincula com os dados lidos pelo servidor e mostra no estado', async () => {
    const res = await agent.put('/api/steam/account').send({ steamId64: STEAM_ID, personaName: 'Forjado' });
    expect(res.status).toBe(200);
    expect(res.body.account).toMatchObject({ steamId64: STEAM_ID, personaName: 'Jogador Teste' });

    const status = (await agent.get('/api/steam/account')).body;
    expect(status).toMatchObject({ enabled: true, account: { steamId64: STEAM_ID }, ignoredCount: 0 });

    // Trocar de conta substitui o vínculo (um por usuário).
    await agent.put('/api/steam/account').send({ steamId64: OTHER_STEAM_ID });
    expect(await prisma.steamAccount.count()).toBe(1);
    expect((await agent.get('/api/steam/account')).body.account.personaName).toBe('Outra Conta');

    const invalid = await agent.put('/api/steam/account').send({ steamId64: '123' });
    expect(invalid.status).toBe(400);
  });

  it('sem STEAM_API_KEY a função aparece desativada e as rotas respondem 503', async () => {
    const saved = config.STEAM_API_KEY;
    config.STEAM_API_KEY = undefined;
    try {
      const status = (await agent.get('/api/steam/account')).body;
      expect(status.enabled).toBe(false);
      expect(status.disabledReason).toMatch(/STEAM_API_KEY/);
      const res = await agent.post('/api/steam/account/lookup').send({ input: STEAM_ID });
      expect(res.status).toBe(503);
      expect(res.body.error).toMatchObject({ code: 'STEAM_NOT_CONFIGURED' });
      expect(steam.state.calls.getPlayerSummary).toBe(0);
    } finally {
      config.STEAM_API_KEY = saved;
    }
  });

  it('a chave nunca aparece nas respostas', async () => {
    const status = await agent.get('/api/steam/account');
    const lookup = await agent.post('/api/steam/account/lookup').send({ input: 'jogador' });
    for (const res of [status, lookup]) expect(JSON.stringify(res.body)).not.toContain(config.STEAM_API_KEY);
  });

  it('desvincular mantém os jogos e, se pedido, remove o vínculo com o app', async () => {
    await agent.put('/api/steam/account').send({ steamId64: STEAM_ID });
    const game = await createGame(agent, ownedGame({ title: 'Portal 2' }));
    await prisma.game.update({ where: { id: game.id }, data: { source: 'STEAM', steamAppId: 620, steamPlaytimeMinutes: 10 } });

    const keep = await agent.delete('/api/steam/account?keepAppIds=true');
    expect(keep.status).toBe(200);
    expect(keep.body).toMatchObject({ unlinked: true, unlinkedGames: 0, steamGamesKept: 1 });
    expect((await prisma.game.findUnique({ where: { id: game.id } })).steamAppId).toBe(620);

    await agent.put('/api/steam/account').send({ steamId64: STEAM_ID });
    const drop = await agent.delete('/api/steam/account?keepAppIds=false');
    expect(drop.body.unlinkedGames).toBe(1);
    const after = await prisma.game.findUnique({ where: { id: game.id } });
    expect(after).toMatchObject({ steamAppId: null, steamPlaytimeMinutes: null, source: 'STEAM', title: 'Portal 2' });
    expect(await prisma.steamAccount.count()).toBe(0);

    expect((await agent.delete('/api/steam/account')).status).toBe(404);
  });

  it('exige login e isola o vínculo de cada usuário', async () => {
    expect((await request(app).get('/api/steam/account')).status).toBe(401);
    expect((await request(app).put('/api/steam/account').send({ steamId64: STEAM_ID })).status).toBe(401);

    await agent.put('/api/steam/account').send({ steamId64: STEAM_ID });
    const other = await ownerAgent({ email: 'outra@biblioteca.test', password: 'outra-senha-de-teste' });
    expect((await other.get('/api/steam/account')).body.account).toBeNull();
    expect((await other.delete('/api/steam/account')).status).toBe(404);
    expect(await prisma.steamAccount.count()).toBe(1);
  });

  it('bloqueia escrita vinda de outra origem', async () => {
    const res = await agent.put('/api/steam/account').set('Origin', 'https://evil.example').send({ steamId64: STEAM_ID });
    expect(res.status).toBe(403);
  });
});
