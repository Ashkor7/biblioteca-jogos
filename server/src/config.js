import './env.js';
import path from 'node:path';
import { z } from 'zod';
import { SERVER_ROOT } from './env.js';

const bool = (fallback) =>
  z
    .enum(['true', 'false', '1', '0'])
    .optional()
    .transform((v) => (v === undefined ? fallback : v === 'true' || v === '1'));

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3333),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL não definida (veja .env.example)'),
  SESSION_SECRET: z
    .string({ error: 'SESSION_SECRET não definida (veja .env.example)' })
    .min(32, 'SESSION_SECRET precisa ter pelo menos 32 caracteres'),
  SESSION_TTL_HOURS: z.coerce.number().positive().default(168),
  CLIENT_ORIGIN: z.string().default('http://localhost:5173'),
  PUBLIC_READ: bool(false),
  COOKIE_SECURE: z.enum(['true', 'false', 'auto']).default('auto'),
  UPLOAD_DIR: z.string().default(path.join(SERVER_ROOT, 'uploads')),
  MAX_UPLOAD_MB: z.coerce.number().positive().max(50).default(5),
  MAX_IMAGES_PER_GAME: z.coerce.number().int().positive().max(100).default(20),
  LEGACY_IMPORT_MAX_MB: z.coerce.number().positive().max(200).default(30),
  TRUST_PROXY: bool(false),
  LOGIN_RATE_LIMIT: z.coerce.number().int().positive().default(10),
});

function loadConfig() {
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const lines = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`);
    throw new Error(`Configuração inválida:\n${lines.join('\n')}`);
  }
  const env = parsed.data;
  return {
    ...env,
    isProduction: env.NODE_ENV === 'production',
    isTest: env.NODE_ENV === 'test',
    allowedOrigins: env.CLIENT_ORIGIN.split(',').map((o) => o.trim()).filter(Boolean),
    cookieSecure: env.COOKIE_SECURE === 'auto' ? env.NODE_ENV === 'production' : env.COOKIE_SECURE === 'true',
    uploadDir: path.resolve(env.UPLOAD_DIR),
    maxUploadBytes: Math.round(env.MAX_UPLOAD_MB * 1024 * 1024),
  };
}

export const config = loadConfig();
