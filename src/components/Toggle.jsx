import { useId } from 'react';

/** Interruptor liga/desliga com rótulo e descrição (checkbox nativo por baixo). */
export default function Toggle({ label, description, checked, onChange, disabled = false }) {
  const id = useId();
  const descId = useId();
  return (
    <div className="flex items-start justify-between gap-4 py-3">
      <div className="min-w-0">
        <label htmlFor={id} className="font-display font-semibold">
          {label}
        </label>
        {description && (
          <p id={descId} className="text-sm text-muted">
            {description}
          </p>
        )}
      </div>
      <span className="switch mt-0.5">
        <input
          id={id}
          type="checkbox"
          role="switch"
          checked={checked}
          disabled={disabled}
          aria-describedby={description ? descId : undefined}
          onChange={(e) => onChange(e.target.checked)}
        />
        <span aria-hidden="true" />
      </span>
    </div>
  );
}
