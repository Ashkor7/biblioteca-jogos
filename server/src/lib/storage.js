// Armazenamento de imagens. Dois backends com a mesma interface:
//  - local (padrão): arquivos em UPLOAD_DIR (desenvolvimento ou host com disco persistente);
//  - r2: Cloudflare R2 (API compatível com S3), para hosts com disco temporário (Render grátis).
// O endereço público é sempre /uploads/<nome>: com R2 a própria API lê o objeto do bucket
// (que continua privado) e responde com cache longo. Assim o banco não muda com o backend.
import fs from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { Readable } from 'node:stream';
import { config } from '../config.js';
import { AppError } from './errors.js';

export const PUBLIC_UPLOAD_PREFIX = '/uploads/';
export const KEY_RE = /^[0-9a-f-]{36}\.(jpg|png|webp|gif|avif)$/;
export const isStorageKey = (key) => typeof key === 'string' && KEY_RE.test(key);

const MIME_BY_EXT = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif', avif: 'image/avif' };
export const mimeOfKey = (key) => MIME_BY_EXT[path.extname(key).slice(1)] ?? 'application/octet-stream';

/** Detecta o tipo real pelos "magic bytes" — não confia em extensão nem no mimetype do cliente. */
export function detectImageType(buffer) {
  if (!buffer || buffer.length < 12) return null;
  const b = buffer;
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { ext: 'jpg', mime: 'image/jpeg' };
  if (b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])))
    return { ext: 'png', mime: 'image/png' };
  if (b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP')
    return { ext: 'webp', mime: 'image/webp' };
  if (b.toString('ascii', 0, 6) === 'GIF87a' || b.toString('ascii', 0, 6) === 'GIF89a')
    return { ext: 'gif', mime: 'image/gif' };
  if (b.toString('ascii', 4, 8) === 'ftyp' && /^avi[fs]$/.test(b.toString('ascii', 8, 12)))
    return { ext: 'avif', mime: 'image/avif' };
  return null;
}

// ---------------------------------------------------------------------------
// Backends: put(key, buffer, mime), remove(keys), get(key) → { body: Readable, size, mime } | null
// ---------------------------------------------------------------------------

export function createLocalBackend(dir = config.uploadDir) {
  return {
    kind: 'local',
    async init() {
      await fs.mkdir(dir, { recursive: true });
    },
    async put(key, buffer) {
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(path.join(dir, key), buffer, { flag: 'wx' });
    },
    async remove(keys) {
      await Promise.all(
        keys.map(async (key) => {
          try {
            await fs.unlink(path.join(dir, path.basename(key)));
          } catch (error) {
            if (error.code !== 'ENOENT') console.warn(`Não foi possível remover ${key}:`, error.message);
          }
        }),
      );
    },
    async get(key) {
      const full = path.join(dir, path.basename(key));
      try {
        const stat = await fs.stat(full);
        return { body: createReadStream(full), size: stat.size, mime: mimeOfKey(key) };
      } catch {
        return null;
      }
    },
  };
}

/**
 * Cloudflare R2 pela API S3. `client` pode ser injetado (testes); sem ele, o SDK é
 * carregado sob demanda para não pesar quem usa o backend local.
 */
