// Metadados opcionais (descrição, empresas, lançamento, Metacritic) e filtro de origem.
import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { prisma, resetDb, ownerAgent, ownedGame, createGame } from './helpers.js';

describe('metadados do jogo', () => {
  let agent;
  beforeEach(async () => {
    await resetDb();
    agent = await ownerAgent();
  });
  afterAll(() => prisma.$disconnect());

  it('jogos manuais aceitam, editam e limpam os metadados', async () => {
    const game = await createGame(
      agent,
      ownedGame({
        description: '  Um RPG de mundo aberto.  ',
        developer: 'CD PROJEKT RED',
        publisher: 'CD PROJEKT RED',
        releaseDate: '2020-12-10',
        metacriticScore: 86,
      }),
    );
    expect(game).toMatchObject({
      source: 'MANUAL',
      steam: null,
      description: 'Um RPG de mundo aberto.',
      developer: 'CD PROJEKT RED',
      releaseDate: '2020-12-10',
      releaseDateText: null,
      metacriticScore: 86,
    });

    const edited = await agent
      .patch(`/api/games/${game.id}`)
      .send({ releaseDate: '', releaseDateText: 'Em breve', metacriticScore: null, publisher: '' });
    expect(edited.status).toBe(200);
    expect(edited.body).toMatchObject({
      releaseDate: null,
      releaseDateText: 'Em breve',
      metacriticScore: null,
      publisher: null,
      developer: 'CD PROJEKT RED',
    });
  });

  it('recusa valores fora dos limites', async () => {
    const res = await agent.post('/api/games').send(
      ownedGame({ metacriticScore: 101, releaseDate: '2020-02-31', developer: 'x'.repeat(121), description: 'y'.repeat(1001) }),
    );
    expect(res.status).toBe(400);
    expect(Object.keys(res.body.error.fields).sort()).toEqual(['description', 'developer', 'metacriticScore', 'releaseDate']);
  });

  it('filtra por origem e busca pela desenvolvedora', async () => {
    await createGame(agent, ownedGame({ title: 'Manual', developer: 'Supergiant' }));
    const other = await createGame(agent, ownedGame({ title: 'Da Steam' }));
    await prisma.game.update({ where: { id: other.id }, data: { source: 'STEAM', steamAppId: 1145360 } });

    const steam = (await agent.get('/api/games?source=STEAM')).body;
    expect(steam.items.map((g) => g.title)).toEqual(['Da Steam']);
    expect(steam.items[0].steam).toMatchObject({ appId: 1145360, storeUrl: 'https://store.steampowered.com/app/1145360/' });
    expect((await agent.get('/api/games?source=MANUAL')).body.total).toBe(1);
    expect((await agent.get('/api/games?search=supergiant')).body.items.map((g) => g.title)).toEqual(['Manual']);
    expect((await agent.get('/api/games?source=EPIC')).status).toBe(400);
  });

  it('o banco recusa o mesmo app da Steam duas vezes para o mesmo dono', async () => {
    const a = await createGame(agent, ownedGame({ title: 'A' }));
    const b = await createGame(agent, ownedGame({ title: 'B' }));
    await prisma.game.update({ where: { id: a.id }, data: { steamAppId: 620 } });
    await expect(prisma.game.update({ where: { id: b.id }, data: { steamAppId: 620 } })).rejects.toThrow();
    await expect(
      prisma.game.update({ where: { id: b.id }, data: { steamAchievementsUnlocked: 5, steamAchievementsTotal: 3 } }),
    ).rejects.toThrow();
  });
});
