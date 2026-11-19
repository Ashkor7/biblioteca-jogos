import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ToastProvider from './ToastProvider.jsx';
import GameCard from './GameCard.jsx';
import { ProgressRing } from './ContextRail.jsx';
import { api } from '../services/api.js';

vi.mock('../services/api.js', () => ({
  api: {
    deleteGame: vi.fn(async () => null),
    addFavorite: vi.fn(async () => ({ items: [] })),
    removeFavorite: vi.fn(async () => null),
  },
}));

// jsdom não implementa <dialog> modal
beforeAll(() => {
  HTMLDialogElement.prototype.showModal ??= function showModal() {
    this.open = true;
  };
  HTMLDialogElement.prototype.close ??= function close() {
    this.open = false;
  };
});

const game = {
  id: 'g1',
  title: 'Neon Drift',
  ownershipStatus: 'OWNED',
  mediaType: 'DIGITAL',
  playStatus: 'PLAYING',
  playTimeMinutes: 90,
  ratingStars: 4,
  isFeatured: false,
  isFavorite: false,
  coverUrl: null,
  platform: { id: 'p1', name: 'Steam', slug: 'steam' },
};

function wrap(ui) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <MemoryRouter>{ui}</MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>,
  );
}

describe('cartão de jogo do redesign', () => {
  it('mostra dados reais do jogo e liga ao detalhe', () => {
    wrap(<GameCard game={game} />);
    expect(screen.getByRole('link', { name: 'Neon Drift, Steam' })).toHaveAttribute('href', '/jogos/g1');
    expect(screen.getByText('Jogando')).toBeInTheDocument();
    expect(screen.queryByText(/instalado/i)).not.toBeInTheDocument();
  });

  it('favoritar chama a API e expõe o estado com aria-pressed', async () => {
    const user = userEvent.setup();
    wrap(<GameCard game={game} />);
    const star = screen.getByRole('button', { name: 'Favoritar Neon Drift' });
    expect(star).toHaveAttribute('aria-pressed', 'false');
    await user.click(star);
    await waitFor(() => expect(api.addFavorite).toHaveBeenCalledWith('g1'));
  });

  it('excluir pelo menu só acontece depois da confirmação', async () => {
    const user = userEvent.setup();
    wrap(<GameCard game={game} />);
    await user.click(screen.getByRole('button', { name: 'Ações de Neon Drift' }));
    expect(screen.getByRole('menuitem', { name: 'Editar' })).toHaveAttribute('href', '/jogos/g1/editar');
    await user.click(screen.getByRole('menuitem', { name: 'Excluir' }));
    expect(api.deleteGame).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Excluir jogo' }));
    await waitFor(() => expect(api.deleteGame).toHaveBeenCalledTimes(1));
  });

  it('Esc fecha o menu e devolve o foco ao botão', async () => {
    const user = userEvent.setup();
    wrap(<GameCard game={game} />);
    const trigger = screen.getByRole('button', { name: 'Ações de Neon Drift' });
    await user.click(trigger);
    expect(screen.getByRole('menu')).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });
});

describe('anel de progresso', () => {
  it('descreve a porcentagem para leitores de tela e limita a 0–100', () => {
    render(<ProgressRing value={140} label="Taxa de conclusão" />);
    expect(screen.getByRole('img', { name: 'Taxa de conclusão: 100%' })).toBeInTheDocument();
  });
});
