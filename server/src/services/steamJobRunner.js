// Enriquecimento em segundo plano (appdetails, imagens, conquistas). Um job por vez,
// item por item, com o progresso no banco: se a API reiniciar, startSteamWorker()
// retoma os jobs pendentes de onde pararam.
import { prisma } from '../db.js';
import { AppError } from '../lib/errors.js';
import { gameInclude } from '../lib/serialize.js';
import { SteamError } from './steamClient.js';
import { callSteam } from './steamAccountService.js';
import { getAppData } from './steamAppData.js';
import { applySteamData, collectSteamImages, discardImages } from './steamEnrichService.js';
import { beginProgress, syncProgress } from './progressionService.js';

const MAX_ERRORS_IN_SUMMARY = 20;
const RATE_LIMIT_PAUSES = 3;

const runner = {
  started: false,
  queue: [],
  draining: false,
  pauseMs: 60_000,
  sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
};

/** Ajustes para testes (pausa ao receber 429). */
export function configureSteamRunner({ pauseMs, sleep } = {}) {
  if (pauseMs !== undefined) runner.pauseMs = pauseMs;
  if (sleep) runner.sleep = sleep;
}

function messageOf(error) {
  if (error instanceof AppError) return error.message;
  if (error instanceof SteamError) return 'A Steam não respondeu para este jogo';
  return 'Erro inesperado ao completar os dados';
}

async function processItem(job, item, account) {
  const game = await prisma.game.findFirst({ where: { id: item.gameId, ownerId: job.userId }, include: gameInclude });
  // Excluído ou desvinculado durante o job: nada a fazer.
  if (!game || game.steamAppId !== item.appId) return 'SKIPPED';
  const options = job.options ?? {};
  const wantAchievements = options.importAchievements !== false && account;
  const achievements = wantAchievements
    ? await callSteam((steam) => steam.getPlayerAchievements(account.steamId64, item.appId)).catch((error) => {
        if (error instanceof AppError && error.code === 'STEAM_RATE_LIMITED') throw error;
        return null; // conquistas são opcionais: sem elas o jogo continua completo
      })
    : null;

  if (item.mode === 'ACHIEVEMENTS') {
    if (!achievements) return 'DONE';
    await prisma.$transaction(async (tx) => {
      await beginProgress(tx, job.userId);
      await applySteamData(tx, game, null, { achievements });
      await syncProgress(tx, job.userId, { retroactive: true });
    });
    return 'DONE';
  }

  const data = await getAppData(item.appId);
  const images = await collectSteamImages(game, data, { screenshots: options.screenshots ?? 0 });
  try {
    const unused = await prisma.$transaction(
      async (tx) => {
        await beginProgress(tx, job.userId);
        const fresh = await tx.game.findFirst({ where: { id: game.id, ownerId: job.userId }, include: gameInclude });
        if (!fresh) return images;
        const result = await applySteamData(tx, fresh, data, {
          overwrite: false,
          genresAsCategories: options.genresAsCategories !== false,
          images,
          achievements,
        });
        // Retroativo: categorias novas podem destravar conquistas, mas sem farm e sem avisos.
        await syncProgress(tx, job.userId, { retroactive: true });
        return result.unused;
      },
      { timeout: 30_000 },
    );
    await discardImages(unused);
  } catch (error) {
    await discardImages(images);
    throw error;
  }
  return 'DONE';
}

async function recordResult(job, item, status, error) {
  await prisma.$transaction(async (tx) => {
    await tx.steamSyncJobItem.update({ where: { id: item.id }, data: { status, error: error?.slice(0, 300) ?? null } });
    const current = await tx.steamSyncJob.findUnique({ where: { id: job.id }, select: { summary: true } });
    const summary = { ...(current?.summary ?? {}) };
    if (status === 'FAILED') {
      const title = (await tx.game.findUnique({ where: { id: item.gameId }, select: { title: true } }))?.title ?? null;
      summary.errors = [...(summary.errors ?? []), { appId: item.appId, title, message: error }].slice(-MAX_ERRORS_IN_SUMMARY);
    }
    if (status === 'SKIPPED') summary.skippedItems = (summary.skippedItems ?? 0) + 1;
    await tx.steamSyncJob.update({
      where: { id: job.id },
      data: {
        processed: { increment: 1 },
        ...(status === 'FAILED' ? { failed: { increment: 1 } } : {}),
        summary,
      },
    });
  });
}

/** Processa todos os itens pendentes de um job (seguro para chamar de novo). */
export async function processSteamJob(jobId) {
  let job = await prisma.steamSyncJob.findUnique({ where: { id: jobId } });
  if (!job || !['PENDING', 'RUNNING'].includes(job.status)) return job;
  job = await prisma.steamSyncJob.update({
    where: { id: jobId },
    data: { status: 'RUNNING', startedAt: job.startedAt ?? new Date() },
  });
  const account = await prisma.steamAccount.findUnique({ where: { userId: job.userId } });
  let pauses = 0;
  for (;;) {
    const state = await prisma.steamSyncJob.findUnique({ where: { id: jobId }, select: { status: true } });
    if (state?.status !== 'RUNNING') return prisma.steamSyncJob.findUnique({ where: { id: jobId } });
    const item = await prisma.steamSyncJobItem.findFirst({ where: { jobId, status: 'PENDING' }, orderBy: { id: 'asc' } });
    if (!item) break;
    try {
      const status = await processItem(job, item, account);
      await recordResult(job, item, status);
      pauses = 0;
    } catch (error) {
      // 429 persistente: pausa e tenta o mesmo item de novo (a Steam libera em alguns minutos).
      if (error instanceof AppError && error.code === 'STEAM_RATE_LIMITED' && pauses < RATE_LIMIT_PAUSES) {
        pauses += 1;
        await runner.sleep(runner.pauseMs * pauses);
        continue;
      }
      await recordResult(job, item, 'FAILED', messageOf(error));
    }
  }
  return prisma.steamSyncJob.update({
    where: { id: jobId },
    data: { status: 'COMPLETED', finishedAt: new Date() },
  });
}

async function drain() {
  if (runner.draining) return;
  runner.draining = true;
  try {
    while (runner.queue.length) {
      const id = runner.queue.shift();
      try {
        await processSteamJob(id);
      } catch (error) {
        // Só a mensagem: nunca URLs (que poderiam conter a chave).
        console.error(`[steam] job ${id} interrompido: ${error?.message ?? error}`);
        await prisma.steamSyncJob
          .updateMany({ where: { id, status: 'RUNNING' }, data: { status: 'FAILED', finishedAt: new Date() } })
          .catch(() => {});
      }
    }
  } finally {
    runner.draining = false;
  }
}

/** Coloca um job na fila (só roda com o worker ligado; nos testes, chame processSteamJob). */
export function enqueueSteamJob(jobId) {
  if (!runner.started || !jobId) return;
  if (!runner.queue.includes(jobId)) runner.queue.push(jobId);
  setImmediate(drain);
}

/** Liga o worker e retoma o que ficou pendente quando a API foi fechada. */
export async function startSteamWorker() {
  runner.started = true;
  const pending = await prisma.steamSyncJob.findMany({
    where: { status: { in: ['PENDING', 'RUNNING'] } },
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  });
  for (const { id } of pending) enqueueSteamJob(id);
  return pending.length;
}
