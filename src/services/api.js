// Cliente HTTP da API. Toda a persistência acontece no servidor (PostgreSQL):
// nada de dados da biblioteca fica guardado no navegador.

export class ApiError extends Error {
  constructor(status, message, { code, fields } = {}) {
    super(message);
    this.status = status;
    this.code = code;
    this.fields = fields ?? {};
  }
}

const OFFLINE_MESSAGE =
  'Não foi possível conectar ao servidor da biblioteca. Verifique se a API está em execução e tente de novo.';

async function request(path, { method = 'GET', body, formData, signal } = {}) {
  let response;
  try {
    response = await fetch(`/api${path}`, {
      method,
      credentials: 'same-origin',
      signal,
      headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      body: formData ?? (body !== undefined ? JSON.stringify(body) : undefined),
    });
  } catch (error) {
    if (error.name === 'AbortError') throw error;
    throw new ApiError(0, OFFLINE_MESSAGE, { code: 'NETWORK_ERROR' });
  }

  if (response.status === 204) return null;
  const isJson = response.headers.get('content-type')?.includes('application/json');
  const payload = isJson ? await response.json().catch(() => null) : null;

  if (!response.ok) {
    if (!payload?.error) {
      // O proxy do Vite responde 500/502/504 sem JSON quando a API está desligada.
      const message = response.status >= 500 ? OFFLINE_MESSAGE : `Erro ${response.status} ao falar com a API.`;
      throw new ApiError(response.status, message, { code: 'API_UNAVAILABLE' });
    }
    throw new ApiError(response.status, payload.error.message, payload.error);
  }
  return payload;
}

function query(params = {}) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') search.set(key, value);
  }
  const text = search.toString();
  return text ? `?${text}` : '';
}

