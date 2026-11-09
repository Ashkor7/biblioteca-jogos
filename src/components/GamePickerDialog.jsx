import { useDeferredValue, useId, useState } from 'react';
import { FiSearch, FiCheck } from 'react-icons/fi';
import { useGames } from '../hooks/queries.js';
import Modal, { ModalActions } from './Modal.jsx';
import CoverImage from './CoverImage.jsx';
import { LoadingState, ErrorState } from './States.jsx';

/**
 * Busca jogos da biblioteca (paginação no servidor) e devolve os escolhidos.
 * `exclude`: ids que já estão no destino (aparecem marcados e desabilitados).
 */
export default function GamePickerDialog({ title, onClose, onConfirm, busy = false, exclude = [], ownership = 'ALL', confirmLabel = 'Adicionar' }) {
  const [search, setSearch] = useState('');
  const [picked, setPicked] = useState(() => new Set());
  const deferred = useDeferredValue(search.trim());
  const searchId = useId();
  const games = useGames({ search: deferred, ownership, sort: 'title', pageSize: 30 });
  const already = new Set(exclude);

  function toggle(id) {
    setPicked((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <Modal title={title} onClose={onClose} busy={busy} wide>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (picked.size) onConfirm([...picked]);
        }}
      >
        <label htmlFor={searchId} className="sr-only">
          Buscar jogo
        </label>
        <div className="relative">
          <FiSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint" aria-hidden="true" />
          <input
            id={searchId}
            type="search"
            className="input pl-9"
            placeholder="Buscar por nome, plataforma ou categoria"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoFocus
          />
        </div>
        <div className="mt-3 max-h-[50dvh] overflow-y-auto border border-line">
          {games.isPending ? (
            <LoadingState />
          ) : games.isError ? (
            <ErrorState error={games.error} onRetry={games.refetch} />
          ) : games.data.items.length === 0 ? (
            <p className="p-4 text-sm text-faint">Nenhum jogo encontrado.</p>
          ) : (
            <ul className="list-none p-0">
              {games.data.items.map((g) => {
                const inside = already.has(g.id);
                const checked = inside || picked.has(g.id);
                return (
                  <li key={g.id} className="border-b border-line last:border-b-0">
                    <label className={`flex items-center gap-3 px-3 py-2 ${inside ? 'opacity-60' : 'cursor-pointer hover:bg-panel-2'}`}>
                      <input type="checkbox" className="sr-only" checked={checked} disabled={inside} onChange={() => toggle(g.id)} />
                      <span
                        aria-hidden="true"
                        className={`flex h-5 w-5 shrink-0 items-center justify-center border ${checked ? 'border-cyan bg-cyan text-cyan-ink' : 'border-line-strong'}`}
                      >
                        {checked && <FiCheck />}
                      </span>
                      <span className="w-9 shrink-0">
                        <CoverImage src={g.coverUrl} title={g.title} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold">{g.title}</span>
                        <span className="block truncate text-xs text-muted">
                          {g.platform.name}
                          {g.ownershipStatus === 'WISHLIST' && ' · lista de desejos'}
                          {inside && ' · já adicionado'}
                        </span>
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        {games.data?.total > games.data?.items.length && (
          <p className="mt-2 text-xs text-faint">Mostrando {games.data.items.length} de {games.data.total}. Refine a busca para achar outros.</p>
        )}
        <ModalActions
          onCancel={onClose}
          busy={busy}
          submitLabel={picked.size ? `${confirmLabel} (${picked.size})` : confirmLabel}
          busyLabel="Adicionando…"
        />
      </form>
    </Modal>
  );
}
