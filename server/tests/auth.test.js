// Teste H (segurança): visitante anônimo não lê nem altera; sessão segura.
import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { app, prisma, request, resetDb, ownerAgent, OWNER, ownedGame, createGame } from './helpers.js';

const FAKE_ID = '11111111-1111-4111-8111-111111111111';

describe('autenticação e proteção de escrita', () => {
  beforeEach(resetDb);
  afterAll(() => prisma.$disconnect());

  it('bloqueia todas as rotas de escrita para anônimos (401)', async () => {
    const anon = () => request(app);
    const attempts = [
      () => anon().post('/api/games').send(ownedGame()),
      () => anon().patch(`/api/games/${FAKE_ID}`).send({ title: 'x' }),
      () => anon().delete(`/api/games/${FAKE_ID}`),
      () => anon().patch(`/api/games/${FAKE_ID}/featured`).send({ isFeatured: true }),
      () => anon().patch(`/api/games/${FAKE_ID}/mark-purchased`).send({}),
      () => anon().post(`/api/games/${FAKE_ID}/images`).send({ url: 'https://example.com/a.png' }),
      () => anon().delete(`/api/games/${FAKE_ID}/images/${FAKE_ID}`),
      () => anon().patch(`/api/platforms/${FAKE_ID}`).send({ name: 'X' }),
      () => anon().post('/api/import/legacy').send([]),
    ];
    for (const attempt of attempts) {
      const res = await attempt();
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHENTICATED');
    }
    expect(await prisma.game.count()).toBe(0);
  });

  it('com PUBLIC_READ=false, leitura também exige login', async () => {
    const res = await request(app).get('/api/games');
    expect(res.status).toBe(401);
  });

  it('rejeita senha incorreta sem revelar se o e-mail existe', async () => {
    await ownerAgent();
    const wrong = await request(app).post('/api/auth/login').send({ ...OWNER, password: 'errada-123456' });
    const unknown = await request(app)
      .post('/api/auth/login')
      .send({ email: 'ninguem@biblioteca.test', password: 'qualquer-coisa' });
    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(wrong.body.error.message).toBe(unknown.body.error.message);
  });

  it('login cria cookie HttpOnly + SameSite e /me não expõe o hash', async () => {
    await ownerAgent();
    const res = await request(app).post('/api/auth/login').send(OWNER);
    const cookie = res.headers['set-cookie'][0];
    expect(cookie).toMatch(/bj_session=/);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Lax/i);
    expect(JSON.stringify(res.body)).not.toMatch(/passwordHash|\$2[aby]\$/);

    const agent = request.agent(app);
    await agent.post('/api/auth/login').send(OWNER);
    const me = await agent.get('/api/auth/me');
    expect(me.body.user.email).toBe(OWNER.email);
    expect(me.body.user.passwordHash).toBeUndefined();

    await agent.post('/api/auth/logout').expect(204);
    const after = await agent.get('/api/auth/me');
    expect(after.body.user).toBeNull();
  });

  it('valida o corpo do login', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'nao-e-email' });
    expect(res.status).toBe(400);
    expect(res.body.error.fields).toHaveProperty('email');
    expect(res.body.error.fields).toHaveProperty('password');
  });

  it('bloqueia escrita vinda de outra origem (CSRF)', async () => {
    const agent = await ownerAgent();
    const res = await agent.post('/api/games').set('Origin', 'https://site-malicioso.example').send(ownedGame());
    expect(res.status).toBe(403);
    const ok = await agent.post('/api/games').set('Origin', 'http://localhost:5173').send(ownedGame());
    expect(ok.status).toBe(201);
  });

  it('um proprietário não enxerga nem altera jogos de outro usuário', async () => {
    const owner = await ownerAgent();
    const game = await createGame(owner, ownedGame());
    const other = await ownerAgent({ email: 'outro@biblioteca.test', password: 'outra-senha-123' });
    expect((await other.get(`/api/games/${game.id}`)).status).toBe(404);
    expect((await other.delete(`/api/games/${game.id}`)).status).toBe(404);
    expect((await other.get('/api/games')).body.total).toBe(0);
  });
});
