import { useDeferredValue, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { FiPlus, FiShoppingCart, FiEdit2, FiTrash2, FiTrendingDown, FiTarget } from 'react-icons/fi';
import { api } from '../services/api.js';
import { useWishlist, useOverview, usePlatforms, useStores, useLibraryMutation } from '../hooks/queries.js';
import { useAuth } from '../hooks/useAuth.js';
import { useToast } from '../hooks/useToast.js';
import { useUrlFilters } from '../hooks/useUrlFilters.js';
import PageHeader from '../components/PageHeader.jsx';
import FilterBar from '../components/FilterBar.jsx';
import CoverImage from '../components/CoverImage.jsx';
import ConfirmDialog from '../components/ConfirmDialog.jsx';
import PurchaseDialog from '../components/PurchaseDialog.jsx';
import PriceHistoryDialog from '../components/PriceHistoryDialog.jsx';
import Pagination from '../components/Pagination.jsx';
import { LoadingState, ErrorState, EmptyState } from '../components/States.jsx';
import { formatMoney, formatDate, formatPercent, priorityLabel, PRIORITY_TONE, targetStatus } from '../utils/format.js';
import { moneyToCents } from '../../shared/domain.js';

const DEFAULTS = { sort: 'priority', page: '1' };
const validPrice = (v) => (v && Number.isInteger(moneyToCents(v)) ? v : undefined);

export default function WishlistPage() {
  const { user } = useAuth();
  const toast = useToast();
  const { filters, queryFilters, update } = useUrlFilters(DEFAULTS);
  const minPrice = useDeferredValue(validPrice(filters.minPrice));
  const maxPrice = useDeferredValue(validPrice(filters.maxPrice));
  const params = useMemo(() => ({ ...queryFilters, minPrice, maxPrice, pageSize: 50 }), [queryFilters, minPrice, maxPrice]);
  const list = useWishlist(params);
  const overview = useOverview();
  const platforms = usePlatforms();
  const stores = useStores();
  const [buying, setBuying] = useState(null);
  const [removing, setRemoving] = useState(null);
  const [prices, setPrices] = useState(null);

  const remove = useLibraryMutation((game) => api.deleteGame(game.id), {
    onSuccess: (_r, game) => {
      setRemoving(null);
      toast.success(`${game.title} saiu da lista de desejos.`);
    },
    onError: (error) => {
      setRemoving(null);
      toast.error(error.message);
    },
  });

  const wish = overview.data?.wishlist;
  const filtering = ['search', 'platform', 'priority', 'preferredStoreId', 'minPrice', 'maxPrice', 'targetReached'].some((k) => filters[k]);

  return (
    <div className="page-enter">
      <PageHeader
        title="Lista de desejos"
        actions={
          user && (
            <Link to="/jogos/novo?condicao=WISHLIST" className="btn btn-primary">
              <FiPlus aria-hidden="true" /> Adicionar desejo
            </Link>
          )
        }
      >
        Planejamento de compras. Itens daqui não entram na biblioteca nem nos gastos até você marcar como comprado.
      </PageHeader>

      {wish && wish.count > 0 && (
        <section aria-label="Valor da lista" className="panel mb-6" style={{ background: 'linear-gradient(135deg, #ff5aa580, var(--color-line-strong) 50%)' }}>
          <div className="panel-body flex flex-col gap-1 p-4 sm:flex-row sm:items-end sm:justify-between sm:p-5">
            <div>
              <p className="text-sm text-muted">Soma dos últimos preços informados</p>
              <p className="num text-3xl text-ink">{formatMoney(wish.currentValue)}</p>
            </div>
            <div className="text-sm sm:text-right">
              <p>
                <span className="num">{wish.count}</span> {wish.count === 1 ? 'item' : 'itens'}
                {wish.withoutPrice > 0 && (
                  <>
                    {' '}
                    · <span className="text-amber">
                      <span className="num">{wish.withoutPrice}</span> sem preço — total parcial
                    </span>
                  </>
                )}
              </p>
              <p className="text-xs text-faint">Preços digitados por você; nada é consultado automaticamente nas lojas.</p>
            </div>
          </div>
        </section>
      )}

      <FilterBar
        filters={filters}
        onChange={(patch) => update({ ...patch, page: '1' })}
        platforms={platforms.data?.items.filter((p) => p.wishlistCount > 0)}
        stores={stores.data?.items}
        show={['platform', 'priority', 'preferredStore', 'target', 'price', 'sort']}
        sorts={['priority', 'title', 'wishPrice', 'recent']}
        priceLabel="Último preço"
        label="Filtrar lista de desejos"
      />

      {list.isPending ? (
        <LoadingState />
      ) : list.isError ? (
        <ErrorState error={list.error} onRetry={list.refetch} />
      ) : list.data.items.length === 0 ? (
        <EmptyState
          title={filtering ? 'Nada encontrado' : 'Sua lista de desejos está vazia'}
          action={
            user && !filtering ? (
              <Link to="/jogos/novo?condicao=WISHLIST" className="btn btn-ghost">
                Adicionar o primeiro desejo
              </Link>
            ) : null
          }
        >
          {filtering ? 'Ajuste a busca ou os filtros.' : 'Guarde aqui jogos que você quer comprar, com preço-alvo e prioridade.'}
        </EmptyState>
      ) : (
        <>
          <ul className="flex list-none flex-col gap-3 p-0">
            {list.data.items.map((game) => (
              <WishRow
                key={game.id}
                game={game}
                canEdit={Boolean(user)}
                onBuy={() => setBuying(game)}
                onRemove={() => setRemoving(game)}
                onPrices={() => setPrices(game)}
              />
            ))}
          </ul>
          <Pagination
            page={list.data.page}
            totalPages={list.data.totalPages}
            total={list.data.total}
            noun="desejos"
            onPage={(page) => update({ page: String(page) })}
          />
        </>
      )}

      {buying && <PurchaseDialog key={buying.id} game={buying} open onClose={() => setBuying(null)} onDone={() => setBuying(null)} />}
      {prices && <PriceHistoryDialog game={prices} onClose={() => setPrices(null)} />}
      <ConfirmDialog
        open={Boolean(removing)}
        title={`Remover ${removing?.title ?? ''}?`}
        confirmLabel="Remover"
        busy={remove.isPending}
        onCancel={() => setRemoving(null)}
        onConfirm={() => remove.mutate(removing)}
      >
        O item, o histórico de preços e as notas saem do banco de dados.
      </ConfirmDialog>
    </div>
  );
}

function WishRow({ game, canEdit, onBuy, onRemove, onPrices }) {
  const current = game.currentWishPrice !== null ? Number(game.currentWishPrice) : null;
  const reference = game.originalPrice !== null ? Number(game.originalPrice) : null;
  const below = current !== null && reference ? ((reference - current) / reference) * 100 : null;
  const target = targetStatus(game.currentWishPrice, game.targetPrice);

  return (
    <li className={`panel ${target && target.state !== 'ABOVE' ? 'panel-accent' : ''}`}>
      <div className="panel-body grid grid-cols-[4.5rem_1fr] gap-3 p-3 sm:grid-cols-[5rem_1fr_auto] sm:items-center sm:gap-5 sm:p-4">
        <Link to={`/jogos/${game.id}`} tabIndex={-1} aria-hidden="true" className="row-span-2 sm:row-span-1">
          <CoverImage src={game.coverUrl} title={game.title} platform={game.platform.name} />
        </Link>
        <div className="min-w-0">
          <div className="flex flex-wrap items-baseline gap-x-3">
            <h2 className="text-lg">
              <Link to={`/jogos/${game.id}`} className="text-ink no-underline hover:text-cyan">
                {game.title}
              </Link>
            </h2>
            {game.wishPriority && (
              <span className={`text-xs font-semibold ${PRIORITY_TONE[game.wishPriority]}`}>Prioridade {priorityLabel(game.wishPriority).toLowerCase()}</span>
            )}
          </div>
          <p className="text-sm text-muted">
            <Link to={`/plataformas/${game.platform.slug}`} className="text-muted hover:text-cyan">
              {game.platform.name}
            </Link>
            {game.preferredStore && <span> · prefere {game.preferredStore.name}</span>}
          </p>
          <dl className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-sm">
            <div>
              <dt className="text-xs text-faint">Último preço</dt>
              <dd className="num">{current !== null ? formatMoney(current) : <span className="text-faint">sem preço</span>}</dd>
            </div>
            <div>
              <dt className="text-xs text-faint">Preço-alvo</dt>
              <dd className="num text-violet">{formatMoney(game.targetPrice)}</dd>
            </div>
            <div>
              <dt className="text-xs text-faint">Referência</dt>
              <dd className="num">{formatMoney(game.originalPrice)}</dd>
            </div>
            {below !== null && (
              <div>
                <dt className="text-xs text-faint">{below >= 0 ? 'Abaixo da referência' : 'Acima da referência'}</dt>
                <dd className={`num ${below >= 0 ? 'text-ok' : 'text-amber'}`}>{formatPercent(Math.abs(below))}</dd>
              </div>
            )}
            <div>
              <dt className="text-xs text-faint">Preço visto em</dt>
              <dd>{formatDate(game.wishPriceUpdatedAt)}</dd>
            </div>
          </dl>
          {target && (
            <p className={`mt-2 inline-flex items-center gap-1.5 text-sm font-semibold ${target.tone}`}>
              <FiTarget aria-hidden="true" /> {target.label}
            </p>
          )}
          {game.wishNotes && <p className="mt-1 line-clamp-2 text-sm text-ink/80">{game.wishNotes}</p>}
        </div>
        {canEdit && (
          <div className="col-span-2 flex flex-wrap gap-2 sm:col-span-1 sm:flex-col sm:items-stretch">
            <button type="button" className="btn btn-primary btn-sm" onClick={onBuy}>
              <FiShoppingCart aria-hidden="true" /> Comprei
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={onPrices} aria-label={`Histórico de preços de ${game.title}`}>
              <FiTrendingDown aria-hidden="true" /> Preços
            </button>
            <Link to={`/jogos/${game.id}/editar`} className="btn btn-ghost btn-sm" aria-label={`Editar ${game.title}`}>
              <FiEdit2 aria-hidden="true" /> Editar
            </Link>
            <button type="button" className="btn btn-danger btn-sm" onClick={onRemove} aria-label={`Remover ${game.title}`}>
              <FiTrash2 aria-hidden="true" /> Remover
            </button>
          </div>
        )}
      </div>
    </li>
  );
}
