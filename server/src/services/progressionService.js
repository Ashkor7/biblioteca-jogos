// Motor de progressão: XP, níveis, conquistas e metas. Única fonte de verdade
// para conceder XP — o frontend nunca decide desbloqueios.
//
// Idempotência: cada concessão de XP tem eventKey único por usuário (o banco
// recusa a segunda), conquistas têm chave (userId, code) e atividades têm dedupeKey.
// syncProgress() roda no fim de toda operação que muda a biblioteca, na MESMA
// transação, com um lock por usuário: falhas não deixam XP pela metade e duas
// requisições simultâneas não pagam o mesmo evento duas vezes.
import crypto from 'node:crypto';
import { prisma } from '../db.js';
import { config } from '../config.js';
import { normalizeKey } from '../../../shared/domain.js';
import {
  ACHIEVEMENTS,
  CELEBRATION_TYPES,
  XP_RULES,
  levelForXp,
  levelProgress,
} from '../../../shared/progression.js';
import { recordActivity, activitySelect, activityToDto } from './activityService.js';

const int = (value) => Number(value ?? 0);

/** Cria o perfil na primeira vez (username aleatório: nada derivado do e-mail). */
export async function ensureProfile(tx, userId) {
  const existing = await tx.playerProfile.findUnique({ where: { userId } });
  if (existing) return existing;
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const username = `jogador-${crypto.randomBytes(3).toString('hex')}`;
    const taken = await tx.playerProfile.findUnique({ where: { username }, select: { userId: true } });
    if (taken) continue;
    // Avisos só a partir de agora; o que for processado retroativamente não "pipoca" na tela.
    return tx.playerProfile.create({
      data: { userId, username, displayName: 'Jogador', notificationsSeenAt: new Date() },
    });
  }
  throw new Error('Não foi possível gerar um nome de usuário único');
}

/** Números do estado atual da biblioteca usados pelas conquistas (só jogos adquiridos contam como coleção). */
export async function computeMetrics(tx, userId) {
  const [row] = await tx.$queryRaw`
    SELECT
      count(*) FILTER (WHERE g."ownershipStatus" = 'OWNED') AS owned,
      count(*) FILTER (WHERE g."ownershipStatus" = 'OWNED' AND g."playStatus" = 'COMPLETED') AS completed,
      COALESCE(sum(g."playTimeMinutes") FILTER (WHERE g."ownershipStatus" = 'OWNED'), 0) AS minutes,
      count(DISTINCT g."platformId") FILTER (WHERE g."ownershipStatus" = 'OWNED') AS platforms,
      count(*) FILTER (WHERE g."ownershipStatus" = 'OWNED' AND g."paidPrice" < g."originalPrice") AS deals,
      count(*) FILTER (WHERE g."ratingStars" IS NOT NULL) AS rated,
      (SELECT count(DISTINCT rg.id) FROM "Game" rg
         JOIN "GameCategory" gc ON gc."gameId" = rg.id
         JOIN "Category" c ON c.id = gc."categoryId"
        WHERE rg."ownerId" = ${userId}::uuid AND rg."ownershipStatus" = 'OWNED'
          AND rg."playStatus" = 'COMPLETED' AND c."normalizedName" = 'rpg') AS rpg_completed,
      (SELECT count(*) FROM "GameSession" s WHERE s."ownerId" = ${userId}::uuid) AS sessions,
      (SELECT count(DISTINCT s."playedOn") FROM "GameSession" s WHERE s."ownerId" = ${userId}::uuid) AS session_days,
      (SELECT count(*) FROM "GameCollection" c WHERE c."ownerId" = ${userId}::uuid) AS collections,
      (SELECT count(*) FROM "PlayerGoal" pg WHERE pg."userId" = ${userId}::uuid) AS goals,
      (SELECT count(*) FROM "PlayerGoal" pg WHERE pg."userId" = ${userId}::uuid AND pg."completedAt" IS NOT NULL) AS goals_completed,
      (SELECT count(*) FROM "PlayerActivity" a WHERE a."userId" = ${userId}::uuid AND a.type = 'WISHLIST_PURCHASED') AS conversions
    FROM "Game" g
    WHERE g."ownerId" = ${userId}::uuid`;
  const minutes = int(row.minutes);
  return {
    owned: int(row.owned),
    completed: int(row.completed),
    totalMinutes: minutes,
    totalHours: Math.floor(minutes / 60),
    platforms: int(row.platforms),
    dealPurchases: int(row.deals),
    ratedGames: int(row.rated),
    rpgCompleted: int(row.rpg_completed),
    sessions: int(row.sessions),
    sessionDays: int(row.session_days),
    collections: int(row.collections),
    goals: int(row.goals),
    goalsCompleted: int(row.goals_completed),
    wishlistConversions: int(row.conversions),
  };
}

