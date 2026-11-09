import { formatDuration } from '../../shared/domain.js';

const quote = (text) => `“${text}”`;

/** Frase em PT-BR para uma atividade da linha do tempo. */
export function describeActivity(activity) {
  const d = activity.data ?? {};
  const title = d.title ?? 'um jogo removido';
  switch (activity.type) {
    case 'GAME_ADDED':
      return `Adicionou ${title} à biblioteca`;
    case 'WISHLIST_ADDED':
      return `Colocou ${title} na lista de desejos`;
    case 'GAME_STARTED':
      return `Começou a jogar ${title}`;
    case 'GAME_COMPLETED':
      return `Zerou ${title}`;
    case 'SESSION_LOGGED':
      return d.minutes ? `Jogou ${title} por ${formatDuration(d.minutes)}` : `Registrou uma sessão de ${title}`;
    case 'GAME_RATED':
      return d.stars ? `Deu ${d.stars} ${d.stars === 1 ? 'estrela' : 'estrelas'} a ${title}` : `Avaliou ${title}`;
    case 'ACHIEVEMENT_UNLOCKED':
      return `Desbloqueou a conquista ${quote(d.name ?? d.code)}`;
    case 'LEVEL_UP':
      return `Alcançou o nível ${d.level}`;
    case 'COLLECTION_CREATED':
      return `Criou a coleção ${quote(d.name)}`;
    case 'WISHLIST_PURCHASED':
      return `Comprou ${title}, que estava na lista de desejos`;
    case 'GOAL_COMPLETED':
      return `Concluiu a meta ${quote(d.name)}`;
    default:
      return activity.label ?? activity.type;
  }
}

const relative = new Intl.RelativeTimeFormat('pt-BR', { numeric: 'auto' });

/** "há 5 minutos", "ontem", "há 3 dias"... (até 30 dias; depois a data). */
export function timeAgo(value, now = Date.now()) {
  const diff = (new Date(value).getTime() - now) / 1000;
  const abs = Math.abs(diff);
  if (abs < 60) return 'agora mesmo';
  if (abs < 3600) return relative.format(Math.round(diff / 60), 'minute');
  if (abs < 86_400) return relative.format(Math.round(diff / 3600), 'hour');
  if (abs < 30 * 86_400) return relative.format(Math.round(diff / 86_400), 'day');
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value));
}
