// Favoritos múltiplos e coleções personalizadas.
import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { prisma, resetDb, ownerAgent, ownedGame, createGame } from './helpers.js';

describe('favoritos', () => {
  let agent;
  let games;
  beforeEach(async () => {
    await resetDb();
    agent = await ownerAgent();
    games = [];
    for (const title of ['A', 'B', 'C']) games.push(await createGame(agent, ownedGame({ title })));
  });
  afterAll(() => prisma.$disconnect());

  it('adiciona, reordena, oculta do perfil e remove', async () => {
    for (const g of games) expect((await agent.post('/api/favorites').send({ gameId: g.id })).status).toBe(201);
    // repetir não duplica
    await agent.post('/api/favorites').send({ gameId: games[0].id });
    let list = (await agent.get('/api/favorites')).body.items;
    expect(list.map((f) => f.title)).toEqual(['A', 'B', 'C']);
    list = (await agent.put('/api/favorites/order').send({ gameIds: [games[2].id, games[0].id, games[1].id] })).body.items;
    expect(list.map((f) => f.title)).toEqual(['C', 'A', 'B']);
    const hidden = await agent.patch(`/api/favorites/${games[0].id}`).send({ showOnProfile: false });
    expect(hidden.body.items.find((f) => f.id === games[0].id).showOnProfile).toBe(false);
    const removed = await agent.delete(`/api/favorites/${games[1].id}`);
    expect(removed.body.items.map((f) => f.title)).toEqual(['C', 'A']);
    const detail = (await agent.get(`/api/games/${games[2].id}`)).body;
    expect(detail.isFavorite).toBe(true);
  });

  it('reordenação precisa conter todos os favoritos', async () => {
    await agent.post('/api/favorites').send({ gameId: games[0].id });
    await agent.post('/api/favorites').send({ gameId: games[1].id });
    const res = await agent.put('/api/favorites/order').send({ gameIds: [games[0].id] });
    expect(res.status).toBe(400);
  });

  it('excluir o jogo tira dos favoritos; o destaque único continua separado', async () => {
    await agent.post('/api/favorites').send({ gameId: games[0].id });
    await agent.post('/api/favorites').send({ gameId: games[1].id });
    await agent.patch(`/api/games/${games[1].id}/featured`).send({ isFeatured: true });
    await agent.delete(`/api/games/${games[0].id}`);
    const list = (await agent.get('/api/favorites')).body.items;
    expect(list.map((f) => f.title)).toEqual(['B']);
    expect(await prisma.game.count({ where: { isFeatured: true } })).toBe(1);
    // Destacar outro jogo não mexe nos favoritos
    await agent.patch(`/api/games/${games[2].id}/featured`).send({ isFeatured: true });
    expect((await agent.get('/api/favorites')).body.items).toHaveLength(1);
  });

  it('não favorita jogo de outro usuário', async () => {
    const other = await ownerAgent({ email: 'outro@biblioteca.test', password: 'outra-senha-123456' });
    expect((await other.post('/api/favorites').send({ gameId: games[0].id })).status).toBe(404);
  });
});