/** Concede XP uma única vez por eventKey. Retorna true se gravou agora. */
async function grantXp(tx, userId, { eventKey, source, amount, description, retroactive = false }) {
  const result = await tx.xpTransaction.createMany({
    data: [{ userId, eventKey, source, amount, description: description.slice(0, 200), retroactive }],
    skipDuplicates: true,
  });
  return result.count === 1;
}

/** Quantas concessões ainda cabem no limite da regra (janela móvel). */
async function remainingCap(tx, userId, source) {
  const rule = XP_RULES[source];
  const since = new Date(Date.now() - rule.windowHours * 3_600_000);
  const used = await tx.xpTransaction.count({
    where: { userId, source, retroactive: false, createdAt: { gte: since } },
  });
  return Math.max(0, rule.cap - used);
}

/**
 * XP por estado: jogos zerados, primeiras notas e sessões que ainda não pagaram.
 * No processamento retroativo não há limite (cada evento continua pagando uma vez só).
 */
async function grantStateXp(tx, userId, backfill) {
  const sources = [
    {
      source: 'GAME_COMPLETED',
      prefix: 'game-completed:',
      rows: (limit) => tx.$queryRaw`
        SELECT g.id, g.title FROM "Game" g
        WHERE g."ownerId" = ${userId}::uuid AND g."ownershipStatus" = 'OWNED' AND g."playStatus" = 'COMPLETED'
          AND NOT EXISTS (SELECT 1 FROM "XpTransaction" x WHERE x."userId" = ${userId}::uuid AND x."eventKey" = 'game-completed:' || g.id::text)
        ORDER BY g."updatedAt" ASC LIMIT ${limit}`,
      describe: (r) => `Zerou ${r.title}`,
    },
    {
      source: 'GAME_RATED',
      prefix: 'rated:',
      rows: (limit) => tx.$queryRaw`
        SELECT g.id, g.title FROM "Game" g
        WHERE g."ownerId" = ${userId}::uuid AND g."ratingStars" IS NOT NULL
          AND NOT EXISTS (SELECT 1 FROM "XpTransaction" x WHERE x."userId" = ${userId}::uuid AND x."eventKey" = 'rated:' || g.id::text)
        ORDER BY g."updatedAt" ASC LIMIT ${limit}`,
      describe: (r) => `Deu nota a ${r.title}`,
    },
    {
      source: 'SESSION_LOGGED',
      prefix: 'session:',
      rows: (limit) => tx.$queryRaw`
        SELECT s.id, g.title FROM "GameSession" s JOIN "Game" g ON g.id = s."gameId"
        WHERE s."ownerId" = ${userId}::uuid AND s."durationMinutes" >= ${XP_RULES.SESSION_LOGGED.minMinutes}
          AND NOT EXISTS (SELECT 1 FROM "XpTransaction" x WHERE x."userId" = ${userId}::uuid AND x."eventKey" = 'session:' || s.id::text)
        ORDER BY s."createdAt" ASC LIMIT ${limit}`,
      describe: (r) => `Sessão de ${r.title}`,
    },
  ];
  for (const { source, prefix, rows, describe } of sources) {
    const limit = backfill ? 100_000 : await remainingCap(tx, userId, source);
    if (limit === 0) continue;
    for (const row of await rows(limit)) {
      await grantXp(tx, userId, {
        eventKey: prefix + row.id,
        source,
        amount: XP_RULES[source].amount,
        description: describe(row),
        retroactive: backfill,
      });
    }
  }
}

