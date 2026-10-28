// Importação única dos dados antigos do localStorage.
import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { prisma, resetDb, ownerAgent, PNG_DATA_URL, uploadedFileExists } from './helpers.js';

const legacy = [
  { id: 1715000000000, nome: 'God of War', categoria: 'Ação', plataforma: 'PlayStation', preco: 199.9, status: 'Zerado', capa: PNG_DATA_URL, avaliacao: '5', destaque: true },
  { id: 1715000000001, nome: 'Stardew Valley', categoria: 'Simulação', plataforma: 'PC', preco: 24.99, status: 'Não iniciado', capa: '', avaliacao: '', destaque: false },
  { id: 1715000000002, nome: '', plataforma: 'PC' },
];

describe('importação legada', () => {
  let agent;
  beforeEach(async () => {
    await resetDb();
    agent = await ownerAgent();
  });
  afterAll(() => prisma.$disconnect());

  it('converte registros, grava capa como arquivo e marca para revisão', async () => {
    const res = await agent.post('/api/import/legacy').send(legacy);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ received: 3, imported: 2, skipped: 0 });
    expect(res.body.failed).toHaveLength(1);

    const list = (await agent.get('/api/games?sort=title')).body.items;
    const gow = list.find((g) => g.title === 'God of War');
    expect(gow).toMatchObject({
      ownershipStatus: 'OWNED',
      originalPrice: '199.90',
      paidPrice: null,
      store: null,
      playStatus: 'COMPLETED',
      ratingStars: 5,
      isFeatured: true,
      needsReview: true,
      platform: { name: 'PlayStation' },
    });
    expect(gow.categories.map((c) => c.name)).toEqual(['Ação']);
    expect(gow.coverUrl).toMatch(/^\/uploads\//);
    expect(uploadedFileExists(gow.coverUrl)).toBe(true);

    // Não conta gasto/economia até o usuário completar os dados.
    const stats = (await agent.get('/api/statistics/overview')).body;
    expect(stats.library.owned).toBe(2);
    expect(stats.finance).toMatchObject({ originalTotal: '0.00', paidTotal: '0.00', pendingPriceReview: 2 });
  });

  it('não duplica ao importar de novo', async () => {
    await agent.post('/api/import/legacy').send(legacy);
    const again = await agent.post('/api/import/legacy').send({ games: legacy });
    expect(again.body).toMatchObject({ imported: 0, skipped: 2 });
    expect(await prisma.game.count()).toBe(2);
  });

  it('edições parciais funcionam e completar a compra encerra a revisão', async () => {
    await agent.post('/api/import/legacy').send(legacy);
    const game = await prisma.game.findFirst({ where: { title: 'Stardew Valley' } });
    const partial = await agent.patch(`/api/games/${game.id}`).send({ playTimeMinutes: 120 });
    expect(partial.status).toBe(200);
    expect(partial.body.needsReview).toBe(true);
    const done = await agent
      .patch(`/api/games/${game.id}`)
      .send({ mediaType: 'DIGITAL', paidPrice: '12,49', store: 'Steam' });
    expect(done.body.needsReview).toBe(false);
    const stats = (await agent.get('/api/statistics/overview')).body;
    expect(stats.finance).toMatchObject({ originalTotal: '24.99', paidTotal: '12.49', pendingPriceReview: 1 });
  });

  it('rejeita formato inválido', async () => {
    const res = await agent.post('/api/import/legacy').send({ foo: 'bar' });
    expect(res.status).toBe(400);
  });
});
