// Backup lógico do banco (JSON) antes de migrações. Não precisa de pg_dump:
// lê todas as tabelas do schema public numa única transação REPEATABLE READ,
// então o arquivo é um retrato consistente mesmo com a API ligada.
// Uso: npm run db:backup   → backups/biblioteca-AAAA-MM-DDTHH-MM-SS.json
// O arquivo contém o hash da senha: guarde-o fora do Git (backups/ é ignorada).
import fs from 'node:fs';
import path from 'node:path';
import { Prisma } from '@prisma/client';
import { prisma } from '../src/db.js';
import { PROJECT_ROOT } from '../src/env.js';

const replacer = (_key, value) => (typeof value === 'bigint' ? value.toString() : value);

try {
  const snapshot = await prisma.$transaction(
    async (tx) => {
      const tables = await tx.$queryRaw`
        SELECT table_name FROM information_schema.tables
        WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
        ORDER BY table_name`;
      const data = {};
      for (const { table_name: name } of tables) {
        data[name] = await tx.$queryRawUnsafe(`SELECT * FROM "${name.replace(/"/g, '""')}"`);
      }
      return data;
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead, timeout: 120_000 },
  );

  const dir = path.join(PROJECT_ROOT, 'backups');
  fs.mkdirSync(dir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const file = path.join(dir, `biblioteca-${stamp}.json`);
  fs.writeFileSync(file, JSON.stringify({ createdAt: new Date().toISOString(), tables: snapshot }, replacer, 2));
  const counts = Object.entries(snapshot).map(([t, rows]) => `${t}: ${rows.length}`);
  console.log(`Backup salvo em ${file}\n  ${counts.join('\n  ')}`);
} catch (error) {
  console.error(`Falha no backup: ${error.message}`);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
