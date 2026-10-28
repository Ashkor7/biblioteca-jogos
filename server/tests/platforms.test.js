// Teste B — plataformas criadas dinamicamente a partir dos jogos.
import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { prisma, resetDb, ownerAgent, ownedGame, createGame } from './helpers.js';

describe('plataformas dinâmicas', () => {
  let agent;
  beforeEach(async () => {
    await resetDb();
    agent = await ownerAgent();
  });
  afterAll(() => prisma.$disconnect());

  it('começa sem plataformas e cria Xbox 360 ao cadastrar o primeiro jogo', async () => {
    expect((await agent.get('/api/platforms')).body.items).toEqual([]);
    expect(await prisma.platform.count()).toBe(0);

    await createGame(agent, ownedGame({ title: 'Halo 3', platform: 'Xbox 360', store: 'Loja física' }));
    const menu = (await agent.get('/api/platforms')).body.items;
    expect(menu).toHaveLength(1);
    expect(menu[0]).toMatchObject({ name: 'Xbox 360', slug: 'xbox-360', ownedCount: 1, wishlistCount: 0 });

    const page = await agent.get('/api/platforms/xbox-360');
    expect(page.status).toBe(200);
    expect(page.body).toMatchObject({ name: 'Xbox 360', ownedCount: 1, redirectTo: null });
  });

  it('reutiliza a mesma plataforma ignorando caixa, acentos e espaços', async () => {
    await createGame(agent, ownedGame({ title: 'Halo 3', platform: 'Xbox 360' }));
    await createGame(agent, ownedGame({ title: 'Gears of War', platform: '  xbox   360 ' }));
    await createGame(agent, ownedGame({ title: 'Fable II', platform: 'XBOX-360' }));
    expect(await prisma.platform.count()).toBe(1);
    const list = await agent.get('/api/games?platform=xbox-360&ownership=OWNED&sort=title');
    expect(list.body.total).toBe(3);
    expect(list.body.items.map((g) => g.title)).toEqual(['Fable II', 'Gears of War', 'Halo 3']);
    expect(list.body.items.every((g) => g.platform.name === 'Xbox 360')).toBe(true);
  });

  it('Wii ganha página própria automaticamente', async () => {
    await createGame(agent, ownedGame({ title: 'Halo 3', platform: 'Xbox 360' }));
    await createGame(agent, ownedGame({ title: 'Wii Sports', platform: 'Wii', mediaType: 'PHYSICAL' }));
    const slugs = (await agent.get('/api/platforms')).body.items.map((p) => p.slug);
    expect(slugs).toEqual(['wii', 'xbox-360']);
    expect((await agent.get('/api/platforms/wii')).body.ownedCount).toBe(1);
  });

  it('separa adquiridos e desejados na mesma plataforma', async () => {
    await createGame(agent, ownedGame({ platform: 'Switch' }));
    await createGame(agent, { title: 'Zelda', ownershipStatus: 'WISHLIST', platform: 'Switch' });
    const page = (await agent.get('/api/platforms/switch')).body;
    expect(page).toMatchObject({ ownedCount: 1, wishlistCount: 1, totalCount: 2 });
    const owned = await agent.get('/api/games?platform=switch&ownership=OWNED');
    const wish = await agent.get('/api/games?platform=switch&ownership=WISHLIST');
    expect(owned.body.items.map((g) => g.title)).toEqual(['Cyberpunk 2077']);
    expect(wish.body.items.map((g) => g.title)).toEqual(['Zelda']);
  });

  it('renomear preserva os jogos e o slug antigo redireciona', async () => {
    const game = await createGame(agent, ownedGame({ platform: 'PS5' }));
    const res = await agent.patch(`/api/platforms/${game.platform.id}`).send({ name: 'PlayStation 5' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ name: 'PlayStation 5', slug: 'playstation-5', previousSlug: 'ps5' });

    const old = await agent.get('/api/platforms/ps5');
    expect(old.status).toBe(200);
    expect(old.body.redirectTo).toBe('playstation-5');
    expect((await agent.get(`/api/games/${game.id}`)).body.platform.slug).toBe('playstation-5');
  });

  it('não permite renomear para um nome já usado', async () => {
    const a = await createGame(agent, ownedGame({ platform: 'PC' }));
    await createGame(agent, ownedGame({ platform: 'Steam Deck' }));
    const res = await agent.patch(`/api/platforms/${a.platform.id}`).send({ name: 'steam deck' });
    expect(res.status).toBe(409);
  });

  it('plataforma sem jogos some do menu e da rota', async () => {
    const wii = await createGame(agent, ownedGame({ platform: 'Wii' }));
    await createGame(agent, ownedGame({ platform: 'PC' }));
    await agent.delete(`/api/games/${wii.id}`).expect(204);
    expect((await agent.get('/api/platforms')).body.items.map((p) => p.slug)).toEqual(['pc']);
    expect((await agent.get('/api/platforms/wii')).status).toBe(404);
    expect(await prisma.platform.count()).toBe(1);
  });
});
