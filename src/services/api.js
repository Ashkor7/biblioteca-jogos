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
};
