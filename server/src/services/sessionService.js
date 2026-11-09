// Diário de jogatina. Cada alteração de sessão recalcula, na mesma transação,
// Game.playTimeMinutes = legacyPlayMinutes (saldo antigo, sem data) + soma das sessões.
// Assim nada é somado duas vezes, nem ao editar ou excluir uma sessão.
import { z } from 'zod';
import { prisma } from '../db.js';
import { config } from '../config.js';
import { AppError, notFound } from '../lib/errors.js';
import { parseOrThrow, assertUuid } from '../lib/validate.js';
import { isoDate, coverOf } from '../lib/serialize.js';
import { sessionSchema, isoDateField } from '../../../shared/schemas.js';
import { addDays, startOfWeek } from '../../../shared/domain.js';
import { recordActivity } from './activityService.js';
import { beginProgress, syncProgress } from './progressionService.js';
import { todayIso, dateOnly } from './timeService.js';

const int = (v) => Number(v ?? 0);

const sessionSelect = {
  id: true,
  gameId: true,
  playedOn: true,
  durationMinutes: true,
  startedAt: true,
  endedAt: true,
  notes: true,
  createdAt: true,
  game: {
    select: {
      id: true,
      title: true,
      platform: { select: { name: true, slug: true } },
      images: { select: { url: true, isCover: true }, orderBy: [{ position: 'asc' }, { createdAt: 'asc' }], take: 3 },
    },
  },
};

function sessionToDto(s) {
  return {
    id: s.id,
    gameId: s.gameId,
    playedOn: isoDate(s.playedOn),
    durationMinutes: s.durationMinutes,
    startedAt: s.startedAt,
    endedAt: s.endedAt,
    notes: s.notes,
    createdAt: s.createdAt,
    game: { id: s.game.id, title: s.game.title, platform: s.game.platform, coverUrl: coverOf(s.game) },
  };
}

/** Recalcula o total exibido do jogo a partir do saldo legado + sessões. */
async function recomputeGameTime(tx, gameId) {
  const { _sum } = await tx.gameSession.aggregate({ where: { gameId }, _sum: { durationMinutes: true } });
  const game = await tx.game.findUniqueOrThrow({ where: { id: gameId }, select: { legacyPlayMinutes: true } });
  await tx.game.update({
    where: { id: gameId },
    data: { playTimeMinutes: game.legacyPlayMinutes + int(_sum.durationMinutes) },
  });
}

async function ownedGameOrThrow(tx, ownerId, gameId) {
  const game = await tx.game.findFirst({
    where: { id: gameId, ownerId },
    select: { id: true, title: true, ownershipStatus: true },
  });
  if (!game) {
    throw new AppError(400, 'Confira os campos destacados', { fields: { gameId: 'Escolha um jogo da sua biblioteca' } });
  }
  if (game.ownershipStatus !== 'OWNED') {
    throw new AppError(400, 'Confira os campos destacados', {
      fields: { gameId: 'Sessões só valem para jogos adquiridos (não para a lista de desejos)' },
    });
  }
  return game;
}

function assertNotFuture(playedOn) {
  // Folga de um dia para fusos à frente do APP_TIMEZONE.
  if (playedOn > addDays(todayIso(), 1)) {
    throw new AppError(400, 'Confira os campos destacados', { fields: { playedOn: 'A data não pode estar no futuro' } });
  }
}

export async function createSession(ownerId, body) {
  const input = parseOrThrow(sessionSchema, body);
  assertNotFuture(input.playedOn);
  const session = await prisma.$transaction(async (tx) => {
    await beginProgress(tx, ownerId);
    const game = await ownedGameOrThrow(tx, ownerId, input.gameId);
    const created = await tx.gameSession.create({
      data: {
        ownerId,
        gameId: game.id,
        playedOn: dateOnly(input.playedOn),
        durationMinutes: input.durationMinutes,
        startedAt: input.startedAt,
        endedAt: input.endedAt,
        notes: input.notes,
      },
      select: sessionSelect,
    });
    await recomputeGameTime(tx, game.id);
    await recordActivity(tx, ownerId, {
      type: 'SESSION_LOGGED',
      dedupeKey: `session:${created.id}`,
      gameId: game.id,
      entityId: created.id,
      data: { title: game.title, minutes: input.durationMinutes, playedOn: input.playedOn },
    });
    await syncProgress(tx, ownerId);
    return created;
  });
  return sessionToDto(session);
}

