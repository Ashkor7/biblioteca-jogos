export default function Pagination({ page, totalPages, total, onPage }) {
  if (totalPages <= 1) return null;
  return (
    <nav aria-label="Paginação" className="mt-6 flex items-center justify-between gap-3 border-t border-line pt-4 text-sm">
      <button type="button" className="btn btn-ghost btn-sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>
        Anterior
      </button>
      <span className="text-muted">
        Página <span className="num text-ink">{page}</span> de <span className="num text-ink">{totalPages}</span>
        <span className="hidden sm:inline"> ({total} jogos)</span>
      </span>
      <button type="button" className="btn btn-ghost btn-sm" disabled={page >= totalPages} onClick={() => onPage(page + 1)}>
        Próxima
      </button>
    </nav>
  );
}