export const api = {
  me: () => request('/auth/me'),
  login: (credentials) => request('/auth/login', { method: 'POST', body: credentials }),
  logout: () => request('/auth/logout', { method: 'POST' }),

  listGames: (params, signal) => request(`/games${query(params)}`, { signal }),
  getGame: (id) => request(`/games/${id}`),
  createGame: (payload, coverFile) => {
    if (!coverFile) return request('/games', { method: 'POST', body: payload });
    const formData = new FormData();
    formData.set('data', JSON.stringify(payload));
    formData.set('cover', coverFile);
    return request('/games', { method: 'POST', formData });
  },
  updateGame: (id, payload) => request(`/games/${id}`, { method: 'PATCH', body: payload }),
  deleteGame: (id) => request(`/games/${id}`, { method: 'DELETE' }),
  setFeatured: (id, isFeatured) => request(`/games/${id}/featured`, { method: 'PATCH', body: { isFeatured } }),
  markPurchased: (id, payload) => request(`/games/${id}/mark-purchased`, { method: 'PATCH', body: payload }),

  uploadImages: (id, files, { makeCover = false } = {}) => {
    const formData = new FormData();
    for (const file of files) formData.append('images', file);
    if (makeCover) formData.set('cover', 'true');
    return request(`/games/${id}/images`, { method: 'POST', formData });
  },
  addImageUrl: (id, url, isCover = false) =>
    request(`/games/${id}/images`, { method: 'POST', body: { url, isCover } }),
  setCover: (id, imageId) => request(`/games/${id}/images/${imageId}`, { method: 'PATCH', body: { isCover: true } }),
  reorderImages: (id, imageIds) => request(`/games/${id}/images/order`, { method: 'PUT', body: { imageIds } }),
  deleteImage: (id, imageId) => request(`/games/${id}/images/${imageId}`, { method: 'DELETE' }),

  listPlatforms: () => request('/platforms'),
  getPlatform: (slug) => request(`/platforms/${encodeURIComponent(slug)}`),
  renamePlatform: (id, name) => request(`/platforms/${id}`, { method: 'PATCH', body: { name } }),
  listStores: () => request('/stores'),
  listCategories: () => request('/categories'),
  listWishlist: (params) => request(`/wishlist${query(params)}`),

  statsOverview: (params) => request(`/statistics/overview${query(params)}`),
  statsPlatforms: () => request('/statistics/platforms'),
  statsStores: (sort) => request(`/statistics/stores${query({ sort })}`),
  statsCategories: () => request('/statistics/categories'),

  importLegacy: (games) => request('/import/legacy', { method: 'POST', body: games }),

  // Player Hub
  statsFinance: (params) => request(`/statistics/finance${query(params)}`),
  profile: () => request('/profile'),
  updateProfile: (payload) => request('/profile', { method: 'PATCH', body: payload }),
  updatePrivacy: (payload) => request('/profile/privacy', { method: 'PATCH', body: payload }),
  profileStats: () => request('/profile/stats'),
  profilePreview: () => request('/profile/preview'),
  setProfileImage: (kind, file) => {
    const formData = new FormData();
    formData.set('image', file);
    return request(`/profile/${kind}`, { method: 'PUT', formData });
  },
  removeProfileImage: (kind) => request(`/profile/${kind}`, { method: 'DELETE' }),

  favorites: () => request('/favorites'),
  addFavorite: (gameId) => request('/favorites', { method: 'POST', body: { gameId } }),
  updateFavorite: (gameId, payload) => request(`/favorites/${gameId}`, { method: 'PATCH', body: payload }),
  removeFavorite: (gameId) => request(`/favorites/${gameId}`, { method: 'DELETE' }),
  reorderFavorites: (gameIds) => request('/favorites/order', { method: 'PUT', body: { gameIds } }),

  sessions: (params) => request(`/sessions${query(params)}`),
  diarySummary: (params) => request(`/sessions/summary${query(params)}`),
  createSession: (payload) => request('/sessions', { method: 'POST', body: payload }),
  updateSession: (id, payload) => request(`/sessions/${id}`, { method: 'PATCH', body: payload }),
  deleteSession: (id) => request(`/sessions/${id}`, { method: 'DELETE' }),

  collections: () => request('/collections'),
  collection: (id) => request(`/collections/${id}`),
  collectionsOfGame: (gameId) => request(`/collections/of-game/${gameId}`),
  createCollection: (payload) => request('/collections', { method: 'POST', body: payload }),
  updateCollection: (id, payload) => request(`/collections/${id}`, { method: 'PATCH', body: payload }),
  deleteCollection: (id) => request(`/collections/${id}`, { method: 'DELETE' }),
  addToCollection: (id, gameIds) => request(`/collections/${id}/items`, { method: 'POST', body: { gameIds } }),
  removeFromCollection: (id, gameId) => request(`/collections/${id}/items/${gameId}`, { method: 'DELETE' }),
  reorderCollection: (id, gameIds) => request(`/collections/${id}/items/order`, { method: 'PUT', body: { gameIds } }),

  goals: (params) => request(`/goals${query(params)}`),
  createGoal: (payload) => request('/goals', { method: 'POST', body: payload }),
  updateGoal: (id, payload) => request(`/goals/${id}`, { method: 'PATCH', body: payload }),
  deleteGoal: (id) => request(`/goals/${id}`, { method: 'DELETE' }),

  achievements: () => request('/progression/achievements'),
  activities: (params) => request(`/progression/activities${query(params)}`),
  xpHistory: () => request('/progression/xp'),
  notifications: () => request('/progression/notifications'),
  ackNotifications: (upTo) => request('/progression/notifications/ack', { method: 'POST', body: { upTo } }),
  rebuildProgress: () => request('/progression/rebuild', { method: 'POST' }),

  priceHistory: (gameId) => request(`/games/${gameId}/prices`),
  addPrice: (gameId, payload) => request(`/games/${gameId}/prices`, { method: 'POST', body: payload }),
  deletePrice: (gameId, entryId) => request(`/games/${gameId}/prices/${entryId}`, { method: 'DELETE' }),

  publicProfile: (username) => request(`/public/profiles/${encodeURIComponent(username)}`),
  publicGames: (username, kind, page) =>
    request(`/public/profiles/${encodeURIComponent(username)}/${kind}${query({ page })}`),
  publicCollection: (username, id) => request(`/public/profiles/${encodeURIComponent(username)}/collections/${id}`),
};
