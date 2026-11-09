// Regras de progressão do Player Hub (XP, níveis, conquistas e títulos).
// O servidor é a única fonte de verdade para conceder XP e desbloquear algo;
// o frontend usa este arquivo só para exibir textos, ícones e a curva de nível.

export const MAX_LEVEL = 100;

/**
 * XP acumulado necessário para ESTAR no nível `level`.
 * Curva progressiva: cada nível pede 100 XP a mais que o anterior
 * (nível 2 = 100, 3 = 300, 4 = 600, 5 = 1.000, 10 = 4.500, 15 = 10.500).
 */
export function xpForLevel(level) {
  const l = Math.min(Math.max(1, Math.floor(level)), MAX_LEVEL);
  return 50 * (l - 1) * l;
}

export function levelForXp(totalXp) {
  let level = 1;
  while (level < MAX_LEVEL && xpForLevel(level + 1) <= totalXp) level += 1;
  return level;
}

/** Dados da barra de XP: nível, XP do nível atual e quanto falta para o próximo. */
export function levelProgress(totalXp) {
  const xp = Math.max(0, Math.floor(totalXp ?? 0));
  const level = levelForXp(xp);
  const floor = xpForLevel(level);
  const next = level >= MAX_LEVEL ? null : xpForLevel(level + 1);
  return {
    level,
    totalXp: xp,
    levelStartXp: floor,
    nextLevelXp: next,
    xpIntoLevel: xp - floor,
    xpForNext: next === null ? 0 : next - xp,
    percent: next === null ? 100 : Math.floor(((xp - floor) / (next - floor)) * 100),
  };
}

/**
 * XP por atividade. Cada evento tem chave única (não paga duas vezes) e há limites
 * em janelas móveis para que operações repetitivas não gerem XP ilimitado.
 * Criar, editar ou excluir registros não dá XP por si só.
 */
export const XP_RULES = Object.freeze({
  GAME_COMPLETED: { amount: 50, cap: 5, windowHours: 24, label: 'Jogo zerado' },
  SESSION_LOGGED: { amount: 10, cap: 3, windowHours: 24, minMinutes: 15, label: 'Sessão de jogatina' },
  GAME_RATED: { amount: 10, cap: 10, windowHours: 24, label: 'Primeira nota do jogo' },
  GOAL_COMPLETED: { amount: 75, cap: 6, windowHours: 24 * 365, label: 'Meta concluída' },
});

export const RARITY = Object.freeze({
  COMMON: { label: 'Comum', order: 1 },
  RARE: { label: 'Rara', order: 2 },
  EPIC: { label: 'Épica', order: 3 },
  LEGENDARY: { label: 'Lendária', order: 4 },
});

/**
 * Conquistas: `metric` é calculado no servidor a partir do estado ATUAL da
 * biblioteca (por isso jogos antigos contam retroativamente). Depois de
 * desbloqueada, a conquista é permanente, mesmo que o número caia.
 * Os códigos são IDs estáveis: nunca renomeie um código já publicado.
 */
export const ACHIEVEMENTS = Object.freeze([
  { code: 'first-acquisition', name: 'Primeira Aquisição', description: 'Registrar o primeiro jogo adquirido.', icon: 'package', category: 'Coleção', rarity: 'COMMON', metric: 'owned', target: 1, xp: 50 },
  { code: 'collector-10', name: 'Colecionador Iniciante', description: 'Ter 10 jogos adquiridos.', icon: 'layers', category: 'Coleção', rarity: 'RARE', metric: 'owned', target: 10, xp: 100 },
  { code: 'collector-50', name: 'Colecionador Veterano', description: 'Ter 50 jogos adquiridos.', icon: 'archive', category: 'Coleção', rarity: 'EPIC', metric: 'owned', target: 50, xp: 300 },
  { code: 'platform-explorer', name: 'Explorador de Plataformas', description: 'Ter jogos adquiridos em cinco plataformas.', icon: 'globe', category: 'Coleção', rarity: 'RARE', metric: 'platforms', target: 5, xp: 150 },
  { code: 'first-completed', name: 'Primeiro Finalizado', description: 'Zerar o primeiro jogo adquirido.', icon: 'flag', category: 'Jogatina', rarity: 'COMMON', metric: 'completed', target: 1, xp: 50 },
  { code: 'completed-10', name: 'Caçador de Créditos', description: 'Zerar 10 jogos adquiridos.', icon: 'check-circle', category: 'Jogatina', rarity: 'RARE', metric: 'completed', target: 10, xp: 150 },
  { code: 'library-master', name: 'Mestre da Biblioteca', description: 'Zerar 25 jogos adquiridos.', icon: 'award', category: 'Jogatina', rarity: 'LEGENDARY', metric: 'completed', target: 25, xp: 400 },
  { code: 'rpg-master', name: 'Mestre dos RPGs', description: 'Zerar cinco jogos adquiridos com a categoria "RPG".', icon: 'shield', category: 'Jogatina', rarity: 'EPIC', metric: 'rpgCompleted', target: 5, xp: 200 },
  { code: 'marathoner', name: 'Maratonista', description: 'Acumular 100 horas jogadas (saldo anterior + diário).', icon: 'clock', category: 'Jogatina', rarity: 'RARE', metric: 'totalHours', target: 100, xp: 150 },
  { code: 'first-session', name: 'Diário Aberto', description: 'Registrar a primeira sessão no diário de jogatina.', icon: 'book-open', category: 'Diário', rarity: 'COMMON', metric: 'sessions', target: 1, xp: 30 },
  { code: 'steady-player', name: 'Constância', description: 'Registrar sessões em 7 dias diferentes.', icon: 'calendar', category: 'Diário', rarity: 'RARE', metric: 'sessionDays', target: 7, xp: 100 },
  { code: 'deal-hunter', name: 'Caçador de Ofertas', description: 'Registrar dez compras pagas abaixo do preço original.', icon: 'tag', category: 'Finanças', rarity: 'RARE', metric: 'dealPurchases', target: 10, xp: 150 },
  { code: 'smart-buyer', name: 'Compra Planejada', description: 'Converter um item da lista de desejos em compra.', icon: 'shopping-cart', category: 'Finanças', rarity: 'COMMON', metric: 'wishlistConversions', target: 1, xp: 50 },
  { code: 'critic', name: 'Crítico Gamer', description: 'Dar nota a dez jogos diferentes.', icon: 'star', category: 'Organização', rarity: 'RARE', metric: 'ratedGames', target: 10, xp: 100 },
  { code: 'curator', name: 'Curador', description: 'Criar a primeira coleção personalizada.', icon: 'folder', category: 'Organização', rarity: 'COMMON', metric: 'collections', target: 1, xp: 30 },
  { code: 'planner', name: 'Planejador', description: 'Criar a primeira meta pessoal.', icon: 'target', category: 'Metas', rarity: 'COMMON', metric: 'goals', target: 1, xp: 30 },
  { code: 'goal-getter', name: 'Meta Batida', description: 'Concluir uma meta pessoal.', icon: 'trending-up', category: 'Metas', rarity: 'RARE', metric: 'goalsCompleted', target: 1, xp: 75 },
]);

