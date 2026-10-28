import { useEffect, useRef, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router';
import { FiPlus, FiEdit2 } from 'react-icons/fi';
import { api } from '../services/api.js';
import { usePlatform, useGames, useOverview, useCategories, useLibraryMutation } from '../hooks/queries.js';
import { useAuth } from '../hooks/useAuth.js';
import { useToast } from '../hooks/useToast.js';
import { useUrlFilters } from '../hooks/useUrlFilters.js';
import PageHeader from '../components/PageHeader.jsx';
import FilterBar from '../components/FilterBar.jsx';
import { GameGrid } from '../components/GameCard.jsx';
import Pagination from '../components/Pagination.jsx';
import { ReadoutStrip } from '../components/Readouts.jsx';
import { LoadingState, ErrorState, EmptyState } from '../components/States.jsx';
import { formatHours, formatMoney } from '../utils/format.js';

const DEFAULTS = { sort: 'featured', page: '1', aba: 'colecao' };

/**
 * Página ÚNICA para qualquer plataforma. O conteúdo vem de /api/platforms/:slug;
 * não existe arquivo específico por plataforma.
 */
export default function PlatformPage() {
  const { slug } = useParams();
  const platform = usePlatform(slug);

  if (platform.isPending) return <LoadingState label="Carregando plataforma…" />;
  if (platform.isError) {
    if (platform.error.status === 404) {
      return (
        <EmptyState title="Plataforma sem jogos" action={<Link to="/" className="btn btn-ghost">Ir para a visão geral</Link>}>
          Não há jogos em “{slug}”. Plataformas aparecem automaticamente quando você cadastra um jogo nelas.
        </EmptyState>
      );
    }
    return <ErrorState error={platform.error} onRetry={platform.refetch} />;
  }
  // Slug antigo de uma plataforma renomeada
  if (platform.data.redirectTo) return <Navigate to={`/plataformas/${platform.data.redirectTo}`} replace />;
  return <PlatformView key={platform.data.id} platform={platform.data} />;
}

function PlatformView({ platform }) {
  const { user } = useAuth();
  const { filters, queryFilters, update } = useUrlFilters(DEFAULTS);
  const wishlistTab = filters.aba === 'desejos';
  const categories = useCategories();
  const overview = useOverview({ platformId: platform.id });
  const { aba: _aba, ...apiFilters } = queryFilters;
  const games = useGames({
    ...apiFilters,
    platform: platform.slug,
    ownership: wishlistTab ? 'WISHLIST' : 'OWNED',
    pageSize: 40,
  });
  const [renaming, setRenaming] = useState(false);
  const stats = overview.data;

  return (
    <div className="page-enter">
      <PageHeader
        kicker="Plataforma"
        title={platform.name}
        actions={
          user && (
            <>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setRenaming(true)}>
                <FiEdit2 aria-hidden="true" /> Renomear
              </button>
              <Link
                to={`/jogos/novo?plataforma=${encodeURIComponent(platform.name)}${wishlistTab ? '&condicao=WISHLIST' : ''}`}
                className="btn btn-primary btn-sm"
              >
                <FiPlus aria-hidden="true" /> {wishlistTab ? 'Adicionar desejo' : 'Adicionar jogo'}
              </Link>
            </>
          )
        }
      />

      {stats && (
        <div className="mb-6">
          <ReadoutStrip
            label={`Resumo de ${platform.name}`}
            items={[
              { label: 'Adquiridos', value: stats.library.owned },
              { label: 'Zerados', value: stats.library.completed, tone: 'text-ok' },
              { label: 'Horas jogadas', value: formatHours(stats.playTime.totalMinutes) },
              {
                label: 'Total pago',
                value: formatMoney(stats.finance.paidTotal),
                note: Number(stats.finance.savings) > 0 ? `economia de ${formatMoney(stats.finance.savings)}` : undefined,
              },
            ]}
          />
        </div>
      )}

      <div role="tablist" aria-label="Seções da plataforma" className="mb-5 flex border-b border-line">
        {[
          ['colecao', 'Na coleção', platform.ownedCount],
          ['desejos', 'Lista de desejos', platform.wishlistCount],
        ].map(([value, label, count]) => {
          const selected = (filters.aba ?? 'colecao') === value;
          return (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => update({ aba: value, page: '1', status: '', media: '' })}
              className={`-mb-px flex min-h-11 items-center gap-2 border-b-2 px-4 font-display font-semibold ${
                selected
                  ? value === 'desejos'
                    ? 'border-magenta text-magenta'
                    : 'border-cyan text-cyan'
                  : 'border-transparent text-muted hover:text-ink'
              }`}
            >
              {label} <span className="num text-xs">{count}</span>
            </button>
          );
        })}
      </div>

      <div role="tabpanel">
        <FilterBar
          filters={filters}
          onChange={(patch) => update({ ...patch, page: '1' })}
          categories={categories.data?.items}
          show={wishlistTab ? ['category', 'sort'] : ['status', 'media', 'category', 'sort']}
          sorts={wishlistTab ? ['title', 'wishPrice', 'recent'] : undefined}
          label={`Filtrar jogos de ${platform.name}`}
        />
        {games.isPending ? (
          <LoadingState />
        ) : games.isError ? (
          <ErrorState error={games.error} onRetry={games.refetch} />
        ) : games.data.items.length === 0 ? (
          <EmptyState title={wishlistTab ? 'Nenhum desejo nesta plataforma' : 'Nenhum jogo encontrado'}>
            {wishlistTab ? 'Jogos que você quer comprar para esta plataforma aparecem aqui.' : 'Ajuste a busca ou os filtros.'}
          </EmptyState>
        ) : (
          <>
            <GameGrid games={games.data.items} showPlatform={false} />
            <Pagination
              page={games.data.page}
              totalPages={games.data.totalPages}
              total={games.data.total}
              onPage={(page) => update({ page: String(page) })}
            />
          </>
        )}
      </div>

      {renaming && <RenameDialog platform={platform} onClose={() => setRenaming(false)} />}
    </div>
  );
}

