import { config } from './config.js';
import { createApp } from './app.js';
import { prisma } from './db.js';
import { ensureUploadDir } from './lib/storage.js';
import { startSteamWorker } from './services/steamJobRunner.js';

await ensureUploadDir();
if (config.PUBLIC_READ) {
  console.warn(
    'Aviso: PUBLIC_READ não abre mais a biblioteca para visitantes. Use o perfil público em Configurações → Privacidade (/u/<usuário>).',
  );
}
const app = createApp();
// Retoma importações da Steam que ficaram pela metade quando a API foi fechada.
startSteamWorker()
  .then((n) => n && console.log(`Steam: retomando ${n} importação(ões) pendente(s)`))
  .catch((error) => console.error(`Steam: não foi possível retomar importações: ${error.message}`));
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
