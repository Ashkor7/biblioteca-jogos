// Cria (ou redefine a senha do) proprietário da biblioteca.
// Uso: npm run admin:create -- --email voce@exemplo.com --password "uma-senha-forte"
// Sem argumentos, usa ADMIN_EMAIL e ADMIN_PASSWORD do .env.
import { parseArgs } from 'node:util';
import { prisma } from '../src/db.js';
import { upsertOwner } from '../src/services/authService.js';

const { values } = parseArgs({
  options: { email: { type: 'string' }, password: { type: 'string' } },
  allowPositionals: false,
});

const email = values.email ?? process.env.ADMIN_EMAIL;
const password = values.password ?? process.env.ADMIN_PASSWORD;

try {
  const user = await upsertOwner(email, password);
  console.log(`Proprietário pronto: ${user.email}`);
} catch (error) {
  console.error(`Não foi possível criar o proprietário: ${error.message}`);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
