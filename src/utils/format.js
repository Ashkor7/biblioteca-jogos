import { minutesToHours, moneyToCents, PLAY_STATUS_LABELS, MEDIA_LABELS, WISH_PRIORITY_LABELS } from '../../shared/domain.js';

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const decimal = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 });
const percent = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1, minimumFractionDigits: 0 });
const date = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });

/** Valores chegam da API como string decimal ("199.90"): Number só para exibir. */
export function formatMoney(value) {
  if (value === null || value === undefined || value === '') return '—';
  return brl.format(Number(value));
}

export function formatHours(minutes) {
  const hours = minutesToHours(minutes);
  return `${decimal.format(hours)} h`;
}

export function formatPercent(value) {
  if (value === null || value === undefined) return '—';
  return `${percent.format(value)}%`;
}

export function formatDate(value) {
  if (!value) return '—';
  return date.format(new Date(value));
}

/** "199.90" → "199,90" para preencher inputs. */
export function moneyToInput(value) {
  if (value === null || value === undefined) return '';
  return String(value).replace('.', ',');
}

export function minutesToInput(minutes) {
  if (!minutes) return '';
  return String(minutesToHours(minutes)).replace('.', ',');
}

export const statusLabel = (status) => PLAY_STATUS_LABELS[status] ?? status;
export const mediaLabel = (media) => MEDIA_LABELS[media] ?? '—';

export const STATUS_TONE = {
  NOT_STARTED: 'text-muted',
  PLAYING: 'text-blue',
  COMPLETED: 'text-ok',
  ABANDONED: 'text-danger',
};

export function conditionLabel(game) {
  if (game.ownershipStatus === 'WISHLIST') return 'Lista de desejos';
  return game.mediaType ? MEDIA_LABELS[game.mediaType] : 'Mídia não informada';
}

/** Diferença entre referência e pago: economia (positivo) ou gasto acima (negativo). */
export function describeDifference(diff) {
  if (diff === null || diff === undefined) return null;
  const value = Number(diff);
  if (value > 0) return { tone: 'text-ok', label: `Economia de ${formatMoney(value)}` };
  if (value < 0) return { tone: 'text-amber', label: `${formatMoney(Math.abs(value))} acima da referência` };
  return { tone: 'text-muted', label: 'Pago o preço cheio' };
}

export const priorityLabel = (p) => WISH_PRIORITY_LABELS[p] ?? 'Sem prioridade';
export const PRIORITY_TONE = { HIGH: 'text-magenta', MEDIUM: 'text-amber', LOW: 'text-muted' };

const monthFmt = new Intl.DateTimeFormat('pt-BR', { month: 'short', year: '2-digit', timeZone: 'UTC' });
/** '2026-03' → 'mar. de 26' */
export function formatMonth(period) {
  return monthFmt.format(new Date(`${period}-01T00:00:00Z`));
}

const dayFmt = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' });
/** '2026-11-09' (data sem horário) → '09 de nov. de 2026', sem deslocar pelo fuso. */
export function formatDay(iso) {
  if (!iso) return '—';
  return dayFmt.format(new Date(`${iso.slice(0, 10)}T00:00:00Z`));
}

/** Estado do último preço em relação ao preço-alvo (centavos inteiros, sem float). */
export function targetStatus(latest, target) {
  if (latest === null || latest === undefined || target === null || target === undefined) return null;
  const diff = moneyToCents(latest) - moneyToCents(target);
  if (diff < 0) return { state: 'BELOW', tone: 'text-ok', label: `${formatMoney(Math.abs(diff) / 100)} abaixo do alvo` };
  if (diff === 0) return { state: 'AT', tone: 'text-ok', label: 'No preço-alvo' };
  return { state: 'ABOVE', tone: 'text-amber', label: `${formatMoney(diff / 100)} acima do alvo` };
}
