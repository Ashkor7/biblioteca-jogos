import { useEffect, useRef } from 'react';

/** Diálogo modal nativo (foco preso, Esc fecha, leitor de tela anuncia). */
export default function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel = 'Confirmar',
  tone = 'danger',
  busy = false,
  onConfirm,
  onCancel,
}) {
  const ref = useRef(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className="modal"
      aria-labelledby="confirm-title"
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onCancel();
      }}
    >
      <div className="p-5 sm:p-6">
        <h2 id="confirm-title" className="text-xl">
          {title}
        </h2>
        <div className="mt-2 text-sm text-muted">{children}</div>
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" className="btn btn-ghost" onClick={onCancel} disabled={busy} autoFocus>
            Cancelar
          </button>
          <button
            type="button"
            className={`btn ${tone === 'danger' ? 'btn-danger' : 'btn-primary'}`}
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? 'Aguarde…' : confirmLabel}
          </button>
        </div>
      </div>
    </dialog>
  );
}
