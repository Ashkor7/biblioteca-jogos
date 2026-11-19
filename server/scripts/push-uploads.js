// Reenvia as imagens locais (server/uploads) para o site publicado, pelo upload normal da API
// (mesma checagem de magic bytes, nome UUID novo). Usa a lista gerada pelo db:restore.
//
// Uso (PowerShell):
//   $env:PUSH_SITE="https://seu-app.up.railway.app"; $env:PUSH_EMAIL="voce@exemplo.com"; $env:PUSH_PASSWORD="..."
//   npm run uploads:push -- backups/biblioteca-....uploads.json
//
// Entra com a conta dona das imagens (o backup local tem um único usuário). Pode rodar de novo:
// imagens já enviadas são registradas em <lista>.done.json e puladas.
import fs from 'node:fs';
import path from 'node:path';
import { SERVER_ROOT } from '../src/env.js';

const manifestFile = process.argv[2];
const site = (process.env.PUSH_SITE ?? '').replace(/\/$/, '');
const email = process.env.PUSH_EMAIL;
const password = process.env.PUSH_PASSWORD;
const uploadDir = path.resolve(process.env.UPLOAD_DIR ?? path.join(SERVER_ROOT, 'uploads'));

function fail(message) {
  console.error(`Envio cancelado: ${message}`);
  process.exit(1);
}
if (!manifestFile || !fs.existsSync(manifestFile)) fail('informe a lista gerada pelo db:restore (backups/....uploads.json).');
if (!/^https:\/\//.test(site)) fail('defina PUSH_SITE com o endereço https do site publicado.');
if (!email || !password) fail('defina PUSH_EMAIL e PUSH_PASSWORD (a conta dona das imagens).');

const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
const doneFile = manifestFile.replace(/\.json$/, '.done.json');
const done = new Set(fs.existsSync(doneFile) ? JSON.parse(fs.readFileSync(doneFile, 'utf8')) : []);
const save = () => fs.writeFileSync(doneFile, JSON.stringify([...done]));

const MIME = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif', avif: 'image/avif' };
const headers = { Origin: site };

const login = await fetch(`${site}/api/auth/login`, {
  method: 'POST',
  headers: { ...headers, 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password }),
});
if (!login.ok) fail(`login recusado (${login.status}).`);
const cookie = login.headers.getSetCookie().map((c) => c.split(';')[0]).join('; ');

function fileBlob(key) {
  const full = path.join(uploadDir, path.basename(key));
  if (!fs.existsSync(full)) return null;
  const ext = path.extname(key).slice(1).toLowerCase();
  return new Blob([fs.readFileSync(full)], { type: MIME[ext] ?? 'application/octet-stream' });
}

let sent = 0;
let missing = 0;
let failed = 0;
// Capa primeiro, depois na ordem original.
const images = [...manifest.images].sort((a, b) => Number(b.isCover) - Number(a.isCover) || a.position - b.position);
for (const img of images) {
  if (done.has(img.id)) continue;
  const blob = fileBlob(img.storageKey);
  if (!blob) {
    missing += 1;
    console.warn(`  arquivo não encontrado: ${img.storageKey}`);
    continue;
  }
  const form = new FormData();
  form.append('images', blob, img.storageKey);
  if (img.isCover) form.set('cover', 'true');
  const res = await fetch(`${site}/api/games/${img.gameId}/images`, { method: 'POST', headers: { ...headers, cookie }, body: form });
  if (res.ok) {
    sent += 1;
    done.add(img.id);
    save();
  } else {
    failed += 1;
    console.warn(`  jogo ${img.gameId}: ${res.status} ${(await res.json().catch(() => ({}))).error?.message ?? ''}`);
  }
}
for (const profile of manifest.profiles ?? []) {
  for (const kind of ['avatar', 'banner']) {
    const key = profile[`${kind}Key`];
    const id = `${profile.userId}:${kind}`;
    if (!key || done.has(id)) continue;
    const blob = fileBlob(key);
    if (!blob) {
      missing += 1;
      continue;
    }
    const form = new FormData();
    form.append('image', blob, key);
    const res = await fetch(`${site}/api/profile/${kind}`, { method: 'PUT', headers: { ...headers, cookie }, body: form });
    if (res.ok) {
      sent += 1;
      done.add(id);
      save();
    } else failed += 1;
  }
}
console.log(`Enviadas: ${sent} · sem arquivo local: ${missing} · com erro: ${failed}`);
if (failed) process.exitCode = 1;