/** Progresso de uma meta, calculado no banco a partir dos dados reais. */
export async function goalProgressValue(client, userId, goal) {
  const tz = config.APP_TIMEZONE;
  // Texto "AAAA-MM-DD": um Date viraria timestamp e o ::date dependeria do fuso da sessão.
  const from = goal.startsOn.toISOString().slice(0, 10);
  const to = goal.endsOn.toISOString().slice(0, 10);
  if (goal.type === 'PLAY_HOURS') {
    const [row] = await client.$queryRaw`
      SELECT COALESCE(sum("durationMinutes"), 0) AS minutes FROM "GameSession"
      WHERE "ownerId" = ${userId}::uuid AND "playedOn" BETWEEN ${from}::date AND ${to}::date`;
    return { value: Math.floor(int(row.minutes) / 60), minutes: int(row.minutes) };
  }
  const category = goal.type === 'COMPLETE_CATEGORY' ? normalizeKey(goal.categoryName) : null;
  const [row] = await client.$queryRaw`
    SELECT count(*) AS n FROM "Game" g
    WHERE g."ownerId" = ${userId}::uuid AND g."ownershipStatus" = 'OWNED' AND g."playStatus" = 'COMPLETED'
      AND g."completedAt" IS NOT NULL
      AND ((g."completedAt" AT TIME ZONE 'UTC') AT TIME ZONE ${tz})::date BETWEEN ${from}::date AND ${to}::date
      AND (${goal.type !== 'COMPLETE_BACKLOG'} OR g."createdAt" < ${from}::date)
      AND (${category}::text IS NULL OR EXISTS (
        SELECT 1 FROM "GameCategory" gc JOIN "Category" c ON c.id = gc."categoryId"
        WHERE gc."gameId" = g.id AND c."normalizedName" = ${category}::text))`;
  return { value: int(row.n) };
}

/** Atualiza a conclusão das metas cujo período ainda não terminou. */
async function syncGoals(tx, userId, backfill, today) {
  const goals = await tx.playerGoal.findMany({ where: { userId } });
  for (const goal of goals) {
    const closed = goal.endsOn.toISOString().slice(0, 10) < today;
    if (closed) continue; // período encerrado: o resultado fica congelado
    const { value } = await goalProgressValue(tx, userId, goal);
    const reached = value >= goal.targetValue;
    if (reached && !goal.completedAt) {
      await tx.playerGoal.update({ where: { id: goal.id }, data: { completedAt: new Date() } });
      await recordActivity(tx, userId, {
        type: 'GOAL_COMPLETED',
        dedupeKey: `goal:${goal.id}`,
        entityId: goal.id,
        data: { name: goal.name },
        retroactive: backfill,
      });
      if ((await remainingCap(tx, userId, 'GOAL_COMPLETED')) > 0) {
        await grantXp(tx, userId, {
          eventKey: `goal:${goal.id}`,
          source: 'GOAL_COMPLETED',
          amount: XP_RULES.GOAL_COMPLETED.amount,
          description: `Meta concluída: ${goal.name}`,
          retroactive: backfill,
        });
      }
    } else if (!reached && goal.completedAt) {
      // ex.: o jogo deixou de estar zerado ou o objetivo foi aumentado. O XP já pago fica.
      await tx.playerGoal.update({ where: { id: goal.id }, data: { completedAt: null } });
    }
  }
}

// Lock por usuário até o fim da transação (reentrante na mesma conexão).
const lockUser = (tx, userId) => tx.$queryRaw`SELECT 1 AS ok FROM pg_advisory_xact_lock(hashtext(${userId}))`;

/**
 * Chamado no INÍCIO de toda operação que altera a biblioteca: se a biblioteca ainda
 * não foi processada, processa o estado anterior como retroativo. Assim o que a
 * operação atual produzir conta como evento real, com data de hoje.
 */
export async function beginProgress(tx, userId) {
  await lockUser(tx, userId);
  const profile = await tx.playerProfile.findUnique({ where: { userId }, select: { backfilledAt: true } });
  if (!profile?.backfilledAt) await syncProgress(tx, userId);
}

/**
 * Reavalia toda a progressão do usuário. Seguro para chamar várias vezes:
 * nada é concedido duas vezes. `retroactive` marca o que for concedido agora como
 * vindo de dados antigos (importação legada), sem limite diário e sem aviso na tela.
 */
