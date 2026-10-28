import { FiAlertTriangle, FiRefreshCw } from 'react-icons/fi';

export function LoadingState({ label = 'Carregando…' }) {
  return (
    <div role="status" className="py-10">
      <div className="loading-bar mx-auto max-w-xs" aria-hidden="true" />
      <p className="mt-3 text-center text-sm text-muted">{label}</p>
    </div>
  );
}

export function ErrorState({ error, onRetry, title = 'Não foi possível carregar' }) {
  return (
    <div role="alert" className="border border-danger/40 bg-danger-soft px-5 py-6">
      <div className="flex items-start gap-3">
        <FiAlertTriangle className="mt-1 shrink-0 text-danger" aria-hidden="true" />
        <div className="min-w-0">
          <h2 className="text-lg text-danger">{title}</h2>
          <p className="mt-1 text-sm text-ink">{error?.message ?? 'Erro desconhecido.'}</p>
          {onRetry && (
            <button type="button" className="btn btn-ghost btn-sm mt-4" onClick={() => onRetry()}>
              <FiRefreshCw aria-hidden="true" /> Tentar de novo
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export function EmptyState({ title, children, action }) {
  return (
    <div className="border border-dashed border-line-strong px-5 py-10 text-center">
      <h2 className="text-xl">{title}</h2>
      {children && <div className="mx-auto mt-2 max-w-md text-sm text-muted">{children}</div>}
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </div>
  );
}
