import { useCallback, useDeferredValue, useMemo } from 'react';
import { useSearchParams } from 'react-router';

/** Filtros guardados na URL (compartilháveis, sobrevivem ao recarregar). */
export function useUrlFilters(defaults = {}) {
  const [params, setParams] = useSearchParams();
  const filters = useMemo(() => {
    const out = { ...defaults };
    for (const [key, value] of params.entries()) out[key] = value;
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  const update = useCallback(
    (patch) => {
      setParams(
        (current) => {
          const next = new URLSearchParams(current);
          for (const [key, value] of Object.entries(patch)) {
            if (value === '' || value === undefined || value === null || value === defaults[key]) next.delete(key);
            else next.set(key, value);
          }
          return next;
        },
        { replace: true },
      );
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [setParams],
  );

  // A busca digitada não dispara uma requisição por tecla em cascata
  const deferredSearch = useDeferredValue(filters.search ?? '');
  const queryFilters = useMemo(() => ({ ...filters, search: deferredSearch.trim() }), [filters, deferredSearch]);

  return { filters, queryFilters, update };
}
