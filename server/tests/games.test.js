// Testes D, E e G — cadastro completo, detalhes, imagens, edição e exclusão.
import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import {
  app, prisma, request, resetDb, ownerAgent, ownedGame, createGame, PNG, uploadedFileExists,
} from './helpers.js';

describe('cadastro de jogos', () => {
  let agent;
  beforeEach(async () => {
    await resetDb();
    agent = await ownerAgent();
  });
  afterAll(() => prisma.$disconnect());

  it('exige os campos obrigatórios de um jogo adquirido', async () => {
    const res = await agent.post('/api/games').send({ ownershipStatus: 'OWNED' });
    expect(res.status).toBe(400);
    expect(Object.keys(res.body.error.fields)).toEqual(
      expect.arrayContaining(['title', 'platform', 'mediaType', 'originalPrice', 'paidPrice', 'store']),
    );
  });

  it('rejeita preços negativos ou inválidos e nota fora de 1–5', async () => {
    const neg = await agent.post('/api/games').send(ownedGame({ paidPrice: '-10' }));
    expect(neg.status).toBe(400);
    expect(neg.body.error.fields.paidPrice).toMatch(/não negativo/);
    const txt = await agent.post('/api/games').send(ownedGame({ originalPrice: 'abc' }));
    expect(txt.body.error.fields.originalPrice).toBeDefined();
    const stars = await agent.post('/api/games').send(ownedGame({ ratingStars: 6 }));
    expect(stars.body.error.fields.ratingStars).toBeDefined();
    const hours = await agent.post('/api/games').send(ownedGame({ playTimeMinutes: -5 }));
    expect(hours.body.error.fields.playTimeMinutes).toBeDefined();
    expect(await prisma.game.count()).toBe(0);
  });

  it('salva o exemplo da especificação com preços decimais exatos', async () => {
    const game = await createGame(agent, ownedGame());
    expect(game).toMatchObject({
      title: 'Cyberpunk 2077',
      mediaType: 'DIGITAL',
      platform: { name: 'Steam', slug: 'steam' },
      store: { name: 'Nuuvem' },
      originalPrice: '199.90',
      paidPrice: '79.90',
      priceDifference: '120.00',
      playStatus: 'NOT_STARTED',
      playTimeMinutes: 0,
      ratingStars: null,
    });
  });

  it('aceita preço pago acima da referência (diferença negativa) e jogo gratuito', async () => {
    const above = await createGame(agent, ownedGame({ originalPrice: '100', paidPrice: '120,50' }));
    expect(above.priceDifference).toBe('-20.50');
    const free = await createGame(agent, ownedGame({ originalPrice: '0', paidPrice: '0' }));
    expect(free.paidPrice).toBe('0.00');
  });

  it('permite títulos repetidos (cópias e plataformas diferentes)', async () => {
    await createGame(agent, ownedGame({ platform: 'PC' }));
    await createGame(agent, ownedGame({ platform: 'PC' }));
    await createGame(agent, ownedGame({ platform: 'PS5' }));
    expect(await prisma.game.count()).toBe(3);
  });

  it('nunca guarda imagem em Base64: data URL é rejeitada', async () => {
    const res = await agent
      .post('/api/games')
      .send(ownedGame({ coverUrl: `data:image/png;base64,${PNG.toString('base64')}` }));
    expect(res.status).toBe(400);
    expect(res.body.error.fields.coverUrl).toBeDefined();
  });

  it('cadastra com upload real de capa (multipart) e serve o arquivo', async () => {
    const res = await agent
      .post('/api/games')
      .field('data', JSON.stringify(ownedGame()))
      .attach('cover', PNG, { filename: 'capa.png', contentType: 'image/png' });
    expect(res.status).toBe(201);
    expect(res.body.coverUrl).toMatch(/^\/uploads\/[0-9a-f-]{36}\.png$/);
    expect(uploadedFileExists(res.body.coverUrl)).toBe(true);
    const file = await request(app).get(res.body.coverUrl);
    expect(file.status).toBe(200);
    expect(file.headers['content-type']).toMatch(/image\/png/);
    const row = await prisma.gameImage.findFirst();
    expect(row.url).not.toMatch(/^data:/);
  });

  it('recusa arquivo que não é imagem de verdade, mesmo com extensão .png', async () => {
    const res = await agent
      .post('/api/games')
      .field('data', JSON.stringify(ownedGame()))
      .attach('cover', Buffer.from('<script>alert(1)</script> isto não é imagem'), {
        filename: 'falso.png',
        contentType: 'image/png',
      });
    expect(res.status).toBe(415);
    expect(await prisma.game.count()).toBe(0);
  });

  it('recusa imagem acima do limite configurado', async () => {
    const big = Buffer.concat([PNG, Buffer.alloc(1.5 * 1024 * 1024)]);
    const res = await agent
      .post('/api/games')
      .field('data', JSON.stringify(ownedGame()))
      .attach('cover', big, { filename: 'grande.png', contentType: 'image/png' });
    expect(res.status).toBe(413);
  });
});

