// Cadastro público e o que muda quando há várias pessoas no mesmo site.
import { describe, it, expect, beforeEach, afterEach, afterAll } from 'vitest';
import { prisma, request, app, resetDb, ownedGame, createGame } from './helpers.js';
import { config } from '../src/config.js';

const signup = (agent, body) => agent.post('/api/auth/register').send(body);

describe('cadastro público', () => {
  beforeEach(async () => {
    await resetDb();
    config.ALLOW_SIGNUP = true;
  });
  afterEach(() => {
    config.ALLOW_SIGNUP = false;
  });
  afterAll(() => prisma.$disconnect());

  it('desligado por padrão: 403 e o /me avisa a interface', async () => {
    config.ALLOW_SIGNUP = false;
    const res = await signup(request(app), { email: 'ana@exemplo.com', password: 'uma senha longa' });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('SIGNUP_DISABLED');
    expect((await request(app).get('/api/auth/me')).body.signupEnabled).toBe(false);
    expect(await prisma.user.count()).toBe(0);
  });

  it('cria a conta, já entra e começa com a biblioteca vazia', async () => {
    const agent = request.agent(app);
    expect((await agent.get('/api/auth/me')).body.signupEnabled).toBe(true);
    const res = await signup(agent, { email: '  Ana@Exemplo.com ', password: 'uma senha longa' });
    expect(res.status).toBe(201);
    expect(res.body.user).toMatchObject({ email: 'ana@exemplo.com' });
    expect(JSON.stringify(res.body)).not.toMatch(/passwordHash|senha longa/);
    expect((await agent.get('/api/auth/me')).body.user.email).toBe('ana@exemplo.com');
    expect((await agent.get('/api/games')).body.total).toBe(0);
    expect((await agent.get('/api/profile')).status).toBe(200);
    // Login normal depois de sair.
    await agent.post('/api/auth/logout');
    expect((await agent.post('/api/auth/login').send({ email: 'ana@exemplo.com', password: 'uma senha longa' })).status).toBe(200);
  });

  it('valida e-mail e senha e não revela se o e-mail já existe', async () => {
    const bad = await signup(request(app), { email: 'nao-e-email', password: 'curta' });
    expect(bad.status).toBe(400);
    expect(Object.keys(bad.body.error.fields).sort()).toEqual(['email', 'password']);
    const same = await signup(request(app), { email: 'ana@exemplo.com', password: 'ana@exemplo.com' });
    expect(same.body.error.fields.password).toMatch(/e-mail/);
    const boring = await signup(request(app), { email: 'ana@exemplo.com', password: 'aaaaaaaaaaaa' });
    expect(boring.body.error.fields.password).toMatch(/previsível/);

    await signup(request(app), { email: 'ana@exemplo.com', password: 'uma senha longa' });
    const again = await signup(request(app), { email: 'ANA@exemplo.com', password: 'outra senha longa' });
    expect(again.status).toBe(409);
    expect(again.body.error.code).toBe('EMAIL_UNAVAILABLE');
    expect(again.body.error.message).not.toMatch(/já existe/i);
    expect(await prisma.user.count()).toBe(1);
  });

  it('quem já está conectado não cria outra conta por cima', async () => {
    const agent = request.agent(app);
    await signup(agent, { email: 'ana@exemplo.com', password: 'uma senha longa' });
    expect((await signup(agent, { email: 'bia@exemplo.com', password: 'uma senha longa' })).status).toBe(409);
  });

  it('cada conta vê só os próprios jogos', async () => {
    const ana = request.agent(app);
    const bia = request.agent(app);
    await signup(ana, { email: 'ana@exemplo.com', password: 'uma senha longa' });
    await signup(bia, { email: 'bia@exemplo.com', password: 'outra senha longa' });
    const game = await createGame(ana, ownedGame({ title: 'Hades' }));
    expect((await bia.get('/api/games')).body.total).toBe(0);
    expect((await bia.get(`/api/games/${game.id}`)).status).toBe(404);
    expect((await bia.patch(`/api/games/${game.id}`).send({ title: 'x' })).status).toBe(404);
    expect((await bia.delete(`/api/games/${game.id}`)).status).toBe(404);
    expect((await bia.get('/api/platforms')).body.items).toEqual([]);
  });

  it('renomear uma plataforma usada por outra pessoa não muda a dela', async () => {
    const ana = request.agent(app);
    const bia = request.agent(app);
    await signup(ana, { email: 'ana@exemplo.com', password: 'uma senha longa' });
    await signup(bia, { email: 'bia@exemplo.com', password: 'outra senha longa' });
    await createGame(ana, ownedGame({ title: 'Hades', platform: 'Steam' }));
    await createGame(bia, ownedGame({ title: 'Celeste', platform: 'Steam' }));
    const steam = (await ana.get('/api/platforms')).body.items[0];

    const res = await ana.patch(`/api/platforms/${steam.id}`).send({ name: 'PC' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ name: 'PC', slug: 'pc', previousSlug: 'steam' });
    expect((await ana.get('/api/platforms')).body.items.map((p) => p.name)).toEqual(['PC']);
    expect((await bia.get('/api/platforms')).body.items.map((p) => p.name)).toEqual(['Steam']);
    expect((await bia.get('/api/platforms/steam')).status).toBe(200);

    // Nome novo igual ao de uma plataforma que só a outra pessoa usa: junta, sem 409 nem vazamento.
    await createGame(bia, ownedGame({ title: 'Halo', platform: 'Xbox' }));
    const pc = (await ana.get('/api/platforms')).body.items[0];
    const merge = await ana.patch(`/api/platforms/${pc.id}`).send({ name: 'xbox' });
    expect(merge.status).toBe(200);
    expect(merge.body.name).toBe('Xbox');
    expect((await bia.get('/api/platforms')).body.items.map((p) => p.name).sort()).toEqual(['Steam', 'Xbox']);
  });
});
