import { FiEdit2, FiTrash2, FiCheckCircle } from 'react-icons/fi';
import { GOAL_TYPE_LABELS } from '../../shared/domain.js';
import { formatDay, formatDate } from '../utils/format.js';

const STATUS = {
  ACTIVE: { label: 'Em andamento', tone: 'text-cyan' },
  UPCOMING: { label: 'Ainda não começou', tone: 'text-muted' },
  COMPLETED: { label: 'Concluída', tone: 'text-ok' },
  CLOSED: { label: 'Encerrada', tone: 'text-faint' },
};

/** Meta com barra de progresso real; ações opcionais (editar/excluir). */
export default function GoalCard({ goal: g, onEdit, onDelete }) {
  const status = STATUS[g.status];
  const unit = g.type === 'PLAY_HOURS' ? 'h' : g.targetValue === 1 ? 'jogo' : 'jogos';
  return (
    <article className={`panel h-full ${g.status === 'COMPLETED' ? 'panel-accent' : ''}`}>
      <div className="panel-body flex h-full flex-col gap-2 p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="text-base font-semibold">{g.name}</h3>
            <p className="text-xs text-muted">
              {GOAL_TYPE_LABELS[g.type]}
              {g.categoryName && ` · ${g.categoryName}`}
            </p>
          </div>
          <span className={`inline-flex shrink-0 items-center gap-1 text-xs ${status.tone}`}>
            {g.status === 'COMPLETED' && <FiCheckCircle aria-hidden="true" />} {status.label}
          </span>
        </div>
        <div>
          <div className="flex justify-between text-sm">
            <span className="num">
              {g.progress} / {g.targetValue} {unit}
            </span>
            <span className="num text-muted">{g.percent}%</span>
          </div>
          <div
            className="progress-track mt-1"
            role="progressbar"
            aria-label={`Progresso de ${g.name}`}
            aria-valuemin={0}
            aria-valuemax={g.targetValue}
            aria-valuenow={g.progress}
            style={{ '--progress-color': g.status === 'COMPLETED' ? 'var(--color-ok)' : 'var(--color-violet)' }}
          >
            <div className="progress-fill" style={{ width: `${g.percent}%` }} />
          </div>
        </div>
        <p className="mt-auto text-xs text-faint">
          {formatDay(g.startsOn)} a {formatDay(g.endsOn)}
          {g.completedAt && ` · concluída em ${formatDate(g.completedAt)}`}
        </p>
        {(onEdit || onDelete) && (
          <div className="flex gap-2 pt-1">
            {onEdit && (
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => onEdit(g)} aria-label={`Editar meta ${g.name}`}>
                <FiEdit2 aria-hidden="true" /> Editar
              </button>
            )}
            {onDelete && (
              <button type="button" className="btn btn-danger btn-sm" onClick={() => onDelete(g)} aria-label={`Excluir meta ${g.name}`}>
                <FiTrash2 aria-hidden="true" /> Excluir
              </button>
            )}
          </div>
        )}
      </div>
    </article>
  );
}
