import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SteamBadge from './SteamBadge.jsx';
import DeleteGameDialog from './DeleteGameDialog.jsx';

beforeAll(() => {
  // jsdom não implementa <dialog>.showModal/close
  HTMLDialogElement.prototype.showModal ??= function showModal() {
    this.open = true;
  };
  HTMLDialogElement.prototype.close ??= function close() {
    this.open = false;
  };
});

const steamGame = { id: 'g1', title: 'Portal 2', source: 'STEAM', steam: { appId: 620, storeUrl: 'https://store.steampowered.com/app/620/' } };
const manualGame = { id: 'g2', title: 'Halo', source: 'MANUAL', steam: null };

describe('selo e exclusão de jogos da Steam', () => {
  it('selo com link da loja só para jogos ligados à Steam', () => {
    const { rerender } = render(<SteamBadge game={steamGame} />);
    const link = screen.getByRole('link', { name: /Portal 2 na loja Steam/ });
    expect(link).toHaveAttribute('href', 'https://store.steampowered.com/app/620/');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    rerender(<SteamBadge game={manualGame} />);
    expect(screen.queryByText('Steam')).not.toBeInTheDocument();
  });

  it('"Não importar de novo" vem marcado e pode ser desmarcado', async () => {
    const onConfirm = vi.fn();
    render(<DeleteGameDialog game={steamGame} open onConfirm={onConfirm} onCancel={() => {}} />);
    const box = screen.getByRole('checkbox', { name: 'Não importar de novo da Steam' });
    expect(box).toBeChecked();
    await userEvent.click(screen.getByRole('button', { name: 'Excluir jogo' }));
    expect(onConfirm).toHaveBeenLastCalledWith({ ignoreSteam: true });
    await userEvent.click(box);
    await userEvent.click(screen.getByRole('button', { name: 'Excluir jogo' }));
    expect(onConfirm).toHaveBeenLastCalledWith({ ignoreSteam: false });
  });

  it('jogo manual não mostra a opção', () => {
    render(<DeleteGameDialog game={manualGame} open onConfirm={() => {}} onCancel={() => {}} />);
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  });
});
