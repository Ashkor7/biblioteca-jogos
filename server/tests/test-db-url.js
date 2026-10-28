import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const here = path.dirname(fileURLToPath(import.meta.url));
export const SERVER_DIR = path.resolve(here, '..');
dotenv.config({ path: path.resolve(SERVER_DIR, '..', '.env'), quiet: true });

/** Banco exclusivo de testes: TEST_DATABASE_URL ou o DATABASE_URL com sufixo _test. */
export function resolveTestDatabaseUrl() {
  let url = process.env.TEST_DATABASE_URL;
  if (!url) {
    if (!process.env.DATABASE_URL) {
      throw new Error('Defina DATABASE_URL ou TEST_DATABASE_URL no .env para rodar os testes da API.');
    }
    const parsed = new URL(process.env.DATABASE_URL);
    parsed.pathname = `${parsed.pathname.replace(/\/$/, '')}_test`;
    url = parsed.toString();
  }
  const dbName = new URL(url).pathname.slice(1);
  if (!/test/i.test(dbName)) {
    throw new Error(`Por segurança, o banco de testes precisa ter "test" no nome (recebido: ${dbName}).`);
  }
  return url;
}
