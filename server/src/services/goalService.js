// Metas pessoais. O progresso vem dos dados reais (jogos zerados e sessões) e é
// recalculado pelo progressionService; criar ou editar uma meta não dá XP.
import { z } from 'zod';
import { prisma } from '../db.js';
import { notFound } from '../lib/errors.js';
import { parseOrThrow, assertUuid } from '../lib/validate.js';
import { isoDate } from '../lib/serialize.js';
import { goalSchema } from '../../../shared/schemas.js';
import { beginProgress, goalProgressValue, syncProgress } from './progressionService.js';
import { todayIso, dateOnly } from './timeService.js';

async function goalToDto(goal, today) {
  const { value } = await goalProgressValue(prisma, goal.userId, goal);
  const startsOn = isoDate(goal.startsOn);
  const endsOn = isoDate(goal.endsOn);
  const status = goal.completedAt ? 'COMPLETED' : endsOn < today ? 'CLOSED' : startsOn > today ? 'UPCOMING' : 'ACTIVE';
  return {
    id: goal.id,
    name: goal.name,
    type: goal.type,
    startsOn,
    endsOn,
    targetValue: goal.targetValue,
    categoryName: goal.categoryName,
    progress: Math.min(value, goal.targetValue),
    progressValue: value,
    percent: Math.min(100, Math.floor((value / goal.targetValue) * 100)),
    status,
    completedAt: goal.completedAt,
    createdAt: goal.createdAt,
  };
}

const listQuery = z.object({
  status: z.enum(['ACTIVE', 'COMPLETED', 'CLOSED', 'UPCOMING', 'ALL']).default('ALL'),
  year: z.coerce.number().int().min(2000).max(2200).optional(),
});

export async function listGoals(userId, rawQuery = {}) {
  const q = parseOrThrow(listQuery, rawQuery, 'Filtros inválidos');
  const where = { userId };
  if (q.year) {
    where.startsOn = { lte: dateOnly(`${q.year}-12-31`) };
    where.endsOn = { gte: dateOnly(`${q.year}-01-01`) };
  }
  const goals = await prisma.playerGoal.findMany({ where, orderBy: [{ endsOn: 'desc' }, { createdAt: 'desc' }] });
  const today = todayIso();
  const items = [];
  for (const goal of goals) items.push(await goalToDto(goal, today));
  return { items: q.status === 'ALL' ? items : items.filter((g) => g.status === q.status) };
}

function goalData(input) {
  return {
    name: input.name,
    type: input.type,
    startsOn: dateOnly(input.startsOn),
    endsOn: dateOnly(input.endsOn),
    targetValue: input.targetValue,
    categoryName: input.categoryName,
  };
}

export async function createGoal(userId, body) {
  const input = parseOrThrow(goalSchema, body);
  const goal = await prisma.$transaction(async (tx) => {
    await beginProgress(tx, userId);
    const created = await tx.playerGoal.create({ data: { userId, ...goalData(input) } });
    await syncProgress(tx, userId);
    return tx.playerGoal.findUniqueOrThrow({ where: { id: created.id } });
  });
  return goalToDto(goal, todayIso());
}

async function findGoal(client, userId, id) {
  assertUuid(id, 'Meta');
  const goal = await client.playerGoal.findFirst({ where: { id, userId } });
  if (!goal) throw notFound('Meta');
  return goal;
}

export async function updateGoal(userId, id, body) {
  const goal = await prisma.$transaction(async (tx) => {
    await beginProgress(tx, userId);
    const existing = await findGoal(tx, userId, id);
    const input = parseOrThrow(goalSchema, {
      name: existing.name,
      type: existing.type,
      startsOn: isoDate(existing.startsOn),
      endsOn: isoDate(existing.endsOn),
      targetValue: existing.targetValue,
      categoryName: existing.categoryName,
      ...body,
    });
    // Mudou a regra: a conclusão é reavaliada do zero (o XP já pago não é cobrado nem pago de novo).
    await tx.playerGoal.update({ where: { id }, data: { ...goalData(input), completedAt: null } });
    await syncProgress(tx, userId);
    return tx.playerGoal.findUniqueOrThrow({ where: { id } });
  });
  return goalToDto(goal, todayIso());
}

export async function deleteGoal(userId, id) {
  await findGoal(prisma, userId, id);
  await prisma.playerGoal.delete({ where: { id } });
}
