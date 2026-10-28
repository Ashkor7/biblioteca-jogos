// PostgreSQL embutido para desenvolvimento quando não há Docker nem PostgreSQL instalado.
// Usa binários oficiais do PostgreSQL distribuídos via npm (pacote embedded-postgres).
// Uso: npm run db:embedded   (deixe a janela aberta; Ctrl+C para parar)
import fs from 'node:fs';
import path from 'node:path';
import { PROJECT_ROOT } from '../src/env.js';

const { default: EmbeddedPostgres } = await import('embedded-postgres').catch(() => {
  console.error('Pacote embedded-postgres não instalado. Rode: npm install -D embedded-postgres -w server');
  process.exit(1);
});

const databaseUrl = new URL(process.env.DATABASE_URL);
const testUrl = process.env.TEST_DATABASE_URL ? new URL(process.env.TEST_DATABASE_URL) : null;
const dataDir = path.join(PROJECT_ROOT, '.pgdata');
const user = decodeURIComponent(databaseUrl.username);
const password = decodeURIComponent(databaseUrl.password);
const port = Number(databaseUrl.port || 5432);

const pg = new EmbeddedPostgres({ databaseDir: dataDir, user, password, port, persistent: true });

if (!fs.existsSync(path.join(dataDir, 'PG_VERSION'))) {
  console.log(`Criando cluster PostgreSQL em ${dataDir}…`);
  await pg.initialise();
}
await pg.start();

for (const url of [databaseUrl, testUrl].filter(Boolean)) {
  const name = url.pathname.slice(1);
  try {
    await pg.createDatabase(name);
    console.log(`Banco ${name} criado.`);
  } catch {
    // já existe
  }
}
console.log(`PostgreSQL rodando em localhost:${port} (usuário ${user}). Ctrl+C para parar.`);

async function stop() {
  await pg.stop();
  process.exit(0);
}
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
