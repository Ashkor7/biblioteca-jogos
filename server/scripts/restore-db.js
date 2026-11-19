// Restaura um backup JSON (npm run db:backup) num banco VAZIO — ex.: o PostgreSQL do Railway.
//
// Uso (PowerShell), com a URL pública do banco de destino:
//   $env:RESTORE_DATABASE_URL="postgresql://..."; npm run db:restore -- backups/biblioteca-....json --confirm
//
// - O destino precisa estar migrado (npm run db:deploy) e sem nenhum usuário.
// - Tudo numa transação: ou entra tudo, ou nada.
// - Imagens enviadas (arquivos em uploads) não vão no banco: as linhas delas são puladas e
//   listadas em <backup>.uploads.json, para o `npm run uploads:push` reenviá-las pelo site.
//   Imagens externas (URL https) entram normalmente.
import fs from 'node:fs';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';

// Ordem que respeita as chaves estrangeiras.
const ORDER = [
  'User',
  'Platform',
  'PlatformSlugAlias',
  'Store',
  'Category',
  'Game',
  'GameCategory',
  'GameImage',
  'PlayerProfile',
  'FavoriteGame',
  'GameCollection',
  'GameCollectionItem',
  'GameSession',
  'WishlistPriceEntry',
  'PlayerActivity',
  'UserAchievement',
  'XpTransaction',
  'PlayerGoal',
  'SteamAccount',
  'SteamAppCache',
  'SteamIgnoredApp',
  'SteamSyncJob',
  'SteamSyncJobItem',
];
const SKIP = new Set(['_prisma_migrations']);

const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith('--'));
const url = process.env.RESTORE_DATABASE_URL;

function fail(message) {
  console.error(`Restauração cancelada: ${message}`);
  process.exit(1);
}

if (!file || !fs.existsSync(file)) fail('informe o arquivo de backup (backups/biblioteca-....json).');
if (!url) fail('defina RESTORE_DATABASE_URL com a URL do banco de destino (não usamos o DATABASE_URL do .env por segurança).');
if (!args.includes('--confirm')) fail('confira o destino e rode de novo com --confirm.');

const backup = JSON.parse(fs.readFileSync(file, 'utf8'));
const tables = backup.tables ?? {};
const unknown = Object.keys(tables).filter((t) => !SKIP.has(t) && !ORDER.includes(t) && tables[t].length);
if (unknown.length) fail(`o backup tem tabelas que este script não conhece: ${unknown.join(', ')}`);

// Arquivos locais ficam para o uploads:push; o banco recebe só o que não depende do disco.
const pendingImages = (tables.GameImage ?? []).filter((img) => img.storageKey);
tables.GameImage = (tables.GameImage ?? []).filter((img) => !img.storageKey);
const pendingProfiles = (tables.PlayerProfile ?? [])
  .filter((p) => p.avatarKey || p.bannerKey)
  .map((p) => ({ userId: p.userId, avatarKey: p.avatarKey, bannerKey: p.bannerKey }));
tables.PlayerProfile = (tables.PlayerProfile ?? []).map((p) => ({ ...p, avatarKey: null, bannerKey: null }));

const prisma = new PrismaClient({ datasources: { db: { url } } });
try {
  const target = new URL(url);
  console.log(`Destino: ${target.hostname}${target.pathname}`);
  const counts = await prisma.$transaction(
    async (tx) => {
      const [{ users }] = await tx.$queryRaw`SELECT count(*)::int AS users FROM "User"`;
      if (users > 0) throw new Error('o banco de destino já tem usuários. A restauração só roda num banco vazio.');
      const done = {};
      for (const table of ORDER) {
        const rows = tables[table] ?? [];
        if (!rows.length) continue;
        const existing = await tx.$queryRaw`
          SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = ${table}`;
        const valid = new Set(existing.map((c) => c.column_name));
        // Só as colunas que o backup tem (backups antigos não têm as colunas novas: ficam com o padrão).
        const columns = Object.keys(rows[0]).filter((c) => valid.has(c));
        const list = columns.map((c) => `"${c}"`).join(', ');
        await tx.$executeRawUnsafe(
          `INSERT INTO "${table}" (${list}) SELECT ${list} FROM jsonb_populate_recordset(NULL::"${table}", $1::jsonb)`,
          JSON.stringify(rows),
        );
        done[table] = rows.length;
      }
      return done;
    },
    { timeout: 300_000, maxWait: 30_000 },
  );
  const manifest = file.replace(/\.json$/, '.uploads.json');
  fs.writeFileSync(
    manifest,
    JSON.stringify({ source: path.basename(file), images: pendingImages, profiles: pendingProfiles }, null, 2),
  );
  console.log('Restaurado:');
  for (const [t, n] of Object.entries(counts)) console.log(`  ${t}: ${n}`);
  console.log(`\nImagens para reenviar: ${pendingImages.length} de jogos, ${pendingProfiles.length} perfil(is).`);
  console.log(`Lista em ${manifest}. Próximo passo: npm run uploads:push (veja docs/DEPLOY_RAILWAY.md).`);
} catch (error) {
  fail(error.message);
} finally {
  await prisma.$disconnect();
}
