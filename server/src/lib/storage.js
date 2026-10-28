// Armazenamento local de imagens (desenvolvimento). Em produção, aponte UPLOAD_DIR
// para um volume persistente — ou troque este módulo por um serviço de objetos.
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { config } from '../config.js';
import { AppError } from './errors.js';

export const PUBLIC_UPLOAD_PREFIX = '/uploads/';
const KEY_RE = /^[0-9a-f-]{36}\.(jpg|png|webp|gif|avif)$/;

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

export async function ensureUploadDir() {
  await fs.mkdir(config.uploadDir, { recursive: true });
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
  await ensureUploadDir();
  const storageKey = `${crypto.randomUUID()}.${type.ext}`;
  await fs.writeFile(path.join(config.uploadDir, storageKey), buffer, { flag: 'wx' });
  return {
    storageKey,
    url: PUBLIC_UPLOAD_PREFIX + storageKey,
    mimeType: type.mime,
    sizeBytes: buffer.length,
  };
}

/** Remove arquivos com segurança: só nomes gerados pelo servidor, sem path traversal. */
export async function removeStoredFiles(keys) {
  await Promise.all(
    keys
      .filter((key) => typeof key === 'string' && KEY_RE.test(key))
      .map(async (key) => {
        const target = path.join(config.uploadDir, path.basename(key));
        try {
          await fs.unlink(target);
        } catch (error) {
          if (error.code !== 'ENOENT') console.warn(`Não foi possível remover ${key}:`, error.message);
        }
      }),
  );
}

/** Data URL Base64 (formato antigo) → Buffer. */
export function dataUrlToBuffer(dataUrl) {
  const match = /^data:image\/[a-z0-9.+-]+;base64,([a-z0-9+/=\s]+)$/i.exec(dataUrl ?? '');
  if (!match) return null;
  return Buffer.from(match[1].replace(/\s/g, ''), 'base64');
}