export async function syncProgress(tx, userId, { retroactive = false } = {}) {
  await lockUser(tx, userId);
  const profile = await ensureProfile(tx, userId);
  const backfill = retroactive || !profile.backfilledAt;
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: config.APP_TIMEZONE }).format(new Date());

  await syncGoals(tx, userId, backfill, today);
  await grantStateXp(tx, userId, backfill);

  const metrics = await computeMetrics(tx, userId);
  const unlocked = new Set(
    (await tx.userAchievement.findMany({ where: { userId }, select: { code: true } })).map((a) => a.code),
  );
  for (const def of ACHIEVEMENTS) {
    if (unlocked.has(def.code) || metrics[def.metric] < def.target) continue;
    const created = await tx.userAchievement.createMany({
      data: [{ userId, code: def.code, retroactive: backfill }],
      skipDuplicates: true,
    });
    if (created.count === 0) continue;
    await recordActivity(tx, userId, {
      type: 'ACHIEVEMENT_UNLOCKED',
      dedupeKey: `achievement:${def.code}`,
      data: { code: def.code, name: def.name, xp: def.xp, rarity: def.rarity },
      retroactive: backfill,
    });
    await grantXp(tx, userId, {
      eventKey: `achievement:${def.code}`,
      source: 'ACHIEVEMENT',
      amount: def.xp,
      description: `Conquista: ${def.name}`,
      retroactive: backfill,
    });
  }

  const totalXp = int((await tx.xpTransaction.aggregate({ where: { userId }, _sum: { amount: true } }))._sum.amount);
  const level = levelForXp(totalXp);
  for (let reached = profile.level + 1; reached <= level; reached += 1) {
    await recordActivity(tx, userId, {
      type: 'LEVEL_UP',
      dedupeKey: `level:${reached}`,
      data: { level: reached },
      retroactive: backfill,
    });
  }
  await tx.playerProfile.update({
    where: { userId },
    data: { totalXp, level, ...(backfill ? { backfilledAt: new Date() } : {}) },
  });
  return { totalXp, level, metrics };
}

/** Executa syncProgress numa transação própria (leituras que precisam do perfil em dia). */
export function syncNow(userId, options) {
  return prisma.$transaction((tx) => syncProgress(tx, userId, options), { timeout: 30_000 });
}

/** Recalcula nível e XP a partir do livro-razão (não apaga nem duplica nada). */
export async function rebuild(userId) {
  return prisma.$transaction(
    async (tx) => {
      await ensureProfile(tx, userId);
      const sum = int((await tx.xpTransaction.aggregate({ where: { userId }, _sum: { amount: true } }))._sum.amount);
      await tx.playerProfile.update({ where: { userId }, data: { totalXp: sum, level: levelForXp(sum) } });
      const result = await syncProgress(tx, userId);
      return { ...levelProgress(result.totalXp), metrics: result.metrics };
    },
    { timeout: 30_000 },
  );
}

/** Conquistas com progresso atual (desbloqueadas e bloqueadas). */
export async function listAchievements(userId) {
  await syncNow(userId);
  const [metrics, unlocked] = await Promise.all([
    computeMetrics(prisma, userId),
    prisma.userAchievement.findMany({ where: { userId } }),
  ]);
  const byCode = new Map(unlocked.map((u) => [u.code, u]));
  const items = ACHIEVEMENTS.map((def) => {
    const u = byCode.get(def.code);
    const current = Math.min(metrics[def.metric], def.target);
    return {
      code: def.code,
      name: def.name,
      description: def.description,
      icon: def.icon,
      category: def.category,
      rarity: def.rarity,
      xp: def.xp,
      target: def.target,
      current: u ? def.target : current,
      progressValue: metrics[def.metric],
      percent: u ? 100 : Math.floor((current / def.target) * 100),
      unlocked: Boolean(u),
      unlockedAt: u?.unlockedAt ?? null,
      retroactive: u?.retroactive ?? false,
    };
  });
  return { items, unlockedCount: unlocked.length, total: ACHIEVEMENTS.length };
}

export async function xpHistory(userId, { take = 50 } = {}) {
  const rows = await prisma.xpTransaction.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: Math.min(Math.max(1, Number(take) || 50), 200),
    select: { id: true, source: true, amount: true, description: true, retroactive: true, createdAt: true },
  });
  return { items: rows };
}

/** Avisos ainda não vistos (conquista, nível, meta). Retroativos nunca viram aviso. */
export async function pendingNotifications(userId) {
  const profile = await prisma.playerProfile.findUnique({ where: { userId }, select: { notificationsSeenAt: true } });
  if (!profile) return { items: [] };
  const rows = await prisma.playerActivity.findMany({
    where: {
      userId,
      retroactive: false,
      type: { in: [...CELEBRATION_TYPES] },
      occurredAt: { gte: profile.notificationsSeenAt },
    },
    orderBy: { occurredAt: 'asc' },
    take: 10,
    select: activitySelect,
  });
  return { items: rows.map(activityToDto) };
}

/** Marca os avisos como vistos até o instante informado (o aviso não reaparece ao recarregar). */
export async function acknowledgeNotifications(userId, upTo) {
  const at = upTo ? new Date(upTo) : new Date();
  if (Number.isNaN(at.getTime())) return;
  await prisma.playerProfile.updateMany({
    where: { userId, notificationsSeenAt: { lte: at } },
    data: { notificationsSeenAt: new Date(at.getTime() + 1) },
  });
}
