import { useId } from 'react';

/** Rótulo + controle + dica + erro, com ids ligados para leitores de tela. */
export function Field({ label, error, hint, children, className = '' }) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;
  return (
    <div className={className}>
      <label htmlFor={id} className="field-label">
        {label}
      </label>
      {children({ id, 'aria-describedby': describedBy, 'aria-invalid': error ? 'true' : undefined })}
      {hint && (
        <p id={hintId} className="field-hint">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="field-error">
          {error}
        </p>
      )}
    </div>
  );
}

export function MoneyInput(props) {
  return (
    <div className="relative">
      <span className="num pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-faint">R$</span>
      <input inputMode="decimal" autoComplete="off" placeholder="0,00" {...props} className="input num pl-10" />
    </div>
  );
}
