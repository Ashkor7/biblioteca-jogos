import { useState } from 'react';
import { Link } from 'react-router';
import { FiPlus, FiShoppingCart, FiEdit2, FiTrash2 } from 'react-icons/fi';
import { api } from '../services/api.js';
import { useWishlist, useOverview, usePlatforms, useLibraryMutation } from '../hooks/queries.js';
import { useAuth } from '../hooks/useAuth.js';
import { useToast } from '../hooks/useToast.js';
import { useUrlFilters } from '../hooks/useUrlFilters.js';
import PageHeader from '../components/PageHeader.jsx';
import FilterBar from '../components/FilterBar.jsx';
import CoverImage from '../components/CoverImage.jsx';
import ConfirmDialog from '../components/ConfirmDialog.jsx';
import PurchaseDialog from '../components/PurchaseDialog.jsx';
import Pagination from '../components/Pagination.jsx';
import { LoadingState, ErrorState, EmptyState } from '../components/States.jsx';
import { formatMoney, formatDate, formatPercent } from '../utils/format.js';

const DEFAULTS = { sort: 'title', page: '1' };

export default function WishlistPage() {
  const { user } = useAuth();
  const toast = useToast();
  const { filters, queryFilters, update } = useUrlFilters(DEFAULTS);
  const list = useWishlist({ ...queryFilters, pageSize: 50 });
  const overview = useOverview();
  const platforms = usePlatforms();
  const [buying, setBuying] = useState(null);
  const [removing, setRemoving] = useState(null);

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
        Jogos que você ainda não comprou. Não entram na contagem da biblioteca nem nos gastos.
      </PageHeader>

      {wish && wish.count > 0 && (
        <section aria-label="Valor da lista" className="panel mb-6">
          <div className="panel-body flex flex-col gap-1 p-4 sm:flex-row sm:items-end sm:justify-between sm:p-5">
            <div>
              <p className="text-sm text-muted">Valor atual informado</p>
              <p className="num text-3xl text-ink">{formatMoney(wish.currentValue)}</p>
            </div>
            <div className="text-sm sm:text-right">
              <p >
                <span className="num">{wish.count}</span> {wish.count === 1 ? 'item' : 'itens'}
                {wish.withoutPrice > 0 && (
                  <>
                    {' '}
                    · <span className="text-amber">
                      <span className="num">{wish.withoutPrice}</span> sem preço atual — total parcial
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
        show={['platform', 'sort']}
        sorts={['title', 'wishPrice', 'recent']}
        label="Filtrar lista de desejos"
      />

      {list.isPending ? (
        <LoadingState />
      ) : list.isError ? (
        <ErrorState error={list.error} onRetry={list.refetch} />
      ) : list.data.items.length === 0 ? (
        <EmptyState
          title={filters.search || filters.platform ? 'Nada encontrado' : 'Sua lista de desejos está vazia'}
          action={
            user && !filters.search ? (
              <Link to="/jogos/novo?condicao=WISHLIST" className="btn btn-ghost">
                Adicionar o primeiro desejo
              </Link>
            ) : null
          }
        >
          {filters.search || filters.platform
            ? 'Ajuste a busca ou o filtro de plataforma.'
            : 'Guarde aqui jogos que você quer comprar e acompanhe o preço que encontrar.'}
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
              />
            ))}
          </ul>
          <Pagination
            page={list.data.page}
            totalPages={list.data.totalPages}
            total={list.data.total}
            onPage={(page) => update({ page: String(page) })}
          />
        </>
      )}

      {buying && (
        <PurchaseDialog key={buying.id} game={buying} open onClose={() => setBuying(null)} onDone={() => setBuying(null)} />
      )}
      <ConfirmDialog
        open={Boolean(removing)}
        title={`Remover ${removing?.title ?? ''}?`}
        confirmLabel="Remover"
        busy={remove.isPending}
        onCancel={() => setRemoving(null)}
        onConfirm={() => remove.mutate(removing)}
      >
        O item sai da lista de desejos e do banco de dados.
      </ConfirmDialog>
    </div>
  );
}

function WishRow({ game, canEdit, onBuy, onRemove }) {
  const current = game.currentWishPrice !== null ? Number(game.currentWishPrice) : null;
  const reference = game.originalPrice !== null ? Number(game.originalPrice) : null;
  const below = current !== null && reference ? ((reference - current) / reference) * 100 : null;

  return (
    <li className="panel">
      <div className="panel-body grid grid-cols-[4.5rem_1fr] gap-3 p-3 sm:grid-cols-[5rem_1fr_auto] sm:items-center sm:gap-5 sm:p-4">
        <Link to={`/jogos/${game.id}`} tabIndex={-1} aria-hidden="true" className="row-span-2 sm:row-span-1">
          <CoverImage src={game.coverUrl} title={game.title} platform={game.platform.name} />
        </Link>
        <div className="min-w-0">
          <h2 className="text-lg">
            <Link to={`/jogos/${game.id}`} className="text-ink no-underline hover:text-cyan">
              {game.title}
            </Link>
          </h2>
          <p className="text-sm text-muted">
            <Link to={`/plataformas/${game.platform.slug}`} className="text-muted hover:text-cyan">
              {game.platform.name}
            </Link>
          </p>
          <dl className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-sm">
            <div>
              <dt className="text-xs text-faint">Preço atual</dt>
              <dd className="num">{current !== null ? formatMoney(current) : <span className="text-faint">sem preço</span>}</dd>
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
              <dd >{formatDate(game.wishPriceUpdatedAt)}</dd>
            </div>
          </dl>
          {game.categories.length > 0 && (
            <ul className="mt-2 flex list-none flex-wrap gap-1 p-0" aria-label="Categorias">
              {game.categories.map((c) => (
                <li key={c.id} className="tag">
                  {c.name}
                </li>
              ))}
            </ul>
          )}
        </div>
        {canEdit && (
          <div className="col-span-2 flex flex-wrap gap-2 sm:col-span-1 sm:flex-col sm:items-stretch">
            <button type="button" className="btn btn-primary btn-sm" onClick={onBuy}>
              <FiShoppingCart aria-hidden="true" /> Comprei
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