describe('detalhes, imagens e edição', () => {
  let agent;
  beforeEach(async () => {
    await resetDb();
    agent = await ownerAgent();
  });

  it('teste E: 2+ imagens, avaliação, estrelas, tags, status e horas persistem', async () => {
    const game = await createGame(agent, ownedGame());
    const up = await agent
      .post(`/api/games/${game.id}/images`)
      .attach('images', PNG, { filename: 'a.png', contentType: 'image/png' })
      .attach('images', PNG, { filename: 'b.png', contentType: 'image/png' });
    expect(up.status).toBe(201);
    expect(up.body.images).toHaveLength(2);
    expect(up.body.images[0].isCover).toBe(true); // jogo sem capa: a primeira vira capa

    const patch = await agent.patch(`/api/games/${game.id}`).send({
      reviewText: '  Mundo incrível, história marcante.  ',
      ratingStars: 5,
      categories: ['RPG', ' rpg ', 'Ação', 'acao', 'Mundo aberto'],
      playStatus: 'COMPLETED',
      playTimeMinutes: 750,
    });
    expect(patch.status).toBe(200);

    const fresh = (await agent.get(`/api/games/${game.id}`)).body;
    expect(fresh.reviewText).toBe('Mundo incrível, história marcante.');
    expect(fresh.ratingStars).toBe(5);
    expect(fresh.categories.map((c) => c.name)).toEqual(['Ação', 'Mundo aberto', 'RPG']);
    expect(fresh.playStatus).toBe('COMPLETED');
    expect(fresh.playTimeMinutes).toBe(750);
    expect(fresh.images).toHaveLength(2);
    expect(await prisma.category.count()).toBe(3);
  });

  it('ordena, troca a capa e remove imagens (apagando o arquivo)', async () => {
    const game = await createGame(agent, ownedGame());
    const { body } = await agent
      .post(`/api/games/${game.id}/images`)
      .attach('images', PNG, { filename: 'a.png', contentType: 'image/png' })
      .attach('images', PNG, { filename: 'b.png', contentType: 'image/png' })
      .attach('images', PNG, { filename: 'c.png', contentType: 'image/png' });
    const [a, b, c] = body.images;

    const order = await agent.put(`/api/games/${game.id}/images/order`).send({ imageIds: [c.id, a.id, b.id] });
    expect(order.body.images.map((i) => i.id)).toEqual([c.id, a.id, b.id]);
    const bad = await agent.put(`/api/games/${game.id}/images/order`).send({ imageIds: [c.id, a.id] });
    expect(bad.status).toBe(400);

    const cover = await agent.patch(`/api/games/${game.id}/images/${b.id}`).send({ isCover: true });
    expect(cover.body.coverUrl).toBe(b.url);
    expect(cover.body.images.filter((i) => i.isCover)).toHaveLength(1);

    expect(uploadedFileExists(c.url)).toBe(true);
    const del = await agent.delete(`/api/games/${game.id}/images/${c.id}`);
    expect(del.body.images).toHaveLength(2);
    expect(uploadedFileExists(c.url)).toBe(false);
  });

  it('aceita capa por URL https e recusa http', async () => {
    const game = await createGame(agent, ownedGame({ coverUrl: 'https://cdn.exemplo.com/capa.jpg' }));
    expect(game.coverUrl).toBe('https://cdn.exemplo.com/capa.jpg');
    const http = await agent.post('/api/games').send(ownedGame({ coverUrl: 'http://inseguro.com/a.jpg' }));
    expect(http.status).toBe(400);
  });

  it('teste G: editar loja, plataforma, preço e tags atualiza tudo e remove órfãos', async () => {
    const game = await createGame(agent, ownedGame({ categories: ['Ação'] }));
    const res = await agent.patch(`/api/games/${game.id}`).send({
      store: 'Steam',
      platform: 'PC',
      paidPrice: '59,90',
      categories: ['RPG'],
    });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      store: { name: 'Steam' },
      platform: { name: 'PC', slug: 'pc' },
      paidPrice: '59.90',
      priceDifference: '140.00',
    });
    expect((await prisma.store.findMany()).map((s) => s.name)).toEqual(['Steam']);
    expect((await prisma.platform.findMany()).map((p) => p.name)).toEqual(['PC']);
    expect((await prisma.category.findMany()).map((c) => c.name)).toEqual(['RPG']);
    expect((await agent.get('/api/platforms/steam')).status).toBe(404);
  });

  it('edição continua validando no servidor', async () => {
    const game = await createGame(agent, ownedGame());
    const res = await agent.patch(`/api/games/${game.id}`).send({ store: '', paidPrice: '-1' });
    expect(res.status).toBe(400);
    expect(res.body.error.fields).toHaveProperty('store');
    expect(res.body.error.fields).toHaveProperty('paidPrice');
  });

  it('excluir remove jogo, imagens, arquivos e registros órfãos', async () => {
    const game = await createGame(agent, ownedGame({ categories: ['RPG'] }));
    const up = await agent
      .post(`/api/games/${game.id}/images`)
      .attach('images', PNG, { filename: 'a.png', contentType: 'image/png' });
    const url = up.body.images[0].url;
    await agent.delete(`/api/games/${game.id}`).expect(204);
    expect((await agent.get(`/api/games/${game.id}`)).status).toBe(404);
    expect(uploadedFileExists(url)).toBe(false);
    for (const model of ['game', 'gameImage', 'gameCategory', 'category', 'store', 'platform']) {
      expect(await prisma[model].count(), model).toBe(0);
    }
  });

  it('destaque: apenas um jogo por vez', async () => {
    const a = await createGame(agent, ownedGame({ title: 'A' }));
    const b = await createGame(agent, ownedGame({ title: 'B' }));
    await agent.patch(`/api/games/${a.id}/featured`).send({ isFeatured: true }).expect(200);
    await agent.patch(`/api/games/${b.id}/featured`).send({ isFeatured: true }).expect(200);
    const featured = await prisma.game.findMany({ where: { isFeatured: true } });
    expect(featured.map((g) => g.title)).toEqual(['B']);
    const list = await agent.get('/api/games');
    expect(list.body.items[0].title).toBe('B');
  });

  it('busca por nome, plataforma, loja e categoria; filtra por status', async () => {
    await createGame(agent, ownedGame({ title: 'Hades', platform: 'Switch', categories: ['Roguelike'] }));
    await createGame(agent, ownedGame({ title: 'Celeste', store: 'Steam', playStatus: 'COMPLETED' }));
    const titles = async (qs) => (await agent.get(`/api/games?${qs}`)).body.items.map((g) => g.title).sort();
    expect(await titles('search=hade')).toEqual(['Hades']);
    expect(await titles('search=switch')).toEqual(['Hades']);
    expect(await titles('search=roguelike')).toEqual(['Hades']);
    expect(await titles('search=nuuvem')).toEqual(['Hades']); // loja
    expect(await titles('search=steam')).toEqual(['Celeste']); // plataforma e loja Steam
    expect(await titles('status=COMPLETED')).toEqual(['Celeste']);
  });

  it('teste A: dados persistem para outra sessão (outro "navegador")', async () => {
    const game = await createGame(agent, ownedGame());
    const otherBrowser = await ownerAgent();
    const res = await otherBrowser.get(`/api/games/${game.id}`);
    expect(res.status).toBe(200);
    expect(res.body.title).toBe('Cyberpunk 2077');
  });
});
