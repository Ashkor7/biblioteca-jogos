import './env.js';
import path from 'node:path';
import { z } from 'zod';
import { SERVER_ROOT } from './env.js';

const bool = (fallback) =>
  z
    .enum(['true', 'false', '1', '0'])
    .optional()
    .transform((v) => (v === undefined ? fallback : v === 'true' || v === '1'));

// Textos de exemplo do .env.example: nunca podem valer como segredo de verdade.
const PLACEHOLDER_RE = /troque|change[-_ ]?me/i;

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3333),
  // Endereço em que a API escuta. Sem HOST: só o próprio computador (127.0.0.1)
  // em desenvolvimento; todas as interfaces (0.0.0.0) em produção.
  HOST: z.string().min(1).optional(),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL não definida (veja .env.example)'),
  SESSION_SECRET: z
    .string({ error: 'SESSION_SECRET não definida (veja .env.example)' })
    .min(32, 'SESSION_SECRET precisa ter pelo menos 32 caracteres')
    .refine(
      (v) => !PLACEHOLDER_RE.test(v),
      'SESSION_SECRET ainda é o texto de exemplo do .env.example. Gere um segredo com: node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'hex\'))"',
    ),
  SESSION_TTL_HOURS: z.coerce.number().positive().default(168),
  CLIENT_ORIGIN: z.string().default('http://localhost:5173'),
  // Obsoleta desde a v3: o compartilhamento passou a ser o perfil público (/u/:username),
  // que respeita as preferências de privacidade. Mantida só para avisar quem ainda a usa.
  PUBLIC_READ: bool(false),
  // Fuso usado para "hoje", semana e mês do diário e das metas.
  APP_TIMEZONE: z
    .string()
    .default('America/Sao_Paulo')
    .refine((tz) => {
      try {
        new Intl.DateTimeFormat('en-US', { timeZone: tz });
        return true;
      } catch {
        return false;
      }
    }, 'APP_TIMEZONE inválido (use um fuso IANA, ex.: America/Sao_Paulo)'),
  // Endereço público do app (ex.: https://biblioteca.exemplo.com). Sem ele, a interface não
  // oferece "copiar link" do perfil, porque localhost não é acessível por outras pessoas.
  PUBLIC_APP_URL: z.url('PUBLIC_APP_URL precisa ser uma URL completa').optional(),
  PUBLIC_RATE_LIMIT: z.coerce.number().int().positive().default(120),
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
    host: env.HOST ?? (env.NODE_ENV === 'production' ? '0.0.0.0' : '127.0.0.1'),
    isTest: env.NODE_ENV === 'test',
    allowedOrigins: env.CLIENT_ORIGIN.split(',').map((o) => o.trim()).filter(Boolean),
    cookieSecure: env.COOKIE_SECURE === 'auto' ? env.NODE_ENV === 'production' : env.COOKIE_SECURE === 'true',
    uploadDir: path.resolve(env.UPLOAD_DIR),
    maxUploadBytes: Math.round(env.MAX_UPLOAD_MB * 1024 * 1024),
  };
}

export const config = loadConfig();
export { PLACEHOLDER_RE };
