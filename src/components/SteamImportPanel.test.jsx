import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ToastProvider from './ToastProvider.jsx';
import SteamImportPanel, { SteamImporter, PreviewTable } from './SteamImportPanel.jsx';
import { api, ApiError } from '../services/api.js';

vi.mock('../services/api.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    api: {
      steamStatus: vi.fn(),
      steamPreview: vi.fn(),
      steamImport: vi.fn(),
      steamResync: vi.fn(),
      steamIgnored: vi.fn(async () => ({ items: [] })),
      steamJob: vi.fn(),
      listPlatforms: vi.fn(async () => ({ items: [] })),
      listStores: vi.fn(async () => ({ items: [] })),
      getGame: vi.fn(),
    },
  };
});

const ACCOUNT = { steamId64: '76561198000000001', personaName: 'Jogador Teste' };

const item = (appId, name, status, extra = {}) => ({
  appId,
  name,
  status,
  playtimeMinutes: 120,
  playtime2WeeksMinutes: 0,
  lastPlayedAt: null,
  iconUrl: null,
  storeUrl: `https://store.steampowered.com/app/${appId}/`,
  appType: null,
  match: null,
  ...extra,
});

const PREVIEW = {
  visible: true,
  notice: null,
  total: 5,
  counts: { NEW: 2, EXISTING: 1, DUPLICATE: 1, WISHLIST: 1, IGNORED: 0, NOT_GAME: 0 },
  items: [
    item(1145360, 'Hades', 'DUPLICATE', { match: { gameId: 'g-hades', title: 'HADES', platform: 'PC', ownershipStatus: 'OWNED' } }),
    item(620, 'Portal 2', 'NEW'),
    item(413150, 'Stardew Valley', 'WISHLIST', { match: { gameId: 'g-sv', title: 'Stardew Valley', platform: 'PC', ownershipStatus: 'WISHLIST' } }),
    item(292030, 'The Witcher 3', 'NEW'),
    item(440, 'Team Fortress 2', 'EXISTING', { match: { gameId: 'g-tf2', title: 'TF2', platform: 'Steam', ownershipStatus: 'OWNED' } }),
  ],
};

function wrap(ui) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <MemoryRouter>{ui}</MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>,
  );
}

const table = () => screen.getByRole('table', { name: /Jogos da conta Steam/ });

describe('importação da Steam (interface)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('mostra o carregamento enquanto lê a conta', async () => {
    api.steamPreview.mockReturnValue(new Promise(() => {}));
    wrap(<SteamImporter account={ACCOUNT} />);
    expect(await screen.findByText('Lendo os jogos da sua conta Steam…')).toBeInTheDocument();
  });

  it('explica o erro da Steam e o perfil privado', async () => {
    api.steamPreview.mockRejectedValueOnce(new ApiError(502, 'A Steam não respondeu. Tente de novo em alguns minutos.'));
    wrap(<SteamImporter account={ACCOUNT} />);
    expect(await screen.findByRole('alert')).toHaveTextContent('A Steam não respondeu');

    api.steamPreview.mockResolvedValueOnce({ visible: false, notice: 'Deixe "Detalhes de jogos" como Público.', total: 0, counts: {}, items: [] });
    await userEvent.click(screen.getByRole('button', { name: /Tentar de novo/ }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Detalhes de jogos');
  });

  it('filtra por situação e busca pelo nome', async () => {
    api.steamPreview.mockResolvedValue(PREVIEW);
    wrap(<SteamImporter account={ACCOUNT} />);
    await screen.findByText('Portal 2');
    expect(within(table()).getAllByRole('row')).toHaveLength(6); // cabeçalho + 5

    await userEvent.selectOptions(screen.getByLabelText('Situação'), 'DUPLICATE');
    expect(within(table()).getAllByRole('row')).toHaveLength(2);
    expect(within(table()).getByText('Hades')).toBeInTheDocument();

    await userEvent.selectOptions(screen.getByLabelText('Situação'), 'ALL');
    await userEvent.type(screen.getByLabelText('Buscar na prévia'), 'witcher');
    expect(within(table()).getAllByRole('row')).toHaveLength(2);
    expect(within(table()).getByText('The Witcher 3')).toBeInTheDocument();

    await userEvent.clear(screen.getByLabelText('Buscar na prévia'));
    await userEvent.type(screen.getByLabelText('Buscar na prévia'), 'zzz');
    expect(screen.getByText('Nenhum jogo com esses filtros.')).toBeInTheDocument();
  });

  it('seleciona os novos, vincula o duplicado e envia a importação com as opções', async () => {
    api.steamPreview.mockResolvedValue(PREVIEW);
    api.steamImport.mockResolvedValue({ created: 2, linked: 1, ignored: 0, skipped: [], jobId: null });
    wrap(<SteamImporter account={ACCOUNT} />);
    await screen.findByText('Portal 2');

    // Já na biblioteca e desejos não podem ser marcados para importar.
    expect(screen.getByRole('checkbox', { name: 'Selecionar Team Fortress 2' })).toBeDisabled();
    expect(screen.getByRole('checkbox', { name: 'Selecionar Stardew Valley' })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Marcar como comprado/ })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /Selecionar todos os novos/ }));
    expect(screen.getByText('2 jogo(s) selecionado(s).')).toBeInTheDocument();
    await userEvent.selectOptions(screen.getByLabelText('O que fazer com Hades'), 'LINK');
    expect(screen.getByText('3 jogo(s) selecionado(s).')).toBeInTheDocument();

    const platform = screen.getByLabelText('Plataforma de destino');
    await userEvent.clear(platform);
    await userEvent.type(platform, 'PC');
    await userEvent.click(screen.getByRole('switch', { name: 'Categorias a partir dos gêneros' }));

    await userEvent.click(screen.getByRole('button', { name: 'Importar 3 jogo(s)' }));
    await waitFor(() => expect(api.steamImport).toHaveBeenCalledTimes(1));
    const payload = api.steamImport.mock.calls[0][0];
    expect(payload.items).toEqual(
      expect.arrayContaining([
        { appId: 620, action: 'IMPORT' },
        { appId: 292030, action: 'IMPORT' },
        { appId: 1145360, action: 'LINK', gameId: 'g-hades' },
      ]),
    );
    expect(payload.options).toMatchObject({ platform: 'PC', store: 'Steam', genresAsCategories: false, importAchievements: true, screenshots: 0 });
    expect(await screen.findByRole('heading', { name: 'Importação' })).toBeInTheDocument();
  });

  it('lista vazia na prévia', async () => {
    const onChange = vi.fn();
    wrap(<PreviewTable items={[]} counts={{}} choices={new Map()} onChange={onChange} onPurchase={() => {}} />);
    expect(screen.getByRole('heading', { name: 'Nenhum jogo na conta' })).toBeInTheDocument();
  });

  it('sem chave ou sem conta vinculada, explica o que falta', async () => {
    api.steamStatus.mockResolvedValueOnce({ enabled: false, disabledReason: 'Falta a STEAM_API_KEY no .env do servidor.', account: null });
    const { unmount } = wrap(<SteamImportPanel />);
    expect(await screen.findByText('Falta a STEAM_API_KEY no .env do servidor.')).toBeInTheDocument();
    expect(api.steamPreview).not.toHaveBeenCalled();
    unmount();

    api.steamStatus.mockResolvedValueOnce({ enabled: true, disabledReason: null, account: null });
    wrap(<SteamImportPanel />);
    expect(await screen.findByRole('heading', { name: 'Vincule sua conta Steam' })).toBeInTheDocument();
  });
});
