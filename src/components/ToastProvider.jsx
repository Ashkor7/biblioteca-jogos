import { useCallback, useMemo, useRef, useState } from 'react';
import { ToastContext } from '../hooks/contexts.js';

let nextId = 1;

export default function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timers = useRef(new Map());

  const dismiss = useCallback((id) => {
    setToasts((list) => list.filter((t) => t.id !== id));
    clearTimeout(timers.current.get(id));
    timers.current.delete(id);
  }, []);

  const push = useCallback(
    (message, tone = 'ok') => {
      const id = nextId++;
      setToasts((list) => [...list.slice(-2), { id, message, tone }]);
      timers.current.set(id, setTimeout(() => dismiss(id), tone === 'error' ? 7000 : 4000));
    },
    [dismiss],
  );

  const value = useMemo(
    () => ({ success: (m) => push(m, 'ok'), error: (m) => push(m, 'error'), info: (m) => push(m, 'info') }),
    [push],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="false"
        className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex flex-col items-center gap-2 p-4 sm:items-end"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            role={t.tone === 'error' ? 'alert' : 'status'}
            className={`pointer-events-auto flex w-full max-w-sm items-start gap-3 border bg-panel-2 px-4 py-3 text-sm shadow-lg shadow-black/40 ${
              t.tone === 'error' ? 'border-danger/60' : 'border-cyan/50'
            }`}
          >
            <span className={`led mt-1.5 ${t.tone === 'error' ? 'text-danger' : 'text-cyan'}`} aria-hidden="true" />
            <p className="flex-1">{t.message}</p>
            <button
              type="button"
              onClick={() => dismiss(t.id)}
              className="-m-1 p-1 text-muted hover:text-ink"
              aria-label="Fechar aviso"
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
