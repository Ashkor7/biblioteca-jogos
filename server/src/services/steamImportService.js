// Prévia, importação e ressincronização da biblioteca Steam. Os jogos importados são
// jogos comuns (source STEAM): editáveis e excluíveis como os cadastrados à mão.
//
// Regras: OWNED + DIGITAL, preços/loja-da-compra vazios e needsReview=true; horas como
// saldo legado (total = legado + diário, nunca diminui); estado inicial PLAYING se jogou
// nas últimas 2 semanas; progressão em modo retroativo (sem farm de XP nem avisos).
import { prisma } from '../db.js';
import { AppError, notFound } from '../lib/errors.js';
import { parseOrThrow, assertUuid } from '../lib/validate.js';
import { normalizeKey } from '../../../shared/domain.js';
import { steamImportSchema, steamPreviewSchema, steamResyncSchema, steamFillSchema } from '../../../shared/schemas.js';
import { STEAM_PREVIEW_STATUS as S, nonGameType, steamStoreUrl } from '../../../shared/steam.js';
import { callSteam, ensureSteamEnabled, getLinkedAccount, requireLinkedAccount } from './steamAccountService.js';
import { cachedTypes, getAppData } from './steamAppData.js';
import { applySteamData, collectSteamImages, discardImages } from './steamEnrichService.js';
import { findOwnedGame } from './gameService.js';
import { gameInclude, gameToDto } from '../lib/serialize.js';
import { enqueueSteamJob } from './steamJobRunner.js';
import { findOrCreatePlatform, findOrCreateStore } from './lookupService.js';
import { recordActivity } from './activityService.js';
import { beginProgress, syncProgress } from './progressionService.js';

export const STEAM_PRIVATE_MESSAGE =
  'A Steam não mostrou os jogos desta conta. Na Steam, abra Perfil → Editar perfil → Privacidade e deixe "Detalhes de jogos" como Público (ou use uma STEAM_API_KEY gerada na própria conta).';
export const STEAM_EMPTY_MESSAGE =
  'A Steam devolveu a lista de jogos vazia. Se você tem jogos, confira se "Detalhes de jogos" está como Público na privacidade da Steam.';

/** Lê os jogos da conta vinculada, com mensagem clara quando a Steam esconde a lista. */
async function readOwnedGames(account, includeFreeGames) {
  const owned = await callSteam((steam) => steam.getOwnedGames(account.steamId64, { includeFreeGames }));
  return owned;
}

/** Biblioteca do usuário no formato usado para classificar. */
async function libraryIndex(userId) {
  const [games, ignored] = await Promise.all([
    prisma.game.findMany({
      where: { ownerId: userId },
      select: { id: true, title: true, ownershipStatus: true, steamAppId: true, platform: { select: { name: true } } },
    }),
    prisma.steamIgnoredApp.findMany({ where: { userId }, select: { appId: true } }),
  ]);
  const byAppId = new Map();
  const ownedByTitle = new Map();
  const wishByTitle = new Map();
  for (const g of games) {
    if (g.steamAppId) {
      byAppId.set(g.steamAppId, g);
      continue;
    }
    const key = normalizeKey(g.title);
    const target = g.ownershipStatus === 'WISHLIST' ? wishByTitle : ownedByTitle;
    if (key && !target.has(key)) target.set(key, g);
  }
  return { byAppId, ownedByTitle, wishByTitle, ignored: new Set(ignored.map((i) => i.appId)) };
}

const matchDto = (g) =>
  g ? { gameId: g.id, title: g.title, platform: g.platform.name, ownershipStatus: g.ownershipStatus } : null;

/** Classifica um app da conta em relação à biblioteca (ordem de prioridade fixa). */
export function classifyApp(app, index, types) {
  if (index.ignored.has(app.appId)) return { status: S.IGNORED, match: null };
  const linked = index.byAppId.get(app.appId);
  if (linked) return { status: S.EXISTING, match: matchDto(linked) };
  if (nonGameType({ name: app.name, storeType: types.get(app.appId) })) return { status: S.NOT_GAME, match: null };
  const key = normalizeKey(app.name);
  const owned = index.ownedByTitle.get(key);
  if (owned) return { status: S.DUPLICATE, match: matchDto(owned) };
  const wish = index.wishByTitle.get(key);
  if (wish) return { status: S.WISHLIST, match: matchDto(wish) };
  return { status: S.NEW, match: null };
}

