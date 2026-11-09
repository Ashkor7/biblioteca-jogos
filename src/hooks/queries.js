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
  profile: ['profile'],
  profileStats: ['profile-stats'],
  favorites: ['favorites'],
  sessions: (params) => ['sessions', params],
  diary: (params) => ['diary', params],
  collections: ['collections'],
  collection: (id) => ['collection', id],
  gameCollections: (id) => ['game-collections', id],
  goals: (params) => ['goals', params],
  achievements: ['achievements'],
  activities: (params) => ['activities', params],
  xp: ['xp'],
  notifications: ['notifications'],
  prices: (id) => ['prices', id],
  preview: ['profile-preview'],
};

// Chaves de páginas públicas: não dependem da sessão e não são invalidadas por mutações.
const PUBLIC_PREFIX = 'public';

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
export const useFinance = (params) =>
  useQuery({ queryKey: keys.stats('finance', params), queryFn: () => api.statsFinance(params), placeholderData: keepPreviousData });

export const useProfile = (options = {}) => useQuery({ queryKey: keys.profile, queryFn: api.profile, ...options });
export const useProfileStats = () => useQuery({ queryKey: keys.profileStats, queryFn: api.profileStats });
export const useProfilePreview = () => useQuery({ queryKey: keys.preview, queryFn: api.profilePreview });
export const useFavorites = () => useQuery({ queryKey: keys.favorites, queryFn: api.favorites });
export const useSessions = (params) =>
  useQuery({ queryKey: keys.sessions(params), queryFn: () => api.sessions(params), placeholderData: keepPreviousData });
export const useDiary = (params) =>
  useQuery({ queryKey: keys.diary(params), queryFn: () => api.diarySummary(params), placeholderData: keepPreviousData });
export const useCollections = (options = {}) => useQuery({ queryKey: keys.collections, queryFn: api.collections, ...options });
export const useCollection = (id) => useQuery({ queryKey: keys.collection(id), queryFn: () => api.collection(id), enabled: Boolean(id) });
export const useGameCollections = (id) =>
  useQuery({ queryKey: keys.gameCollections(id), queryFn: () => api.collectionsOfGame(id), enabled: Boolean(id) });
export const useGoals = (params = {}) =>
  useQuery({ queryKey: keys.goals(params), queryFn: () => api.goals(params), placeholderData: keepPreviousData });
export const useAchievements = () => useQuery({ queryKey: keys.achievements, queryFn: api.achievements });
export const useActivities = (params) =>
  useQuery({ queryKey: keys.activities(params), queryFn: () => api.activities(params), placeholderData: keepPreviousData });
export const useXpHistory = () => useQuery({ queryKey: keys.xp, queryFn: api.xpHistory });
export const usePriceHistory = (id, options = {}) =>
  useQuery({ queryKey: keys.prices(id), queryFn: () => api.priceHistory(id), enabled: Boolean(id), ...options });
export const useNotifications = (options = {}) =>
  useQuery({ queryKey: keys.notifications, queryFn: api.notifications, staleTime: 0, ...options });

export const usePublicProfile = (username) =>
  useQuery({ queryKey: [PUBLIC_PREFIX, 'profile', username], queryFn: () => api.publicProfile(username), enabled: Boolean(username) });
export const usePublicGames = (username, kind, page, options = {}) =>
  useQuery({
    queryKey: [PUBLIC_PREFIX, kind, username, page],
    queryFn: () => api.publicGames(username, kind, page),
    placeholderData: keepPreviousData,
    ...options,
  });
export const usePublicCollection = (username, id) =>
  useQuery({ queryKey: [PUBLIC_PREFIX, 'collection', username, id], queryFn: () => api.publicCollection(username, id) });

/** Depois de qualquer alteração, tudo que depende de jogos é recarregado da API. */
export function useInvalidateLibrary() {
  const client = useQueryClient();
  return () => client.invalidateQueries({ predicate: (q) => q.queryKey[0] !== 'me' && q.queryKey[0] !== PUBLIC_PREFIX });
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
