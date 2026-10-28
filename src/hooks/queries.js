import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { api } from '../services/api.js';

export const keys = {
  games: (params) => ['games', params],
  game: (id) => ['game', id],
  platforms: ['platforms'],
  platform: (slug) => ['platform', slug],
  stores: ['stores'],
  categories: ['categories'],
  wishlist: (params) => ['wishlist', params],
  stats: (name, params) => ['stats', name, params],
};

export const useGames = (params, options = {}) =>
  useQuery({
    queryKey: keys.games(params),
    queryFn: ({ signal }) => api.listGames(params, signal),
    placeholderData: keepPreviousData,
    ...options,
  });

export const useGame = (id) => useQuery({ queryKey: keys.game(id), queryFn: () => api.getGame(id), enabled: Boolean(id) });
export const usePlatforms = (options = {}) =>
  useQuery({ queryKey: keys.platforms, queryFn: api.listPlatforms, ...options });
export const usePlatform = (slug) =>
  useQuery({ queryKey: keys.platform(slug), queryFn: () => api.getPlatform(slug), enabled: Boolean(slug) });
export const useStores = (options = {}) => useQuery({ queryKey: keys.stores, queryFn: api.listStores, ...options });
export const useCategories = (options = {}) =>
  useQuery({ queryKey: keys.categories, queryFn: api.listCategories, ...options });
export const useWishlist = (params) =>
  useQuery({ queryKey: keys.wishlist(params), queryFn: () => api.listWishlist(params), placeholderData: keepPreviousData });

export const useOverview = (params = {}, options = {}) =>
  useQuery({ queryKey: keys.stats('overview', params), queryFn: () => api.statsOverview(params), ...options });
export const useStoreStats = (sort) =>
  useQuery({ queryKey: keys.stats('stores', sort), queryFn: () => api.statsStores(sort), placeholderData: keepPreviousData });
export const useCategoryStats = () => useQuery({ queryKey: keys.stats('categories'), queryFn: api.statsCategories });
export const usePlatformStats = () => useQuery({ queryKey: keys.stats('platforms'), queryFn: api.statsPlatforms });

/** Depois de qualquer alteração, tudo que depende de jogos é recarregado da API. */
export function useInvalidateLibrary() {
  const client = useQueryClient();
  return () => client.invalidateQueries({ predicate: (q) => q.queryKey[0] !== 'me' });
}

export function useLibraryMutation(mutationFn, options = {}) {
  const invalidate = useInvalidateLibrary();
  return useMutation({
    mutationFn,
    ...options,
    onSuccess: async (...args) => {
      await invalidate();
      await options.onSuccess?.(...args);
    },
  });
}
