// Perfil do jogador: edição, avatar/banner, privacidade e autorização.
import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { prisma, request, app, resetDb, ownerAgent, ownedGame, createGame, PNG, uploadedFileExists } from './helpers.js';

describe('perfil do jogador', () => {
  let agent;
  beforeEach(async () => {
    await resetDb();
    agent = await ownerAgent();
  });
  afterAll(() => prisma.$disconnect());

  it('cria o perfil na primeira visita, privado e sem nada do e-mail', async () => {
    const res = await agent.get('/api/profile');
    expect(res.status).toBe(200);
    expect(res.body.username).toMatch(/^jogador-[0-9a-f]{6}$/);
    expect(JSON.stringify(res.body)).not.toContain('dono@');
    expect(res.body.privacy).toEqual({
      isPublic: false,
      showFavorites: true,
      showAchievements: true,
      showActivity: false,
      showPlayStats: true,
      showLibrary: false,
      showWishlist: false,
      showOriginalValue: false,
      showPaidTotal: false,
      showSavings: false,
      showStoreRanking: false,
    });
    expect(res.body.progress).toMatchObject({ level: 1, totalXp: 0, nextLevelXp: 100 });
    expect(res.body.publicUrl).toBeNull(); // sem PUBLIC_APP_URL não há link "acessível"
    expect(res.body.publicPath).toBe(`/u/${res.body.username}`);
  });

  it('edita nome, username e biografia com validação', async () => {
    const res = await agent.patch('/api/profile').send({ displayName: '  Ashkor  ', username: 'Ashkor_7', bio: 'Fã de RPG‮' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ displayName: 'Ashkor', username: 'ashkor_7', bio: 'Fã de RPG' });
    const bad = await agent.patch('/api/profile').send({ username: 'ab', bio: 'x'.repeat(401), displayName: '' });
    expect(bad.status).toBe(400);
    expect(Object.keys(bad.body.error.fields).sort()).toEqual(['bio', 'displayName', 'username']);
    const reserved = await agent.patch('/api/profile').send({ username: 'admin' });
    expect(reserved.body.error.fields.username).toMatch(/reservado/);
  });

  it('username é único', async () => {
    await agent.patch('/api/profile').send({ username: 'ashkor' });
    const other = await ownerAgent({ email: 'outro@biblioteca.test', password: 'outra-senha-123456' });
    const res = await other.patch('/api/profile').send({ username: 'ashkor' });
    expect(res.status).toBe(409);
    expect(res.body.error.fields.username).toBeDefined();
  });

  it('envia, troca e remove avatar e banner (arquivos apagados)', async () => {
    const first = await agent.put('/api/profile/avatar').attach('image', PNG, 'a.png');
    expect(first.status).toBe(200);
    expect(first.body.avatarUrl).toMatch(/^\/uploads\/[0-9a-f-]{36}\.png$/);
    expect(uploadedFileExists(first.body.avatarUrl)).toBe(true);
    const second = await agent.put('/api/profile/avatar').attach('image', PNG, 'b.png');
    expect(uploadedFileExists(first.body.avatarUrl)).toBe(false);
    expect(uploadedFileExists(second.body.avatarUrl)).toBe(true);
    const banner = await agent.put('/api/profile/banner').attach('image', PNG, 'c.png');
    expect(banner.body.bannerUrl).toMatch(/^\/uploads\//);
    const removed = await agent.delete('/api/profile/avatar');
    expect(removed.body.avatarUrl).toBeNull();
    expect(uploadedFileExists(second.body.avatarUrl)).toBe(false);
    // Nada de Base64 no banco: só o nome do arquivo gerado pelo servidor.
    const row = await prisma.playerProfile.findFirstOrThrow();
    expect(row.bannerKey).toMatch(/^[0-9a-f-]{36}\.png$/);
  });

  it('recusa arquivo que não é imagem pelos bytes', async () => {
    const res = await agent.put('/api/profile/banner').attach('image', Buffer.from('<?php echo 1; ?>xxxxxxxx'), {
      filename: 'falso.png',
      contentType: 'image/png',
    });
    expect(res.status).toBe(415);
  });

  it('salva preferências de privacidade e recusa chaves desconhecidas', async () => {
    const res = await agent.patch('/api/profile/privacy').send({ isPublic: true, showSavings: true });
    expect(res.body.privacy).toMatchObject({ isPublic: true, showSavings: true, showPaidTotal: false });
    const bad = await agent.patch('/api/profile/privacy').send({ isAdmin: true });
    expect(bad.status).toBe(400);
  });

  it('estatísticas privadas do perfil incluem finanças e lojas', async () => {
    await createGame(agent, ownedGame({ playStatus: 'COMPLETED' }));
    await createGame(agent, ownedGame({ title: 'Hades', store: 'Steam', originalPrice: '50', paidPrice: '25', playStatus: 'PLAYING' }));
    await createGame(agent, { title: 'Desejo', ownershipStatus: 'WISHLIST', platform: 'PS5', currentWishPrice: '99' });
    const res = await agent.get('/api/profile/stats');
    expect(res.body.library).toMatchObject({ owned: 2, completed: 1, playing: 1, completionPercent: 50 });
    expect(res.body.finance).toMatchObject({ originalTotal: '249.90', paidTotal: '104.90', savings: '145.00' });
    expect(res.body.platforms).toBe(1);
    expect(res.body.stores.byCount.map((s) => s.name).sort()).toEqual(['Nuuvem', 'Steam']);
    expect(res.body.stores.bySavings[0].name).toBe('Nuuvem');
  });

  it('visitante não lê nem altera nada do perfil privado', async () => {
    const anon = request(app);
    expect((await anon.get('/api/profile')).status).toBe(401);
    expect((await anon.patch('/api/profile').send({ displayName: 'x' })).status).toBe(401);
    expect((await anon.patch('/api/profile/privacy').send({ isPublic: true })).status).toBe(401);
    expect((await anon.put('/api/profile/avatar').attach('image', PNG, 'a.png')).status).toBe(401);
    expect((await anon.get('/api/profile/stats')).status).toBe(401);
  });
});