async function findSession(tx, ownerId, id) {
  assertUuid(id, 'Sessão');
  const session = await tx.gameSession.findFirst({ where: { id, ownerId }, select: { ...sessionSelect, ownerId: true } });
  if (!session) throw notFound('Sessão');
  return session;
}

export async function updateSession(ownerId, id, body) {
  const session = await prisma.$transaction(async (tx) => {
    await beginProgress(tx, ownerId);
    const existing = await findSession(tx, ownerId, id);
    const merged = {
      gameId: existing.gameId,
      playedOn: isoDate(existing.playedOn),
      durationMinutes: existing.durationMinutes,
      startedAt: existing.startedAt,
      endedAt: existing.endedAt,
      notes: existing.notes,
      ...body,
    };
    // Duração recalculada pelo intervalo quando o usuário mudou início/fim sem mandar a duração.
    if (body && ('startedAt' in body || 'endedAt' in body) && !('durationMinutes' in body)) merged.durationMinutes = null;
    const input = parseOrThrow(sessionSchema, merged);
    assertNotFuture(input.playedOn);
    if (input.gameId !== existing.gameId) await ownedGameOrThrow(tx, ownerId, input.gameId);
    const updated = await tx.gameSession.update({
      where: { id },
      data: {
        gameId: input.gameId,
        playedOn: dateOnly(input.playedOn),
        durationMinutes: input.durationMinutes,
        startedAt: input.startedAt,
        endedAt: input.endedAt,
        notes: input.notes,
      },
      select: sessionSelect,
    });
    await recomputeGameTime(tx, existing.gameId);
    if (input.gameId !== existing.gameId) await recomputeGameTime(tx, input.gameId);
    await syncProgress(tx, ownerId);
    return updated;
  });
  return sessionToDto(session);
}

export async function deleteSession(ownerId, id) {
  await prisma.$transaction(async (tx) => {
    await beginProgress(tx, ownerId);
    const existing = await findSession(tx, ownerId, id);
    await tx.gameSession.delete({ where: { id } });
    await recomputeGameTime(tx, existing.gameId);
    await syncProgress(tx, ownerId);
  });
}

const listQuery = z.object({
  gameId: z.uuid('Jogo inválido').optional(),
  from: isoDateField('Data inicial inválida').optional(),
  to: isoDateField('Data final inválida').optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(30),
});

export async function listSessions(ownerId, rawQuery = {}) {
  const q = parseOrThrow(listQuery, rawQuery, 'Filtros inválidos');
  const where = { ownerId };
  if (q.gameId) where.gameId = q.gameId;
  if (q.from || q.to) {
    where.playedOn = {};
    if (q.from) where.playedOn.gte = dateOnly(q.from);
    if (q.to) where.playedOn.lte = dateOnly(q.to);
  }
  const [total, totalMinutes, rows] = await prisma.$transaction([
    prisma.gameSession.count({ where }),
    prisma.gameSession.aggregate({ where, _sum: { durationMinutes: true } }),
    prisma.gameSession.findMany({
      where,
      select: sessionSelect,
      orderBy: [{ playedOn: 'desc' }, { createdAt: 'desc' }],
      skip: (q.page - 1) * q.pageSize,
      take: q.pageSize,
    }),
  ]);
  return {
    items: rows.map(sessionToDto),
    total,
    totalMinutes: int(totalMinutes._sum.durationMinutes),
    page: q.page,
    pageSize: q.pageSize,
    totalPages: Math.max(1, Math.ceil(total / q.pageSize)),
  };
}

const summaryQuery = z.object({
  month: z
    .string()
    .regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Mês inválido (use AAAA-MM)')
    .optional(),
});