export async function previewSteam(userId, body) {
  ensureSteamEnabled();
  const { includeFreeGames } = parseOrThrow(steamPreviewSchema, body ?? {});
  const account = await requireLinkedAccount(userId);
  const owned = await readOwnedGames(account, includeFreeGames);
  const counts = Object.fromEntries(Object.values(S).map((s) => [s, 0]));
  if (!owned.visible || owned.games.length === 0) {
    return {
      visible: owned.visible,
      notice: owned.visible ? STEAM_EMPTY_MESSAGE : STEAM_PRIVATE_MESSAGE,
      total: 0,
      counts,
      items: [],
    };
  }
  const [index, types] = await Promise.all([libraryIndex(userId), cachedTypes(owned.games.map((g) => g.appId))]);
  const items = owned.games
    .map((app) => {
      const { status, match } = classifyApp(app, index, types);
      counts[status] += 1;
      return {
        appId: app.appId,
        name: app.name,
        playtimeMinutes: app.playtimeMinutes,
        playtime2WeeksMinutes: app.playtime2WeeksMinutes,
        lastPlayedAt: app.lastPlayedAt,
        iconUrl: app.iconUrl,
        storeUrl: steamStoreUrl(app.appId),
        appType: types.get(app.appId) ?? null,
        status,
        match,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  return { visible: true, notice: null, total: items.length, counts, items };
}

/** Horas sem duplicar: novo total = max(atual, Steam); legado = total − Σ diário. */
export function mergePlaytime(game, steamMinutes) {
  const sessions = game.playTimeMinutes - game.legacyPlayMinutes;
  const total = Math.max(game.playTimeMinutes, steamMinutes ?? 0);
  return { playTimeMinutes: total, legacyPlayMinutes: total - sessions };
}

function newGameRow(userId, app, platformId, storeId, now) {
  return {
    ownerId: userId,
    title: app.name,
    platformId,
    ownershipStatus: 'OWNED',
    mediaType: 'DIGITAL',
    storeId,
    // Sem preço, data de compra nem valor pago: a Steam não informa. Fica para revisão.
    needsReview: true,
    playStatus: app.playtime2WeeksMinutes > 0 ? 'PLAYING' : 'NOT_STARTED',
    playTimeMinutes: app.playtimeMinutes,
    legacyPlayMinutes: app.playtimeMinutes,
    source: 'STEAM',
    steamAppId: app.appId,
    steamPlaytimeMinutes: app.playtimeMinutes,
    steamLastPlayedAt: app.lastPlayedAt,
    steamSyncedAt: now,
  };
}

/**
 * Cria os jogos novos dentro da transação (idempotente: o índice parcial único e o
 * filtro por appId impedem duplicar). Devolve [{ id, appId }].
 */
export async function createSteamGames(tx, userId, apps, options) {
  if (!apps.length) return [];
  if (!normalizeKey(options.platform) || !normalizeKey(options.store)) throw new Error('Plataforma e loja da importação são obrigatórias');
  const platform = await findOrCreatePlatform(tx, options.platform);
  const store = await findOrCreateStore(tx, options.store);
  const now = new Date();
  const rows = await tx.game.createManyAndReturn({
    data: apps.map((app) => newGameRow(userId, app, platform.id, store.id, now)),
    skipDuplicates: true,
    select: { id: true, steamAppId: true },
  });
  return rows.map((r) => ({ id: r.id, appId: r.steamAppId }));
}

/** Cria o job de enriquecimento com um item por jogo. */
export async function createSyncJob(tx, userId, kind, options, entries, summary) {
  if (!entries.length) return null;
  return tx.steamSyncJob.create({
    data: {
      userId,
      kind,
      options,
      summary,
      total: entries.length,
      items: { create: entries.map((e) => ({ gameId: e.id, appId: e.appId, mode: e.mode ?? 'ENRICH' })) },
    },
    select: { id: true },
  });
}

export async function importSteam(userId, body) {
  ensureSteamEnabled();
  const { items, options } = parseOrThrow(steamImportSchema, body);
  const account = await requireLinkedAccount(userId);
  // Nome e horas vêm sempre da Steam, nunca do que o navegador enviou.
  const owned = await readOwnedGames(account, options.includeFreeGames);
  if (!owned.visible) throw new AppError(409, STEAM_PRIVATE_MESSAGE, { code: 'STEAM_PRIVATE' });
  const apps = new Map(owned.games.map((g) => [g.appId, g]));

  const result = await prisma.$transaction(
    async (tx) => {
      await beginProgress(tx, userId);
      const report = { created: 0, linked: 0, ignored: 0, skipped: [] };
      const taken = new Set(
        (await tx.game.findMany({ where: { ownerId: userId, steamAppId: { not: null } }, select: { steamAppId: true } })).map((g) => g.steamAppId),
      );
      const toCreate = [];
      const linked = [];
      for (const item of items) {
        const app = apps.get(item.appId);
        if (!app) {
          report.skipped.push({ appId: item.appId, reason: 'Este jogo não está na sua conta Steam' });
          continue;
        }
        if (item.action === 'IGNORE') {
          await tx.steamIgnoredApp.upsert({
            where: { userId_appId: { userId, appId: app.appId } },
            create: { userId, appId: app.appId, title: app.name },
            update: {},
          });
          report.ignored += 1;
          continue;
        }
        if (taken.has(app.appId)) {
          report.skipped.push({ appId: app.appId, reason: 'Já está na biblioteca' });
          continue;
        }
        // Escolher importar algo que estava ignorado desfaz o "ignorar".
        await tx.steamIgnoredApp.deleteMany({ where: { userId, appId: app.appId } });
        if (item.action === 'IMPORT') {
          toCreate.push(app);
          taken.add(app.appId);
          continue;
        }
        // LINK: um jogo adquirido, sem vínculo, do próprio usuário. Só campos vazios.
        const game = await tx.game.findFirst({
          where: { id: item.gameId, ownerId: userId, ownershipStatus: 'OWNED', steamAppId: null },
          select: { id: true, playTimeMinutes: true, legacyPlayMinutes: true },
        });
        if (!game) {
          report.skipped.push({ appId: app.appId, reason: 'Jogo para vincular não encontrado (ou já vinculado)' });
          continue;
        }
        await tx.game.update({
          where: { id: game.id },
          data: {
            steamAppId: app.appId,
            steamPlaytimeMinutes: app.playtimeMinutes,
            steamLastPlayedAt: app.lastPlayedAt,
            steamSyncedAt: new Date(),
            ...mergePlaytime(game, app.playtimeMinutes),
          },
        });
        taken.add(app.appId);
        linked.push({ id: game.id, appId: app.appId });
      }
      const created = await createSteamGames(tx, userId, toCreate, options);
      report.created = created.length;
      report.linked = linked.length;
      const job = await createSyncJob(tx, userId, 'IMPORT', options, [...created, ...linked], {
        created: report.created,
        linked: report.linked,
        ignored: report.ignored,
        skipped: report.skipped.length,
      });
      if (report.created + report.linked > 0) {
        // Uma atividade só para a importação inteira (nada de N "Jogo adicionado").
        await recordActivity(tx, userId, {
          type: 'STEAM_IMPORTED',
          dedupeKey: `steam-import:${job.id}`,
          entityId: job.id,
          data: { count: report.created, linked: report.linked },
        });
      }
      await tx.steamAccount.update({ where: { userId }, data: { lastSyncAt: new Date() } });
      // Retroativo: conquistas destravadas pela importação não viram farm nem avisos.
      await syncProgress(tx, userId, { retroactive: true });
      return { ...report, jobId: job?.id ?? null };
    },
    { timeout: 120_000, maxWait: 10_000 },
  );
  enqueueSteamJob(result.jobId);
  return result;
}

export function jobToDto(job) {
  const summary = job.summary ?? {};
  return {
    id: job.id,
    kind: job.kind,
    status: job.status,
    total: job.total,
    processed: job.processed,
    failed: job.failed,
    percent: job.total ? Math.round((job.processed / job.total) * 100) : 100,
    summary: {
      created: summary.created ?? 0,
      linked: summary.linked ?? 0,
      ignored: summary.ignored ?? 0,
      skipped: summary.skipped ?? 0,
      updated: summary.updated ?? 0,
      errors: summary.errors ?? [],
    },
    createdAt: job.createdAt,
    startedAt: job.startedAt,
    finishedAt: job.finishedAt,
  };
}

export async function getSteamJob(userId, id) {
  assertUuid(id, 'Importação');
  const job = await prisma.steamSyncJob.findFirst({ where: { id, userId } });
  if (!job) throw notFound('Importação');
  return jobToDto(job);
}

// ---------------------------------------------------------------------------
// Ressincronizar: só cria o que falta; nunca sobrescreve campos dos jogos existentes.
// Com updatePlaytime, atualiza as leituras da Steam e as horas pela regra do máximo
// (nunca diminui, nunca mexe no diário, nunca muda o estado).
// ---------------------------------------------------------------------------

export async function resyncSteam(userId, body) {
  ensureSteamEnabled();
  const { updatePlaytime, options } = parseOrThrow(steamResyncSchema, body ?? {});
  const account = await requireLinkedAccount(userId);
  const owned = await readOwnedGames(account, options.includeFreeGames);
  if (!owned.visible) throw new AppError(409, STEAM_PRIVATE_MESSAGE, { code: 'STEAM_PRIVATE' });

  const result = await prisma.$transaction(
    async (tx) => {
      await beginProgress(tx, userId);
      const [index, types] = await Promise.all([libraryIndex(userId), cachedTypes(owned.games.map((g) => g.appId))]);
      const missing = [];
      const pendingReview = { duplicates: 0, wishlist: 0 };
      for (const app of owned.games) {
        const { status } = classifyApp(app, index, types);
        if (status === S.NEW) missing.push(app);
        if (status === S.DUPLICATE) pendingReview.duplicates += 1;
        if (status === S.WISHLIST) pendingReview.wishlist += 1;
      }
      const created = await createSteamGames(tx, userId, missing, options);

      let updated = 0;
      const achievementItems = [];
      if (updatePlaytime) {
        const linked = await tx.game.findMany({
          where: { ownerId: userId, steamAppId: { in: owned.games.map((g) => g.appId) } },
          select: { id: true, steamAppId: true, playTimeMinutes: true, legacyPlayMinutes: true, steamPlaytimeMinutes: true, steamLastPlayedAt: true },
        });
        const apps = new Map(owned.games.map((g) => [g.appId, g]));
        const fresh = new Set(created.map((c) => c.id));
        for (const game of linked) {
          if (fresh.has(game.id)) continue;
          const app = apps.get(game.steamAppId);
          const hours = mergePlaytime(game, app.playtimeMinutes);
          const changed =
            hours.playTimeMinutes !== game.playTimeMinutes ||
            game.steamPlaytimeMinutes !== app.playtimeMinutes ||
            game.steamLastPlayedAt?.getTime() !== app.lastPlayedAt?.getTime();
          await tx.game.update({
            where: { id: game.id },
            data: {
              steamPlaytimeMinutes: app.playtimeMinutes,
              steamLastPlayedAt: app.lastPlayedAt,
              steamSyncedAt: new Date(),
              ...hours,
            },
          });
          if (changed) updated += 1;
          if (options.importAchievements && app.hasStats) achievementItems.push({ id: game.id, appId: app.appId, mode: 'ACHIEVEMENTS' });
        }
      }
      const job = await createSyncJob(tx, userId, 'RESYNC', options, [...created, ...achievementItems], {
        created: created.length,
        updated,
      });
      if (created.length > 0) {
        await recordActivity(tx, userId, {
          type: 'STEAM_IMPORTED',
          dedupeKey: `steam-import:${job.id}`,
          entityId: job.id,
          data: { count: created.length, linked: 0 },
        });
      }
      await tx.steamAccount.update({ where: { userId }, data: { lastSyncAt: new Date() } });
      await syncProgress(tx, userId, { retroactive: true });
      return { created: created.length, updated, pendingReview, jobId: job?.id ?? null };
    },
    { timeout: 120_000, maxWait: 10_000 },
  );
  enqueueSteamJob(result.jobId);
  return result;
}

// ---------------------------------------------------------------------------
// "Completar com dados da Steam" num jogo: só campos vazios, ou sobrescrever
// com overwrite=true (a interface pede confirmação explícita).
// ---------------------------------------------------------------------------

export async function fillFromSteam(userId, gameId, body) {
  ensureSteamEnabled();
  const { overwrite } = parseOrThrow(steamFillSchema, body ?? {});
  const game = await findOwnedGame(prisma, userId, gameId);
  if (!game.steamAppId) {
    throw new AppError(409, 'Este jogo não está vinculado a um app da Steam. Vincule pela tela de importação.', { code: 'STEAM_NOT_LINKED_GAME' });
  }
  const data = await getAppData(game.steamAppId);
  if (!data) throw new AppError(404, 'A loja da Steam não tem página para este jogo');
  const account = await getLinkedAccount(userId);
  const achievements = account
    ? await callSteam((steam) => steam.getPlayerAchievements(account.steamId64, game.steamAppId)).catch(() => null)
    : null;
  const images = await collectSteamImages(game, data, { screenshots: 0, overwrite });
  try {
    const { dto, filled, unused } = await prisma.$transaction(async (tx) => {
      await beginProgress(tx, userId);
      const fresh = await findOwnedGame(tx, userId, gameId);
      const applied = await applySteamData(tx, fresh, data, { overwrite, genresAsCategories: true, images, achievements });
      await syncProgress(tx, userId);
      const reloaded = await tx.game.findUniqueOrThrow({ where: { id: gameId }, include: gameInclude });
      return { dto: gameToDto(reloaded), ...applied };
    });
    await discardImages(unused);
    return { game: dto, filled };
  } catch (error) {
    await discardImages(images);
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Lista de ignorados
// ---------------------------------------------------------------------------

export async function listIgnored(userId) {
  const rows = await prisma.steamIgnoredApp.findMany({ where: { userId }, orderBy: { title: 'asc' } });
  return { items: rows.map((r) => ({ appId: r.appId, title: r.title, storeUrl: steamStoreUrl(r.appId), createdAt: r.createdAt })) };
}

export async function unignore(userId, rawAppId) {
  const appId = Number(rawAppId);
  if (!Number.isInteger(appId) || appId <= 0 || appId > 2_147_483_647) throw notFound('Jogo ignorado');
  const { count } = await prisma.steamIgnoredApp.deleteMany({ where: { userId, appId } });
  if (count === 0) throw notFound('Jogo ignorado');
}
