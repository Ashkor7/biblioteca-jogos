// Imagens no Cloudflare R2 (cliente S3 falso, sem rede): gravar, servir por /uploads e apagar.
import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { Readable } from 'node:stream';
import { prisma, request, resetDb, OWNER, PNG, ownedGame } from './helpers.js';
import { config } from '../src/config.js';
import { createApp } from '../src/app.js';
import { upsertOwner } from '../src/services/authService.js';
import { createR2Backend, setStorage } from '../src/lib/storage.js';

function fakeS3() {
  const objects = new Map();
  const calls = [];
  return {
    objects,
    calls,
    async send({ name, input }) {
      calls.push({ name, input });
      if (name === 'HeadBucket') return {};
      if (name === 'PutObject') {
        objects.set(input.Key, { body: Buffer.from(input.Body), type: input.ContentType });
        return {};
      }
      if (name === 'GetObject') {
        const obj = objects.get(input.Key);
        if (!obj) throw Object.assign(new Error('not found'), { name: 'NoSuchKey' });
        return { Body: Readable.from(obj.body), ContentLength: obj.body.length, ContentType: obj.type };
      }
      if (name === 'DeleteObjects') {
        for (const { Key } of input.Delete.Objects) objects.delete(Key);
        return {};
      }
      throw new Error(`comando inesperado ${name}`);
    },
  };
}

describe('imagens no R2', () => {
  let s3;
  let app;
  let agent;
  beforeAll(() => {
    config.STORAGE_DRIVER = 'r2';
    app = createApp();
  });
  beforeEach(async () => {
    await resetDb();
    s3 = fakeS3();
    setStorage(createR2Backend({ client: s3, bucket: 'nexus-play' }));
    await upsertOwner(OWNER.email, OWNER.password);
    agent = request.agent(app);
    expect((await agent.post('/api/auth/login').send(OWNER)).status).toBe(200);
  });
  afterAll(async () => {
    config.STORAGE_DRIVER = 'local';
    setStorage(null);
    await prisma.$disconnect();
  });

  it('grava no bucket, serve por /uploads e apaga junto com o jogo', async () => {
    const res = await agent.post('/api/games').field('data', JSON.stringify(ownedGame())).attach('cover', PNG, 'capa.png');
    expect(res.status).toBe(201);
    const key = res.body.coverUrl.replace('/uploads/', '');
    expect(res.body.coverUrl).toMatch(/^\/uploads\/[0-9a-f-]{36}\.png$/);
    const put = s3.calls.find((c) => c.name === 'PutObject');
    expect(put.input).toMatchObject({ Bucket: 'nexus-play', Key: key, ContentType: 'image/png' });

    const img = await request(app).get(res.body.coverUrl);
    expect(img.status).toBe(200);
    expect(img.headers['content-type']).toBe('image/png');
    expect(img.headers['cache-control']).toMatch(/immutable/);
    expect(Buffer.compare(img.body, PNG)).toBe(0);

    expect((await agent.delete(`/api/games/${res.body.id}`)).status).toBe(204);
    expect(s3.calls.some((c) => c.name === 'DeleteObjects' && c.input.Delete.Objects[0].Key === key)).toBe(true);
    expect(s3.objects.size).toBe(0);
    expect((await request(app).get(res.body.coverUrl)).status).toBe(404);
  });

  it('só aceita nomes gerados pelo servidor', async () => {
    for (const path of ['/uploads/..%2F.env', '/uploads/qualquer.png', '/uploads/0000.exe']) {
      expect((await request(app).get(path)).status).toBe(404);
    }
    expect(s3.calls.filter((c) => c.name === 'GetObject')).toHaveLength(0);
  });

  it('falha do bucket vira erro claro, sem jogo pela metade', async () => {
    s3.send = async () => {
      throw new Error('R2 fora do ar');
    };
    const res = await agent.post('/api/games').field('data', JSON.stringify(ownedGame())).attach('cover', PNG, 'capa.png');
    expect(res.status).toBe(503);
    expect(res.body.error.message).toMatch(/guardar a imagem/);
    expect(await prisma.game.count()).toBe(0);
  });
});
