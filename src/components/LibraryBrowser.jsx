import { useDeferredValue, useId, useMemo, useState } from 'react';
import { FiGrid, FiList, FiSearch, FiSliders, FiX } from 'react-icons/fi';
import { useGames, useCategories, usePlatforms, useStores, useCollections, useOverview } from '../hooks/queries.js';
import { useUrlFilters } from '../hooks/useUrlFilters.js';
import FilterBar from './FilterBar.jsx';
import { GameGrid, GameList } from './GameCard.jsx';
import Pagination from './Pagination.jsx';
import { ErrorState, EmptyState } from './States.jsx';
import { moneyToCents } from '../../shared/domain.js';

const DEFAULTS = { sort: 'featured', page: '1' };
const ADVANCED = ['platform', 'store', 'media', 'category', 'collection', 'rating', 'source', 'review', 'price'];
const ADVANCED_KEYS = ['platform', 'storeId', 'media', 'categoryId', 'collectionId', 'minRating', 'source', 'needsReview', 'minPrice', 'maxPrice'];
const COMPACT = ['platform', 'category'];

const SORT_LABELS = {
  featured: 'Destaque primeiro',
  recent: 'Adicionados recentemente',
  title: 'Nome (A–Z)',
  rating: 'Melhor nota',
  hours: 'Mais horas',
  paid: 'Maior valor pago',
};

// Abas = estados reais do enum PlayStatus + favoritos (FavoriteGame). Contagens vêm de /statistics/overview.
const TABS = [
  { key: 'all', label: 'Todos', patch: { status: '', favorite: '' }, count: (lib) => lib.owned },
  { key: 'PLAYING', label: 'Jogando', patch: { status: 'PLAYING', favorite: '' }, count: (lib) => lib.playing },
  { key: 'COMPLETED', label: 'Zerados', patch: { status: 'COMPLETED', favorite: '' }, count: (lib) => lib.completed },
  { key: 'NOT_STARTED', label: 'Não iniciados', patch: { status: 'NOT_STARTED', favorite: '' }, count: (lib) => lib.notStarted },
  { key: 'ABANDONED', label: 'Abandonados', patch: { status: 'ABANDONED', favorite: '' }, count: (lib) => lib.abandoned },
  { key: 'fav', label: 'Favoritos', patch: { favorite: 'true', status: '' }, count: (_lib, fav) => fav },
];

function activeTab(filters) {
  if (filters.favorite === 'true' && !filters.status) return 'fav';
  if (filters.status && !filters.favorite) return filters.status;
  if (!filters.status && !filters.favorite) return 'all';
  return null;
}

// Faixa de preço digitada só vai à API quando é um valor válido ("199,90").
const validPrice = (v) => (v && Number.isInteger(moneyToCents(v)) ? v : undefined);

