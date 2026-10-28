import fs from 'node:fs';
import path from 'node:path';
import request from 'supertest';
import { expect } from 'vitest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/db.js';
import { config } from '../src/config.js';
import { upsertOwner } from '../src/services/authService.js';

export const app = createApp();
export { prisma, request };

export const OWNER = { email: 'dono@biblioteca.test', password: 'senha-de-teste-123' };

/** PNG real de 1×1 px. */
export const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);
export const PNG_DATA_URL = `data:image/png;base64,${PNG.toString('base64')}`;

export async function resetDb() {
  await prisma.$executeRawUnsafe(
    'TRUNCATE "GameImage", "GameCategory", "Game", "Category", "Store", "PlatformSlugAlias", "Platform", "User" CASCADE',
  );
}

export async function ownerAgent(credentials = OWNER) {
  await upsertOwner(credentials.email, credentials.password);
  const agent = request.agent(app);
  const res = await agent.post('/api/auth/login').send(credentials);
  expect(res.status).toBe(200);
  return agent;
}

export function ownedGame(overrides = {}) {
  return {
    title: 'Cyberpunk 2077',
    ownershipStatus: 'OWNED',
    mediaType: 'DIGITAL',
    platform: 'Steam',
    originalPrice: '199,90',
    paidPrice: '79,90',
    store: 'Nuuvem',
    ...overrides,
  };
}

export async function createGame(agent, payload) {
  const res = await agent.post('/api/games').send(payload);
  expect(res.status, JSON.stringify(res.body)).toBe(201);
  return res.body;
}

export function uploadedFileExists(url) {
  return fs.existsSync(path.join(config.uploadDir, path.basename(url)));
}
