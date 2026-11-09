// Linha do tempo do jogador. As atividades são gravadas DENTRO da transação da
// operação que as originou: se a operação falha, nenhuma atividade fica para trás.
import { z } from 'zod';
import { prisma } from '../db.js';
import { parseOrThrow } from '../lib/validate.js';
import { ACTIVITY_TYPES } from '../../../shared/progression.js';
import { isoDateField } from '../../../shared/schemas.js';

/**
 * Registra uma atividade. Com `dedupeKey`, o mesmo evento nunca entra duas vezes
 * (ex.: marcar e desmarcar "zerado" várias vezes gera uma única atividade).
 */
export async function recordActivity(tx, userId, activity) {
  const { type, dedupeKey = null, gameId = null, entityId = null, data = {}, retroactive = false } = activity;
  if (!ACTIVITY_TYPES[type]) throw new Error(`Tipo de atividade desconhecido: ${type}`);
  const result = await tx.playerActivity.createMany({
    data: [{ userId, type, dedupeKey, gameId, entityId, data, retroactive, occurredAt: activity.occurredAt ?? new Date() }],
    skipDuplicates: true,
  });
  return result.count === 1;
}

const listQuery = z.object({
  type: z.enum(Object.keys(ACTIVITY_TYPES), { error: 'Tipo de atividade inválido' }).optional(),
  from: isoDateField('Data inicial inválida').optional(),
  to: isoDateField('Data final inválida').optional(),
  retroactive: z.enum(['true', 'false']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(30),
});

export const activitySelect = {
  id: true,
  type: true,
  gameId: true,
  entityId: true,
  data: true,
  retroactive: true,
  occurredAt: true,
};

export function activityToDto(row) {
  return {
    id: row.id,
    type: row.type,
    label: ACTIVITY_TYPES[row.type] ?? row.type,
    gameId: row.gameId,
    entityId: row.entityId,
    data: row.data ?? {},
    retroactive: row.retroactive,
    occurredAt: row.occurredAt,
  };
}

export function activityWhere(userId, q = {}) {
  const where = { userId };
  if (q.type) where.type = q.type;
  if (q.retroactive) where.retroactive = q.retroactive === 'true';
  if (q.from || q.to) {
    where.occurredAt = {};
    if (q.from) where.occurredAt.gte = new Date(`${q.from}T00:00:00.000Z`);
    if (q.to) where.occurredAt.lt = new Date(new Date(`${q.to}T00:00:00.000Z`).getTime() + 86_400_000);
  }
  return where;
}

export async function listActivities(userId, rawQuery = {}) {
  const q = parseOrThrow(listQuery, rawQuery, 'Filtros inválidos');
  const where = activityWhere(userId, q);
  const [total, rows] = await prisma.$transaction([
    prisma.playerActivity.count({ where }),
    prisma.playerActivity.findMany({
      where,
      select: activitySelect,
      orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
      skip: (q.page - 1) * q.pageSize,
      take: q.pageSize,
    }),
  ]);
  return {
    items: rows.map(activityToDto),
    total,
    page: q.page,
    pageSize: q.pageSize,
    totalPages: Math.max(1, Math.ceil(total / q.pageSize)),
  };
}
