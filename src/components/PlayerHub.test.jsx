import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import XpBar from './XpBar.jsx';
import PublicProfileView from './PublicProfileView.jsx';
import AchievementCard from './AchievementCard.jsx';
import { levelProgress } from '../../shared/progression.js';

function wrap(ui) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('componentes do Player Hub', () => {
  it('barra de XP acessível com o progresso do nível', () => {
    render(<XpBar progress={levelProgress(150)} />);
    const bar = screen.getByRole('progressbar');
    expect(bar).toHaveAttribute('aria-valuenow', '25');
    expect(screen.getByText(/Faltam/)).toHaveTextContent('150 XP');
  });

  it('conquista bloqueada mostra progresso e recompensa', () => {
    render(
      <AchievementCard
        achievement={{ code: 'marathoner', name: 'Maratonista', description: 'x', icon: 'clock', rarity: 'RARE', category: 'Jogatina', xp: 150, current: 73, target: 100, percent: 73, unlocked: false }}
      />,
    );
    expect(screen.getByRole('article', { name: /Maratonista, bloqueada/ })).toBeInTheDocument();
    expect(screen.getByText('73 / 100')).toBeInTheDocument();
    expect(screen.getByText('+150 XP')).toBeInTheDocument();
    expect(screen.getByText('Rara')).toBeInTheDocument();
  });

  it('perfil público mostra só as seções enviadas pelo servidor', () => {
    const view = {
      username: 'ash',
      displayName: 'Ash',
      bio: null,
      avatarUrl: null,
      bannerUrl: null,
      title: { code: 'novato-digital', name: 'Novato Digital' },
      level: 3,
      progressPercent: 40,
      sections: {
        favorites: [{ id: '1', title: 'Hades', platform: { name: 'Steam', slug: 'steam' }, coverUrl: null, ratingStars: 5 }],
        collections: [],
      },
    };
    wrap(<PublicProfileView view={view} preview />);
    expect(screen.getByRole('heading', { name: 'Jogos favoritos' })).toBeInTheDocument();
    expect(screen.getByText('Hades')).toBeInTheDocument();
    expect(screen.queryByText(/Total pago/)).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Biblioteca' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Atividades recentes' })).not.toBeInTheDocument();
  });
});
