// Importa o JSON exportado da versão antiga (localStorage['jogos']).
// Uso: npm run import:legacy -w server -- --file jogos.json [--email voce@exemplo.com]
import fs from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { prisma } from '../src/db.js';
import { importLegacy } from '../src/services/legacyImportService.js';

const { values } = parseArgs({ options: { file: { type: 'string' }, email: { type: 'string' } } });
try {
  if (!values.file) throw new Error('Informe --file caminho/do/arquivo.json');
  const email = (values.email ?? process.env.ADMIN_EMAIL)?.toLowerCase();
  const owner = email
    ? await prisma.user.findUnique({ where: { email } })
    : await prisma.user.findFirst({ orderBy: { createdAt: 'asc' } });
  if (!owner) throw new Error('Nenhum proprietário encontrado. Rode antes: npm run admin:create');
  const data = JSON.parse(await fs.readFile(values.file, 'utf8'));
  const report = await importLegacy(owner.id, data);
  console.log(JSON.stringify(report, null, 2));
} catch (error) {
  console.error(`Falha na importação: ${error.message}`);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
