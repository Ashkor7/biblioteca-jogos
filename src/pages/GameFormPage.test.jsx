import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ToastProvider from '../components/ToastProvider.jsx';
import GameFormPage from './GameFormPage.jsx';
import { api } from '../services/api.js';
import { emptyGameForm, formToPayload, gameToForm, makeGameResolver } from '../utils/gameForm.js';

vi.mock('../services/api.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    api: {
      getGame: vi.fn(),
      updateGame: vi.fn(),
      listPlatforms: vi.fn(async () => ({ items: [] })),
      listStores: vi.fn(async () => ({ items: [] })),
      listCategories: vi.fn(async () => ({ items: [] })),
    },
  };
});

const STEAM_GAME = {
  id: 'g1',
  title: 'Portal 2',
  ownershipStatus: 'OWNED',
  mediaType: 'DIGITAL',
  platform: { id: 'p1', name: 'Steam', slug: 'steam' },
  store: { id: 's1', name: 'Steam' },
  originalPrice: null,
  paidPrice: null,
  currentWishPrice: null,
  purchasedAt: null,
  playStatus: 'NOT_STARTED',
  completedAt: null,
  playTimeMinutes: 1200,
  legacyPlayMinutes: 1200,
  sessionMinutes: 0,
  ratingStars: null,
  reviewText: null,
  categories: [{ id: 'c1', name: 'Ação' }],
  images: [],
  coverUrl: null,
  targetPrice: null,
  wishPriority: null,
  preferredStore: null,
  wishNotes: null,
  needsReview: true,
  source: 'STEAM',
  description: 'Puzzles com portais.',
  developer: 'Valve',
  publisher: null,
  releaseDate: '2011-04-18',
  releaseDateText: null,
  metacriticScore: 95,
  steam: { appId: 620, storeUrl: 'https://store.steampowered.com/app/620/' },
};

function renderEdit() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <MemoryRouter initialEntries={['/jogos/g1/editar']}>
          <Routes>
            <Route path="/jogos/:id/editar" element={<GameFormPage />} />
            <Route path="/jogos/:id" element={<p>Detalhes</p>} />
          </Routes>
        </MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>,
  );
}

describe('formulário com os metadados novos', () => {
  beforeEach(() => vi.clearAllMocks());

  it('converte os metadados nos dois sentidos', () => {
    const form = gameToForm(STEAM_GAME);
    expect(form).toMatchObject({ description: 'Puzzles com portais.', developer: 'Valve', publisher: '', releaseDate: '2011-04-18', metacriticScore: 95 });
    const payload = formToPayload({ ...form, publisher: '  ', metacriticScore: '' });
    expect(payload).toMatchObject({ developer: 'Valve', publisher: null, metacriticScore: null, releaseDate: '2011-04-18', releaseDateText: null });
  });

  it('o resolver usa as mesmas regras do servidor', async () => {
    const base = { ...emptyGameForm, title: 'Halo', platform: 'Xbox', condition: 'WISHLIST' };
    const bad = await makeGameResolver()({ ...base, metacriticScore: '101', releaseDate: '2020-02-31', developer: 'x'.repeat(121) });
    expect(Object.keys(bad.errors).sort()).toEqual(['developer', 'metacriticScore', 'releaseDate']);
    const ok = await makeGameResolver()({ ...base, metacriticScore: '86', releaseDateText: 'Em breve' });
    expect(ok.errors).toEqual({});
  });

  it('jogo da Steam: campos preenchidos, editáveis e enviados na edição', async () => {
    api.getGame.mockResolvedValue(STEAM_GAME);
    api.updateGame.mockResolvedValue(STEAM_GAME);
    renderEdit();

    expect(await screen.findByLabelText('Descrição')).toHaveValue('Puzzles com portais.');
    expect(screen.getByLabelText('Desenvolvedora')).toHaveValue('Valve');
    expect(screen.getByLabelText('Data de lançamento')).toHaveValue('2011-04-18');
    expect(screen.getByLabelText('Nota Metacritic')).toHaveValue('95');
    expect(screen.getByText(/a ressincronização não sobrescreve/)).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText('Distribuidora'), 'Electronic Arts');
    await userEvent.clear(screen.getByLabelText('Nota Metacritic'));
    await userEvent.click(screen.getByRole('button', { name: 'Salvar alterações' }));

    await waitFor(() => expect(api.updateGame).toHaveBeenCalledTimes(1));
    const [id, payload] = api.updateGame.mock.calls[0];
    expect(id).toBe('g1');
    expect(payload).toMatchObject({ publisher: 'Electronic Arts', metacriticScore: null, developer: 'Valve', description: 'Puzzles com portais.' });
  });
});
