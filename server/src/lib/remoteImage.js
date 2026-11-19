// Download de imagens da Steam para os uploads. Só hosts da allowlist (inclusive nos
// redirecionamentos), só https, com tamanho máximo e timeout. O arquivo passa pelo
// mesmo pipeline dos uploads (magic bytes + nome UUID gerado no servidor).
import { config } from '../config.js';
import { AppError } from './errors.js';
import { saveImageBuffer } from './storage.js';

export const STEAM_IMAGE_HOSTS = Object.freeze([
  'cdn.akamai.steamstatic.com',
  'shared.akamai.steamstatic.com',
  'store.akamai.steamstatic.com',
  'cdn.cloudflare.steamstatic.com',
  'shared.cloudflare.steamstatic.com',
  'store.cloudflare.steamstatic.com',
  'cdn.fastly.steamstatic.com',
  'shared.fastly.steamstatic.com',
  'shared.steamstatic.com',
  'cdn.steamstatic.com',
  'steamcdn-a.akamaihd.net',
  'media.steampowered.com',
  'avatars.akamai.steamstatic.com',
  'avatars.cloudflare.steamstatic.com',
  'avatars.fastly.steamstatic.com',
  'avatars.steamstatic.com',
]);
const ALLOWED = new Set(STEAM_IMAGE_HOSTS);
const MAX_REDIRECTS = 3;

/** true se for https:// num host da Steam permitido (sem usuário/senha nem porta). */
export function isAllowedSteamImageUrl(value) {
  let url;
  try {
    url = new URL(String(value));
  } catch {
    return false;
  }
  return url.protocol === 'https:' && ALLOWED.has(url.hostname) && !url.username && !url.password && !url.port;
}

let fetchImpl = (...args) => globalThis.fetch(...args);
/** Troca o fetch usado nos downloads (testes). Sem argumento, volta ao fetch real. */
export function setRemoteImageFetch(fn) {
  fetchImpl = fn ?? ((...args) => globalThis.fetch(...args));
}

async function readLimited(response, maxBytes) {
  const declared = Number(response.headers?.get?.('content-length'));
  if (Number.isFinite(declared) && declared > maxBytes) throw new AppError(413, 'Imagem remota grande demais');
  if (!response.body?.getReader) {
    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length > maxBytes) throw new AppError(413, 'Imagem remota grande demais');
    return buffer;
  }
  const reader = response.body.getReader();
  const chunks = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > maxBytes) {
      await reader.cancel().catch(() => {});
      throw new AppError(413, 'Imagem remota grande demais');
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks.map((c) => Buffer.from(c)));
}

/**
 * Baixa e grava uma imagem da Steam.
 * @returns {Promise<{ storageKey: string, url: string, mimeType: string, sizeBytes: number }>}
 */
export async function downloadSteamImage(rawUrl, { timeoutMs = config.STEAM_TIMEOUT_MS, maxBytes = config.maxUploadBytes } = {}) {
  let url = String(rawUrl);
  if (!isAllowedSteamImageUrl(url)) throw new AppError(400, 'Endereço de imagem fora da lista de hosts permitidos');
  const signal = AbortSignal.timeout(timeoutMs);
  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    let response;
    try {
      response = await fetchImpl(url, { redirect: 'manual', signal, headers: { accept: 'image/*' } });
    } catch {
      throw new AppError(502, 'Não foi possível baixar a imagem da Steam');
    }
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers?.get?.('location');
      const next = location ? new URL(location, url).toString() : null;
      if (!next || !isAllowedSteamImageUrl(next)) throw new AppError(400, 'Redirecionamento para host não permitido');
      url = next;
      continue;
    }
    if (!response.ok) throw new AppError(502, `A Steam respondeu ${response.status} para a imagem`);
    const buffer = await readLimited(response, maxBytes);
    return saveImageBuffer(buffer); // confere magic bytes e gera o nome (415 se não for imagem)
  }
  throw new AppError(400, 'Redirecionamentos demais ao baixar a imagem');
}
