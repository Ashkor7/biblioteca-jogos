import { config } from './config.js';
import { createApp } from './app.js';
import { prisma } from './db.js';
import { ensureUploadDir } from './lib/storage.js';

await ensureUploadDir();
const app = createApp();
const server = app.listen(config.PORT, config.host, () => {
  const where = config.host === '0.0.0.0' ? 'todas as interfaces de rede' : 'somente este computador';
  console.log(`API da Biblioteca de Jogos em http://${config.host === '0.0.0.0' ? 'localhost' : config.host}:${config.PORT} (${config.NODE_ENV}, ${where})`);
});

async function shutdown(signal) {
  console.log(`\n${signal} recebido, encerrando...`);
  server.close();
  await prisma.$disconnect();
  process.exit(0);
}
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