function RenameDialog({ platform, onClose }) {
  const ref = useRef(null);
  const toast = useToast();
  const navigate = useNavigate();
  const [name, setName] = useState(platform.name);
  const [error, setError] = useState(null);
  useEffect(() => {
    ref.current?.showModal();
  }, []);

  const rename = useLibraryMutation(() => api.renamePlatform(platform.id, name), {
    onSuccess: (updated) => {
      toast.success(`Plataforma renomeada para ${updated.name}.`);
      onClose();
      navigate(`/plataformas/${updated.slug}`, { replace: true });
    },
    onError: (err) => setError(err.fields?.name ?? err.message),
  });

  return (
    <dialog ref={ref} className="modal" aria-labelledby="renomear-titulo" onClose={onClose}>
      <form
        className="p-5 sm:p-6"
        onSubmit={(e) => {
          e.preventDefault();
          rename.mutate();
        }}
      >
        <h2 id="renomear-titulo" className="text-xl">
          Renomear plataforma
        </h2>
        <p className="mt-1 text-sm text-muted">Os jogos continuam associados. O endereço antigo redireciona para o novo.</p>
        <label htmlFor="novo-nome" className="field-label mt-4">
          Novo nome
        </label>
        <input
          id="novo-nome"
          className="input"
          value={name}
          maxLength={60}
          onChange={(e) => setName(e.target.value)}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={error ? 'novo-nome-erro' : undefined}
        />
        {error && (
          <p id="novo-nome-erro" className="field-error">
            {error}
          </p>
        )}
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" className="btn btn-ghost" onClick={() => ref.current?.close()}>
            Cancelar
          </button>
          <button type="submit" className="btn btn-primary" disabled={rename.isPending || !name.trim()}>
            {rename.isPending ? 'Salvando…' : 'Renomear'}
          </button>
        </div>
      </form>
    </dialog>
  );
}
