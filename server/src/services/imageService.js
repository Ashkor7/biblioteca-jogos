import { prisma } from '../db.js';
import { config } from '../config.js';
import { AppError, notFound } from '../lib/errors.js';
import { parseOrThrow, assertUuid } from '../lib/validate.js';
import { gameInclude, gameToDto } from '../lib/serialize.js';
import { saveImageBuffer, removeStoredFiles } from '../lib/storage.js';
import { imageOrderSchema, imagePatchSchema, externalImageSchema } from '../../../shared/schemas.js';
import { findOwnedGame } from './gameService.js';

async function reload(tx, id) {
  return gameToDto(await tx.game.findUniqueOrThrow({ where: { id }, include: gameInclude }));
}

async function assertCapacity(tx, gameId, adding) {
  const count = await tx.gameImage.count({ where: { gameId } });
  if (count + adding > config.MAX_IMAGES_PER_GAME) {
    throw new AppError(
      400,
      `Cada jogo aceita até ${config.MAX_IMAGES_PER_GAME} imagens (já há ${count}).`,
    );
  }
}

/** Upload de uma ou mais imagens; opcionalmente a primeira vira capa. */
export async function addUploadedImages(ownerId, gameId, files, { makeCover = false } = {}) {
  if (!files?.length) throw new AppError(400, 'Selecione pelo menos uma imagem');
  await findOwnedGame(prisma, ownerId, gameId);
  await assertCapacity(prisma, gameId, files.length);

  const saved = [];
  try {
    for (const file of files) saved.push(await saveImageBuffer(file.buffer));
    return await prisma.$transaction(async (tx) => {
      await assertCapacity(tx, gameId, saved.length);
      const hasCover = (await tx.gameImage.count({ where: { gameId, isCover: true } })) > 0;
      const setCover = makeCover || !hasCover;
      if (setCover && hasCover) {
        await tx.gameImage.updateMany({ where: { gameId, isCover: true }, data: { isCover: false } });
      }
      const last = await tx.gameImage.aggregate({ where: { gameId }, _max: { position: true } });
      let position = (last._max.position ?? -1) + 1;
      for (const [index, file] of saved.entries()) {
        await tx.gameImage.create({
          data: { gameId, ...file, isCover: setCover && index === 0, position: position++ },
        });
      }
      return reload(tx, gameId);
    });
  } catch (error) {
    await removeStoredFiles(saved.map((s) => s.storageKey));
    throw error;
  }
}

export async function addExternalImage(ownerId, gameId, body) {
  const input = parseOrThrow(externalImageSchema, body);
  return prisma.$transaction(async (tx) => {
    await findOwnedGame(tx, ownerId, gameId);
    await assertCapacity(tx, gameId, 1);
    const hasCover = (await tx.gameImage.count({ where: { gameId, isCover: true } })) > 0;
    const setCover = input.isCover || !hasCover;
    if (setCover && hasCover) {
      await tx.gameImage.updateMany({ where: { gameId, isCover: true }, data: { isCover: false } });
    }
    const last = await tx.gameImage.aggregate({ where: { gameId }, _max: { position: true } });
    await tx.gameImage.create({
      data: { gameId, url: input.url, isCover: setCover, position: (last._max.position ?? -1) + 1 },
    });
    return reload(tx, gameId);
  });
}

async function findImage(tx, gameId, imageId) {
  assertUuid(imageId, 'Imagem');
  const image = await tx.gameImage.findFirst({ where: { id: imageId, gameId } });
  if (!image) throw notFound('Imagem');
  return image;
}

export async function updateImage(ownerId, gameId, imageId, body) {
  const input = parseOrThrow(imagePatchSchema, body);
  return prisma.$transaction(async (tx) => {
    await findOwnedGame(tx, ownerId, gameId);
    await findImage(tx, gameId, imageId);
    if (input.isCover) {
      await tx.gameImage.updateMany({ where: { gameId, isCover: true }, data: { isCover: false } });
    }
    await tx.gameImage.update({
      where: { id: imageId },
      data: {
        ...(input.isCover ? { isCover: true } : {}),
        ...(body && 'altText' in body ? { altText: input.altText } : {}),
      },
    });
    return reload(tx, gameId);
  });
}

export async function reorderImages(ownerId, gameId, body) {
  const { imageIds } = parseOrThrow(imageOrderSchema, body);
  return prisma.$transaction(async (tx) => {
    const game = await findOwnedGame(tx, ownerId, gameId);
    const current = new Set(game.images.map((img) => img.id));
    const unique = new Set(imageIds);
    if (unique.size !== imageIds.length || unique.size !== current.size || imageIds.some((i) => !current.has(i))) {
      throw new AppError(400, 'A nova ordem precisa conter todas as imagens do jogo, uma vez cada');
    }
    for (const [position, id] of imageIds.entries()) {
      await tx.gameImage.update({ where: { id }, data: { position } });
    }
    return reload(tx, gameId);
  });
}

export async function deleteImage(ownerId, gameId, imageId) {
  const { game, storageKey } = await prisma.$transaction(async (tx) => {
    await findOwnedGame(tx, ownerId, gameId);
    const image = await findImage(tx, gameId, imageId);
    await tx.gameImage.delete({ where: { id: imageId } });
    return { game: await reload(tx, gameId), storageKey: image.storageKey };
  });
  if (storageKey) await removeStoredFiles([storageKey]);
  return game;
}