describe('coleções', () => {
  let agent;
  let games;
  beforeEach(async () => {
    await resetDb();
    agent = await ownerAgent();
    games = [];
    for (const title of ['Witcher 3', 'Persona 5', 'Hades']) games.push(await createGame(agent, ownedGame({ title })));
  });

  const create = (body) => agent.post('/api/collections').send({ name: 'Meus RPGs favoritos', ...body });

  it('cria, edita, adiciona, reordena e define capa', async () => {
    const created = await create({ description: 'Os melhores' });
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({ name: 'Meus RPGs favoritos', isPublic: false, gameCount: 0 });
    const id = created.body.id;
    const withItems = await agent.post(`/api/collections/${id}/items`).send({ gameIds: [games[0].id, games[1].id] });
    expect(withItems.body.items.map((g) => g.title)).toEqual(['Witcher 3', 'Persona 5']);
    // adicionar de novo não duplica
    await agent.post(`/api/collections/${id}/items`).send({ gameIds: [games[0].id] });
    const reordered = await agent.put(`/api/collections/${id}/items/order`).send({ gameIds: [games[1].id, games[0].id] });
    expect(reordered.body.items.map((g) => g.title)).toEqual(['Persona 5', 'Witcher 3']);
    const outsider = await agent.patch(`/api/collections/${id}`).send({ coverGameId: games[2].id });
    expect(outsider.status).toBe(400);
    const edited = await agent.patch(`/api/collections/${id}`).send({ name: 'RPGs', coverGameId: games[0].id, isPublic: true });
    expect(edited.body).toMatchObject({ name: 'RPGs', coverGameId: games[0].id, isPublic: true, gameCount: 2 });
  });

  it('um jogo pode estar em várias coleções; nomes não repetem', async () => {
    const a = (await create({})).body;
    const b = (await create({ name: 'Jogos para zerar em 2027' })).body;
    await agent.post(`/api/collections/${a.id}/items`).send({ gameIds: [games[0].id] });
    await agent.post(`/api/collections/${b.id}/items`).send({ gameIds: [games[0].id] });
    const of = await agent.get(`/api/collections/of-game/${games[0].id}`);
    expect(of.body.items).toHaveLength(2);
    const dup = await create({ name: 'meus rpgs FAVORITOS' });
    expect(dup.status).toBe(409);
  });

  it('excluir a coleção não exclui os jogos', async () => {
    const c = (await create({})).body;
    await agent.post(`/api/collections/${c.id}/items`).send({ gameIds: games.map((g) => g.id) });
    expect((await agent.delete(`/api/collections/${c.id}`)).status).toBe(204);
    expect(await prisma.game.count()).toBe(3);
    expect(await prisma.gameCollectionItem.count()).toBe(0);
  });

  it('excluir um jogo tira da coleção e limpa a capa', async () => {
    const c = (await create({})).body;
    await agent.post(`/api/collections/${c.id}/items`).send({ gameIds: [games[0].id, games[1].id] });
    await agent.patch(`/api/collections/${c.id}`).send({ coverGameId: games[0].id });
    await agent.delete(`/api/games/${games[0].id}`);
    const after = (await agent.get(`/api/collections/${c.id}`)).body;
    expect(after).toMatchObject({ gameCount: 1, coverGameId: null });
  });

  it('valida a posse dos jogos e da coleção', async () => {
    const c = (await create({})).body;
    const other = await ownerAgent({ email: 'outro@biblioteca.test', password: 'outra-senha-123456' });
    const foreign = await createGame(other, ownedGame({ title: 'Alheio' }));
    const res = await agent.post(`/api/collections/${c.id}/items`).send({ gameIds: [games[0].id, foreign.id] });
    expect(res.status).toBe(400);
    expect(await prisma.gameCollectionItem.count()).toBe(0);
    expect((await other.get(`/api/collections/${c.id}`)).status).toBe(404);
    expect((await other.delete(`/api/collections/${c.id}`)).status).toBe(404);
    // O banco também recusa (chave estrangeira composta), mesmo sem passar pelo serviço.
    await expect(
      prisma.gameCollectionItem.create({
        data: { collectionId: c.id, gameId: foreign.id, ownerId: (await prisma.user.findFirstOrThrow({ where: { email: 'dono@biblioteca.test' } })).id },
      }),
    ).rejects.toThrow();
  });

  it('filtra a biblioteca por coleção e favoritos', async () => {
    const c = (await create({})).body;
    await agent.post(`/api/collections/${c.id}/items`).send({ gameIds: [games[1].id] });
    await agent.post('/api/favorites').send({ gameId: games[2].id });
    const inCollection = await agent.get(`/api/games?collectionId=${c.id}`);
    expect(inCollection.body.items.map((g) => g.title)).toEqual(['Persona 5']);
    const favs = await agent.get('/api/games?favorite=true');
    expect(favs.body.items.map((g) => g.title)).toEqual(['Hades']);
  });
});
