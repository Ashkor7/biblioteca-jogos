import { useDeferredValue, useMemo } from 'react';
import { useGames, useCategories, usePlatforms, useStores, useCollections } from '../hooks/queries.js';
import { useUrlFilters } from '../hooks/useUrlFilters.js';
import FilterBar from './FilterBar.jsx';
import { GameGrid } from './GameCard.jsx';
import Pagination from './Pagination.jsx';
import { LoadingState, ErrorState, EmptyState } from './States.jsx';
import { moneyToCents } from '../../shared/domain.js';

const DEFAULTS = { sort: 'featured', page: '1' };
const FULL = ['platform', 'store', 'status', 'media', 'category', 'collection', 'rating', 'favorite', 'price', 'sort'];
const COMPACT = ['platform', 'status', 'category', 'sort'];

// Faixa de preço digitada só vai à API quando é um valor válido ("199,90").
const validPrice = (v) => (v && Number.isInteger(moneyToCents(v)) ? v : undefined);

/** Coleção adquirida com busca e filtros combinados, paginada no servidor. */
export default function LibraryBrowser({ compact = false, pageSize = 40 }) {
  const { filters, queryFilters, update } = useUrlFilters(DEFAULTS);
  const categories = useCategories();
  const platforms = usePlatforms();
  const stores = useStores({ enabled: !compact });
  const collections = useCollections({ enabled: !compact });
  const minPrice = useDeferredValue(validPrice(filters.minPrice));
  const maxPrice = useDeferredValue(validPrice(filters.maxPrice));
  const params = useMemo(
    () => ({ ...queryFilters, minPrice, maxPrice, ownership: 'OWNED', pageSize }),
    [queryFilters, minPrice, maxPrice, pageSize],
  );
  const library = useGames(params);

  return (
    <>
      <FilterBar
        filters={filters}
        onChange={(patch) => update({ ...patch, page: '1' })}
        categories={categories.data?.items}
        platforms={platforms.data?.items.filter((p) => p.ownedCount > 0)}
        stores={stores.data?.items}
        collections={collections.data?.items}
        show={compact ? COMPACT : FULL}
        label="Filtrar biblioteca"
      />
      {library.data && (
        <p className="-mt-2 mb-3 text-sm text-muted">
          <span className="num text-ink">{library.data.total}</span> {library.data.total === 1 ? 'resultado' : 'resultados'}
        </p>
      )}
      {library.isPending ? (
        <LoadingState />
      ) : library.isError ? (
        <ErrorState error={library.error} onRetry={library.refetch} />
      ) : library.data.items.length === 0 ? (
        <EmptyState title="Nada encontrado">Ajuste a busca ou os filtros.</EmptyState>
      ) : (
        <>
          <GameGrid games={library.data.items} />
          <Pagination
            page={library.data.page}
            totalPages={library.data.totalPages}
            total={library.data.total}
            onPage={(page) => update({ page: String(page) })}
          />
        </>
      )}
    </>
  );
}
