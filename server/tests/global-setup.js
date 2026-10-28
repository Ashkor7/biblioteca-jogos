// Aplica as migrações no banco de testes antes da suíte.
import { execSync } from 'node:child_process';
import { resolveTestDatabaseUrl, SERVER_DIR } from './test-db-url.js';

export default function setup() {
  const url = resolveTestDatabaseUrl();
  execSync('npx prisma migrate deploy', {
    cwd: SERVER_DIR,
    env: { ...process.env, DATABASE_URL: url },
    stdio: 'inherit',
  });
}