function SkeletonGrid({ count = 10 }) {
  return (
    <ul aria-hidden="true" className="grid list-none grid-cols-2 gap-3 p-0 sm:gap-4 @lg:grid-cols-3 @2xl:grid-cols-4 @4xl:grid-cols-5 @7xl:grid-cols-6">
      {Array.from({ length: count }, (_, i) => (
        <li key={i} className="panel">
          <div className="panel-body">
            <div className="aspect-[11/10] animate-pulse bg-panel-3" />
            <div className="space-y-2 p-3">
              <div className="h-3 w-3/4 animate-pulse bg-panel-3" />
              <div className="h-2.5 w-1/2 animate-pulse bg-panel-3" />
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Coleção adquirida com abas, busca e filtros combinados, paginada no servidor. */
export default function LibraryBrowser({ compact = false, pageSize = 40, title = null, actions = null }) {
  const { filters, queryFilters, update } = useUrlFilters(DEFAULTS);
  const advancedCount = ADVANCED_KEYS.filter((k) => filters[k]).length;
  const [showFilters, setShowFilters] = useState(advancedCount > 0);
  const filtersId = useId();
  const categories = useCategories();
  const platforms = usePlatforms();
  const stores = useStores({ enabled: !compact });
  const collections = useCollections({ enabled: !compact });
  const overview = useOverview();
  const favorites = useGames({ ownership: 'OWNED', favorite: 'true', pageSize: 1 });
  const minPrice = useDeferredValue(validPrice(filters.minPrice));
  const maxPrice = useDeferredValue(validPrice(filters.maxPrice));
  const listView = filters.view === 'lista';
  const params = useMemo(() => {
    const { view: _view, ...api } = queryFilters;
    return { ...api, minPrice, maxPrice, ownership: 'OWNED', pageSize };
  }, [queryFilters, minPrice, maxPrice, pageSize]);
  const library = useGames(params);
  const current = activeTab(filters);
  // Contagens por aba são do total adquirido; com busca/filtros extras elas enganariam, então somem.
  const showCounts = overview.data && !filters.search && advancedCount === 0;
  const change = (patch) => update({ ...patch, page: '1' });
  const clearAll = () =>
    update({ ...Object.fromEntries(ADVANCED_KEYS.map((k) => [k, ''])), search: '', status: '', favorite: '', page: '1' });

  return (
    <div className="frame p-3 sm:p-5 lg:p-6">
      <div>
        {/* Título + ordenação/visualização/filtros na mesma linha */}
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          {title}
          <div className="flex w-full items-center gap-2 sm:w-auto">
            <label className="flex min-w-0 flex-1 items-center rounded-lg border border-line-strong bg-panel-2 pl-3 text-xs text-muted sm:flex-none">
              <span className="shrink-0">Ordenar:</span>
              <select
                className="input min-h-9 w-full border-0 bg-transparent py-1 pl-1.5 text-xs text-cyan focus:shadow-none sm:w-auto"
                value={filters.sort}
                onChange={(e) => change({ sort: e.target.value })}
              >
                {Object.entries(SORT_LABELS).map(([value, text]) => (
                  <option key={value} value={value}>
                    {text}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              className={`card-icon-btn h-9 w-9 ${!listView ? 'border-cyan text-cyan shadow-[0_0_10px_#39e1ea40]' : 'bg-transparent'}`}
              aria-pressed={!listView}
              aria-label="Exibir em grade"
              title="Grade"
              onClick={() => update({ view: '' })}
            >
              <FiGrid aria-hidden="true" />
            </button>
            <button
              type="button"
              className={`card-icon-btn h-9 w-9 ${listView ? 'border-cyan text-cyan shadow-[0_0_10px_#39e1ea40]' : 'bg-transparent'}`}
              aria-pressed={listView}
              aria-label="Exibir em lista"
              title="Lista"
              onClick={() => update({ view: 'lista' })}
            >
              <FiList aria-hidden="true" />
            </button>
            <button
              type="button"
              className={`card-icon-btn relative h-9 w-9 ${showFilters || advancedCount ? 'border-cyan text-cyan' : 'bg-transparent'}`}
              aria-expanded={showFilters}
              aria-controls={filtersId}
              aria-label={`Filtros avançados${advancedCount ? `: ${advancedCount} ativo${advancedCount > 1 ? 's' : ''}` : ''}`}
              title="Filtros avançados"
              onClick={() => setShowFilters((v) => !v)}
            >
              <FiSliders aria-hidden="true" />
              {advancedCount > 0 && (
                <span aria-hidden="true" className="num absolute -right-1.5 -top-1.5 rounded-full bg-cyan px-1.5 text-[0.65rem] leading-4 text-cyan-ink">
                  {advancedCount}
                </span>
              )}
            </button>
            {actions}
          </div>
        </div>
        {/* Abas por estado em linha sublinhada, como na referência */}
        <div className="border-b border-line pb-3">
          <div role="group" aria-label="Filtro rápido por estado" className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-0.5">
            {TABS.map((tab) => {
              const count = showCounts ? tab.count(overview.data.library, favorites.data?.total) : undefined;
              return (
                <button key={tab.key} type="button" className="chip-tab" aria-pressed={current === tab.key} onClick={() => change(tab.patch)}>
                  {tab.label}
                  {count !== undefined && <span className="chip-count">({count})</span>}
                </button>
              );
            })}
          </div>
        </div>

        {/* Busca no celular (no desktop a busca do topo edita o mesmo filtro), limpar e total */}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {!compact && (
            <div className="relative min-w-0 flex-[1_1_16rem] md:hidden">
              <label htmlFor="busca-biblioteca" className="sr-only">
                Buscar na biblioteca
              </label>
              <FiSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint" aria-hidden="true" />
              <input
                id="busca-biblioteca"
                type="search"
                className="input pl-9"
                placeholder="Buscar por nome, plataforma, loja…"
                value={filters.search ?? ''}
                onChange={(e) => change({ search: e.target.value })}
              />
            </div>
          )}
          {(advancedCount > 0 || filters.search || filters.status || filters.favorite) && (
            <button type="button" className="btn btn-ghost btn-sm" onClick={clearAll}>
              <FiX aria-hidden="true" /> Limpar filtros
            </button>
          )}
          {library.data && (
            <p className="ml-auto text-xs text-muted" aria-live="polite">
              <span className="num text-ink">{library.data.total}</span> {library.data.total === 1 ? 'jogo' : 'jogos'}
              {filters.search && (
                <>
                  {' '}
                  para “<span className="text-ink">{filters.search}</span>”
                </>
              )}
            </p>
          )}
        </div>
        <div id={filtersId} hidden={!showFilters} className="mt-3">
          <FilterBar
            filters={filters}
            onChange={change}
            categories={categories.data?.items}
            platforms={platforms.data?.items.filter((p) => p.ownedCount > 0)}
            stores={stores.data?.items}
            collections={collections.data?.items}
            show={compact ? COMPACT : ADVANCED}
            showSearch={false}
            className=""
            label="Filtros avançados da biblioteca"
          />
        </div>

        <div className="mt-3">
          {library.isPending ? (
            <>
              <p role="status" className="sr-only">
                Carregando jogos…
              </p>
              <SkeletonGrid count={compact ? 5 : 10} />
            </>
          ) : library.isError ? (
            <ErrorState error={library.error} onRetry={library.refetch} />
          ) : library.data.items.length === 0 ? (
            <EmptyState
              title={current === 'fav' ? 'Nenhum favorito' : 'Nada encontrado'}
              action={
                <button type="button" className="btn btn-ghost btn-sm" onClick={clearAll}>
                  Ver todos os jogos
                </button>
              }
            >
              {current === 'fav'
                ? 'Use o coração nos cartões ou na página do jogo para marcar favoritos.'
                : 'Nenhum jogo combina com a busca e os filtros atuais.'}
            </EmptyState>
          ) : (
            <>
              {listView ? <GameList games={library.data.items} /> : <GameGrid games={library.data.items} />}
              <Pagination
                page={library.data.page}
                totalPages={library.data.totalPages}
                total={library.data.total}
                onPage={(page) => update({ page: String(page) })}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
