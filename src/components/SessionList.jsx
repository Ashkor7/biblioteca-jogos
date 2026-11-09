import { useState } from 'react';
import { Link } from 'react-router';
import { FiEdit2, FiTrash2 } from 'react-icons/fi';
import { api } from '../services/api.js';
import { useLibraryMutation } from '../hooks/queries.js';
import { useToast } from '../hooks/useToast.js';
import CoverImage from './CoverImage.jsx';
import ConfirmDialog from './ConfirmDialog.jsx';
import SessionDialog from './SessionDialog.jsx';
import { formatDay } from '../utils/format.js';
import { formatDuration } from '../../shared/domain.js';

const time = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' });

/** Lista de sessões com edição e exclusão (com confirmação). */
export default function SessionList({ sessions, showGame = true }) {
  const toast = useToast();
  const [editing, setEditing] = useState(null);
  const [removing, setRemoving] = useState(null);
  const remove = useLibraryMutation((s) => api.deleteSession(s.id), {
    onSuccess: () => {
      setRemoving(null);
      toast.success('Sessão excluída. As horas do jogo foram recalculadas.');
    },
    onError: (error) => {
      setRemoving(null);
      toast.error(error.message);
    },
  });

  return (
    <>
      <ol className="list-none space-y-2 p-0">
        {sessions.map((s) => (
          <li key={s.id} className="flex gap-3 border border-line bg-panel/70 p-3">
            {showGame && (
              <Link to={`/jogos/${s.game.id}`} className="w-10 shrink-0" tabIndex={-1} aria-hidden="true">
                <CoverImage src={s.game.coverUrl} title={s.game.title} />
              </Link>
            )}
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-baseline gap-x-3">
                {showGame && (
                  <Link to={`/jogos/${s.game.id}`} className="font-semibold text-ink no-underline hover:text-cyan">
                    {s.game.title}
                  </Link>
                )}
                <span className="num text-sm text-violet">{formatDuration(s.durationMinutes)}</span>
              </p>
              <p className="text-xs text-muted">
                {formatDay(s.playedOn)}
                {s.startedAt && s.endedAt && ` · ${time.format(new Date(s.startedAt))}–${time.format(new Date(s.endedAt))}`}
              </p>
              {s.notes && <p className="mt-1 whitespace-pre-line text-sm text-ink/90">{s.notes}</p>}
            </div>
            <div className="flex shrink-0 gap-1">
              <button type="button" className="btn btn-ghost btn-sm btn-icon" onClick={() => setEditing(s)} aria-label={`Editar sessão de ${formatDay(s.playedOn)}`}>
                <FiEdit2 aria-hidden="true" />
              </button>
              <button type="button" className="btn btn-danger btn-sm btn-icon" onClick={() => setRemoving(s)} aria-label={`Excluir sessão de ${formatDay(s.playedOn)}`}>
                <FiTrash2 aria-hidden="true" />
              </button>
            </div>
          </li>
        ))}
      </ol>
      {editing && <SessionDialog session={editing} onClose={() => setEditing(null)} />}
      <ConfirmDialog
        open={Boolean(removing)}
        title="Excluir sessão?"
        confirmLabel="Excluir sessão"
        busy={remove.isPending}
        onCancel={() => setRemoving(null)}
        onConfirm={() => remove.mutate(removing)}
      >
        {removing && `${formatDuration(removing.durationMinutes)} de ${removing.game.title} em ${formatDay(removing.playedOn)}. As horas do jogo serão recalculadas.`}
      </ConfirmDialog>
    </>
  );
}