/** Resumo do diário: semana, mês, dias ativos, calendário e jogos mais jogados. */
export async function diarySummary(ownerId, rawQuery = {}) {
  const q = parseOrThrow(summaryQuery, rawQuery, 'Filtros inválidos');
  const today = todayIso();
  const month = q.month ?? today.slice(0, 7);
  const monthStart = `${month}-01`;
  const nextMonth = new Date(`${monthStart}T00:00:00Z`);
  nextMonth.setUTCMonth(nextMonth.getUTCMonth() + 1);
  const monthEnd = addDays(nextMonth.toISOString().slice(0, 10), -1);
  const weekStart = startOfWeek(today);
  const weekEnd = addDays(weekStart, 6);

  const [totals] = await prisma.$queryRaw`
    SELECT
      COALESCE(sum("durationMinutes") FILTER (WHERE "playedOn" BETWEEN ${weekStart}::date AND ${weekEnd}::date), 0) AS week_minutes,
      COALESCE(sum("durationMinutes") FILTER (WHERE "playedOn" BETWEEN ${monthStart}::date AND ${monthEnd}::date), 0) AS month_minutes,
      count(DISTINCT "playedOn") FILTER (WHERE "playedOn" BETWEEN ${monthStart}::date AND ${monthEnd}::date) AS month_active_days,
      count(*) FILTER (WHERE "playedOn" BETWEEN ${monthStart}::date AND ${monthEnd}::date) AS month_sessions,
      count(DISTINCT "playedOn") AS active_days,
      COALESCE(sum("durationMinutes"), 0) AS total_minutes,
      count(*) AS sessions
    FROM "GameSession" WHERE "ownerId" = ${ownerId}::uuid`;
  const days = await prisma.$queryRaw`
    SELECT to_char("playedOn", 'YYYY-MM-DD') AS day, sum("durationMinutes") AS minutes, count(*) AS sessions
    FROM "GameSession"
    WHERE "ownerId" = ${ownerId}::uuid AND "playedOn" BETWEEN ${monthStart}::date AND ${monthEnd}::date
    GROUP BY "playedOn" ORDER BY "playedOn"`;
  const week = await prisma.$queryRaw`
    SELECT to_char("playedOn", 'YYYY-MM-DD') AS day, sum("durationMinutes") AS minutes
    FROM "GameSession"
    WHERE "ownerId" = ${ownerId}::uuid AND "playedOn" BETWEEN ${weekStart}::date AND ${weekEnd}::date
    GROUP BY "playedOn"`;
  const top = await prisma.$queryRaw`
    SELECT g.id, g.title, p.name AS platform, sum(s."durationMinutes") AS minutes, count(*) AS sessions,
           max(s."playedOn") AS last_played
    FROM "GameSession" s JOIN "Game" g ON g.id = s."gameId" JOIN "Platform" p ON p.id = g."platformId"
    WHERE s."ownerId" = ${ownerId}::uuid
    GROUP BY g.id, g.title, p.name
    ORDER BY minutes DESC, g.title ASC LIMIT 8`;
  const weekByDay = new Map(week.map((d) => [d.day, int(d.minutes)]));
  return {
    today,
    timeZone: config.APP_TIMEZONE,
    week: {
      from: weekStart,
      to: weekEnd,
      minutes: int(totals.week_minutes),
      days: Array.from({ length: 7 }, (_, i) => {
        const day = addDays(weekStart, i);
        return { day, minutes: weekByDay.get(day) ?? 0 };
      }),
    },
    month: {
      month,
      from: monthStart,
      to: monthEnd,
      minutes: int(totals.month_minutes),
      activeDays: int(totals.month_active_days),
      sessions: int(totals.month_sessions),
      days: days.map((d) => ({ day: d.day, minutes: int(d.minutes), sessions: int(d.sessions) })),
    },
    allTime: {
      activeDays: int(totals.active_days),
      minutes: int(totals.total_minutes),
      sessions: int(totals.sessions),
    },
    topGames: top.map((t) => ({
      id: t.id,
      title: t.title,
      platform: t.platform,
      minutes: int(t.minutes),
      sessions: int(t.sessions),
      lastPlayed: isoDate(t.last_played),
    })),
  };
}
