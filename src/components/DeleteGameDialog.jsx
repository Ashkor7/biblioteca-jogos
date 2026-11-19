import { useId, useState } from 'react';
import ConfirmDialog from './ConfirmDialog.jsx';

/**
 * Confirmação de exclusão. Para jogos ligados à Steam, oferece "Não importar de novo"
 * (marcado por padrão): o app vai para a lista de ignorados, que pode ser desfeita.
 */
export default function DeleteGameDialog({ game, open, busy, onConfirm, onCancel, children }) {
  const id = useId();
  const [ignoreSteam, setIgnoreSteam] = useState(true);
  const linked = Boolean(game.steam);
  return (
    <ConfirmDialog
      open={open}
      title={`Excluir ${game.title}?`}
      confirmLabel="Excluir jogo"
      busy={busy}
      onCancel={onCancel}
      onConfirm={() => onConfirm(linked ? { ignoreSteam } : {})}
    >
      {children}
      {linked && (
        <div className="mt-4 flex items-start gap-2 text-ink">
          <input
            id={id}
            type="checkbox"
            className="mt-1 h-4 w-4 accent-[var(--color-cyan)]"
            checked={ignoreSteam}
            onChange={(e) => setIgnoreSteam(e.target.checked)}
            aria-describedby={`${id}-hint`}
          />
          <div>
            <label htmlFor={id} className="font-semibold">
              Não importar de novo da Steam
            </label>
            <p id={`${id}-hint`} className="text-muted">
              O jogo entra na lista de ignorados da importação. Dá para desfazer em Importar → Steam.
            </p>
          </div>
        </div>
      )}
    </ConfirmDialog>
  );
}