export const ACHIEVEMENTS_BY_CODE = Object.freeze(Object.fromEntries(ACHIEVEMENTS.map((a) => [a.code, a])));

/** Títulos exibíveis no perfil. Só os desbloqueados podem ser escolhidos (validado no servidor). */
export const TITLES = Object.freeze([
  { code: 'novato-digital', name: 'Novato Digital', requirement: { kind: 'always' }, hint: 'Disponível para todo jogador.' },
  { code: 'colecionador', name: 'Colecionador', requirement: { kind: 'achievement', code: 'collector-10' }, hint: 'Conquista "Colecionador Iniciante".' },
  { code: 'colecionador-veterano', name: 'Colecionador Veterano', requirement: { kind: 'achievement', code: 'collector-50' }, hint: 'Conquista "Colecionador Veterano".' },
  { code: 'explorador-de-mundos', name: 'Explorador de Mundos', requirement: { kind: 'achievement', code: 'platform-explorer' }, hint: 'Conquista "Explorador de Plataformas".' },
  { code: 'cacador-de-ofertas', name: 'Caçador de Ofertas', requirement: { kind: 'achievement', code: 'deal-hunter' }, hint: 'Conquista "Caçador de Ofertas".' },
  { code: 'mestre-dos-rpgs', name: 'Mestre dos RPGs', requirement: { kind: 'achievement', code: 'rpg-master' }, hint: 'Conquista "Mestre dos RPGs".' },
  { code: 'maratonista', name: 'Maratonista', requirement: { kind: 'achievement', code: 'marathoner' }, hint: 'Conquista "Maratonista".' },
  { code: 'veterano', name: 'Veterano', requirement: { kind: 'level', level: 8 }, hint: 'Alcançar o nível 8.' },
  { code: 'lenda-da-biblioteca', name: 'Lenda da Biblioteca', requirement: { kind: 'level', level: 15 }, hint: 'Alcançar o nível 15.' },
]);

export const TITLES_BY_CODE = Object.freeze(Object.fromEntries(TITLES.map((t) => [t.code, t])));
export const DEFAULT_TITLE = 'novato-digital';

export function isTitleUnlocked(title, { unlockedCodes, level }) {
  const req = title.requirement;
  if (req.kind === 'always') return true;
  if (req.kind === 'achievement') return unlockedCodes.has(req.code);
  if (req.kind === 'level') return level >= req.level;
  return false;
}

/** Tipos de atividade da linha do tempo (texto em PT-BR montado pela interface). */
export const ACTIVITY_TYPES = Object.freeze({
  GAME_ADDED: 'Jogo adicionado',
  WISHLIST_ADDED: 'Desejo adicionado',
  GAME_STARTED: 'Começou a jogar',
  GAME_COMPLETED: 'Jogo zerado',
  SESSION_LOGGED: 'Sessão registrada',
  GAME_RATED: 'Nova avaliação',
  ACHIEVEMENT_UNLOCKED: 'Conquista desbloqueada',
  LEVEL_UP: 'Nível alcançado',
  COLLECTION_CREATED: 'Coleção criada',
  WISHLIST_PURCHASED: 'Desejo comprado',
  GOAL_COMPLETED: 'Meta concluída',
});

/** Tipos que viram aviso visual (uma única vez, controlado pelo servidor). */
export const CELEBRATION_TYPES = Object.freeze(['ACHIEVEMENT_UNLOCKED', 'LEVEL_UP', 'GOAL_COMPLETED']);
