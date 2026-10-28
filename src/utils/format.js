import { minutesToHours, PLAY_STATUS_LABELS, MEDIA_LABELS } from '../../shared/domain.js';

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