export function createR2Backend({ bucket = config.R2_BUCKET, client } = {}) {
  let s3 = client ?? null;
  let sdk = null;
  async function load() {
    sdk ??= await import('@aws-sdk/client-s3');
    s3 ??= new sdk.S3Client({
      region: 'auto',
      endpoint: `https://${config.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId: config.R2_ACCESS_KEY_ID, secretAccessKey: config.R2_SECRET_ACCESS_KEY },
      // O R2 não aceita todos os checksums que o SDK novo envia por padrão.
      requestChecksumCalculation: 'WHEN_REQUIRED',
      responseChecksumValidation: 'WHEN_REQUIRED',
    });
    return { s3, sdk };
  }
  // Com cliente injetado, os comandos são objetos simples { name, input } (fácil de conferir nos testes).
  const command = async (name, input) => {
    if (client) return { name, input };
    const { sdk: lib } = await load();
    return new lib[`${name}Command`](input);
  };
  const send = async (name, input) => {
    const { s3: c } = client ? { s3: client } : await load();
    return c.send(await command(name, input));
  };
  return {
    kind: 'r2',
    async init() {
      await send('HeadBucket', { Bucket: bucket });
    },
    async put(key, buffer, mime) {
      await send('PutObject', {
        Bucket: bucket,
        Key: key,
        Body: buffer,
        ContentType: mime,
        CacheControl: 'public, max-age=31536000, immutable',
      });
    },
    async remove(keys) {
      if (!keys.length) return;
      try {
        await send('DeleteObjects', { Bucket: bucket, Delete: { Objects: keys.map((Key) => ({ Key })), Quiet: true } });
      } catch (error) {
        console.warn(`Não foi possível remover ${keys.length} imagem(ns) do R2: ${error.message}`);
      }
    },
    async get(key) {
      try {
        const out = await send('GetObject', { Bucket: bucket, Key: key });
        const body = out.Body instanceof Readable ? out.Body : Readable.from(out.Body);
        return { body, size: out.ContentLength ?? null, mime: out.ContentType ?? mimeOfKey(key) };
      } catch (error) {
        if (error?.name === 'NoSuchKey' || error?.$metadata?.httpStatusCode === 404) return null;
        throw error;
      }
    },
  };
}

let backend = null;
/** Backend em uso (escolhido por STORAGE_DRIVER na primeira chamada). */
export function getStorage() {
  backend ??= config.STORAGE_DRIVER === 'r2' ? createR2Backend() : createLocalBackend();
  return backend;
}
/** Troca o backend (testes). null volta ao configurado. */
export function setStorage(next) {
  backend = next;
}

/** Na inicialização: cria a pasta local ou confere o acesso ao bucket (falha cedo e em PT-BR). */
export async function ensureUploadDir() {
  try {
    await getStorage().init();
  } catch (error) {
    throw new Error(`Armazenamento de imagens indisponível (${getStorage().kind}): ${error.message}`, { cause: error });
  }
}

/**
 * Valida e grava um buffer de imagem com nome gerado no servidor.
 * @returns {{ storageKey: string, url: string, mimeType: string, sizeBytes: number }}
 */
export async function saveImageBuffer(buffer) {
  if (!buffer || buffer.length === 0) throw new AppError(400, 'Arquivo de imagem vazio');
  if (buffer.length > config.maxUploadBytes) {
    throw new AppError(413, `Imagem maior que ${config.MAX_UPLOAD_MB} MB`);
  }
  const type = detectImageType(buffer);
  if (!type) {
    throw new AppError(415, 'Formato não suportado. Envie JPG, PNG, WebP, GIF ou AVIF.');
  }
  const storageKey = `${crypto.randomUUID()}.${type.ext}`;
  try {
    await getStorage().put(storageKey, buffer, type.mime);
  } catch (error) {
    console.error(`[storage] falha ao gravar imagem: ${error.message}`);
    throw new AppError(503, 'Não foi possível guardar a imagem agora. Tente de novo em instantes.', { cause: error });
  }
  return {
    storageKey,
    url: PUBLIC_UPLOAD_PREFIX + storageKey,
    mimeType: type.mime,
    sizeBytes: buffer.length,
  };
}

/** Remove arquivos com segurança: só nomes gerados pelo servidor, sem path traversal. */
export async function removeStoredFiles(keys) {
  const valid = keys.filter(isStorageKey);
  if (valid.length) await getStorage().remove(valid);
}

/** Data URL Base64 (formato antigo) → Buffer. */
export function dataUrlToBuffer(dataUrl) {
  const match = /^data:image\/[a-z0-9.+-]+;base64,([a-z0-9+/=\s]+)$/i.exec(dataUrl ?? '');
  if (!match) return null;
  return Buffer.from(match[1].replace(/\s/g, ''), 'base64');
}
