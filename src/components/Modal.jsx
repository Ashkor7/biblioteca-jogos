import { useEffect, useId, useRef } from 'react';
import { FiX } from 'react-icons/fi';

/**
 * Diálogo modal nativo (<dialog>): foco preso, Esc fecha, leitor de tela anuncia.
 * Montado só quando aberto; `onClose` é chamado ao fechar por qualquer meio.
 */
export default function Modal({ title, icon: Icon, children, onClose, busy = false, wide = false, description }) {
  const ref = useRef(null);
  const titleId = useId();
  const descId = useId();
  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);
  return (
    <dialog
      ref={ref}
      className={`modal ${wide ? 'modal-wide' : ''}`}
      aria-labelledby={titleId}
      aria-describedby={description ? descId : undefined}
      onCancel={(event) => {
        if (busy) event.preventDefault();
      }}
      onClose={onClose}
    >
      <div className="p-5 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <h2 id={titleId} className="flex items-center gap-2 text-xl">
            {Icon && <Icon className="text-cyan" aria-hidden="true" />} {title}
          </h2>
          <button
            type="button"
            className="btn btn-ghost btn-sm btn-icon -mr-2 -mt-1"
            onClick={() => ref.current?.close()}
            disabled={busy}
            aria-label="Fechar"
          >
            <FiX aria-hidden="true" />
          </button>
        </div>
        {description && (
          <p id={descId} className="mt-1 text-sm text-muted">
            {description}
          </p>
        )}
        <div className="mt-4">{children}</div>
      </div>
    </dialog>
  );
}

/** Rodapé padrão de formulários em diálogo. */
export function ModalActions({ onCancel, busy, submitLabel = 'Salvar', busyLabel = 'Salvando…', tone = 'primary' }) {
  return (
    <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
      <button type="button" className="btn btn-ghost" onClick={onCancel} disabled={busy}>
        Cancelar
      </button>
      <button type="submit" className={`btn ${tone === 'danger' ? 'btn-danger' : 'btn-primary'}`} disabled={busy}>
        {busy ? busyLabel : submitLabel}
      </button>
    </div>
  );
}
