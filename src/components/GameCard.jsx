import { useCallback, useId, useRef, useState } from 'react';
import { Link } from 'react-router';
import { FiAward, FiAlertCircle, FiHeart, FiMoreVertical, FiEye, FiEdit2, FiTrash2 } from 'react-icons/fi';
import { api } from '../services/api.js';
import { useLibraryMutation } from '../hooks/queries.js';
import { useToast } from '../hooks/useToast.js';
import { useDismiss } from '../hooks/useDismiss.js';
import CoverImage from './CoverImage.jsx';
import StatusBadge from './StatusBadge.jsx';
import ConfirmDialog from './ConfirmDialog.jsx';
import { StarRating } from './StarRating.jsx';
import { formatMoney, formatDate, formatHours, mediaLabel } from '../utils/format.js';

/** Liga/desliga o favorito (FavoriteGame no servidor; independente do destaque). */
export function FavoriteButton({ game, className = 'heart-btn' }) {
  const toast = useToast();
  const toggle = useLibraryMutation(() => (game.isFavorite ? api.removeFavorite(game.id) : api.addFavorite(game.id)), {
    onSuccess: () => toast.success(game.isFavorite ? `${game.title} saiu dos favoritos.` : `${game.title} entrou nos favoritos.`),
    onError: (error) => toast.error(error.message),
  });
  return (
    <button
      type="button"
      className={`${className} ${game.isFavorite ? 'is-on' : ''}`}
      aria-pressed={game.isFavorite}
      aria-label={game.isFavorite ? `Remover ${game.title} dos favoritos` : `Favoritar ${game.title}`}
      title={game.isFavorite ? 'Remover dos favoritos' : 'Favoritar'}
      disabled={toggle.isPending}
      onClick={() => toggle.mutate()}
    >
      <FiHeart aria-hidden="true" className={game.isFavorite ? 'fill-current' : ''} />
    </button>
  );
}

/** Menu "⋮" do jogo: ver detalhes, editar e excluir (sempre com confirmação). */
export function GameMenu({ game, placement = 'bottom-full right-0 mb-1' }) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const wrapper = useRef(null);
  const trigger = useRef(null);
  const menuId = useId();
  const close = useCallback(() => setOpen(false), []);
  useDismiss(open, close, wrapper, trigger);

  const remove = useLibraryMutation(() => api.deleteGame(game.id), {
    onSuccess: () => {
      setConfirming(false);
      toast.success(`${game.title} foi excluído.`);
    },
    onError: (error) => {
      setConfirming(false);
      toast.error(error.message);
    },
  });

  return (
    <div ref={wrapper} className={`relative ${open ? 'z-30' : ''}`}>
      <button
        ref={trigger}
        type="button"
        className="card-icon-btn h-8 w-8 border-transparent bg-transparent"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        aria-label={`Ações de ${game.title}`}
        onClick={() => setOpen((v) => !v)}
      >
        <FiMoreVertical aria-hidden="true" />
      </button>
      {open && (
        <div id={menuId} role="menu" aria-label={`Ações de ${game.title}`} className={`menu-pop ${placement}`}>
          <Link role="menuitem" to={`/jogos/${game.id}`} className="menu-item" onClick={close}>
            <FiEye aria-hidden="true" /> Ver detalhes
          </Link>
          <Link role="menuitem" to={`/jogos/${game.id}/editar`} className="menu-item" onClick={close}>
            <FiEdit2 aria-hidden="true" /> Editar
          </Link>
          <button
            role="menuitem"
            type="button"
            className="menu-item is-danger"
            onClick={() => {
              close();
              setConfirming(true);
            }}
          >
            <FiTrash2 aria-hidden="true" /> Excluir
          </button>
        </div>
      )}
      <ConfirmDialog
        open={confirming}
        title={`Excluir ${game.title}?`}
        confirmLabel="Excluir jogo"
        busy={remove.isPending}
        onConfirm={() => remove.mutate()}
        onCancel={() => setConfirming(false)}
      >
        O jogo, as imagens enviadas, as sessões do diário e o histórico de preços dele serão apagados. Não dá para desfazer.
      </ConfirmDialog>
    </div>
  );
}

/** Cartão de jogo da grade: a capa é o centro visual; ações ficam fora do link. */
export default function GameCard({ game, showPlatform = true, actions = true }) {
  const wish = game.ownershipStatus === 'WISHLIST';
  return (
    <article className={`game-card ${game.isFeatured ? 'is-featured' : ''}`}>
      <div className="panel">
        <div className="panel-body flex flex-col">
          <Link
            to={`/jogos/${game.id}`}
            className="group block no-underline focus-visible:outline-offset-[-2px]"
            aria-label={`${game.title}${showPlatform ? `, ${game.platform.name}` : ''}${game.isFeatured ? ', em destaque' : ''}`}
          >
            <div className="relative">
              <CoverImage src={game.coverUrl} title={game.title} platform={game.platform.name} ratio="aspect-[11/10]" />
              <span className="cover-shade" aria-hidden="true" />
              {game.isFeatured && (
                <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-md bg-amber px-2 py-0.5 text-xs font-semibold text-[#1c1102]">
                  <FiAward aria-hidden="true" /> Destaque
                </span>
              )}
              {wish && (
                <span className="absolute bottom-2 left-2 rounded-md bg-magenta px-2 py-0.5 text-xs font-semibold text-[#22030f]">Desejado</span>
              )}
            </div>
            <div className="px-3 pb-0.5 pt-2">
              <h3 className="line-clamp-1 font-sans text-[0.92rem] font-medium leading-snug text-ink group-hover:text-cyan" title={game.title}>
                {game.title}
              </h3>
              <p className="flex min-w-0 items-center gap-2 text-[0.8rem] text-ink/85">
                {!wish && <span className="shrink-0">{formatHours(game.playTimeMinutes)}</span>}
                {showPlatform && <span className="truncate text-muted">{game.platform.name}</span>}
                {!wish && game.mediaType && <span className="hidden shrink-0 text-faint @5xl:inline">{mediaLabel(game.mediaType)}</span>}
              </p>
              {game.needsReview && (
                <p className="mt-1 flex items-center gap-1 text-xs text-amber">
                  <FiAlertCircle aria-hidden="true" /> Completar dados da compra
                </p>
              )}
            </div>
          </Link>
          <div className={`mt-auto flex min-h-8 items-center gap-2 pb-1.5 pl-3 ${actions ? 'pr-10' : 'pr-3'}`}>
            {wish ? (
              <span className="min-w-0 truncate text-xs">
                {game.currentWishPrice ? (
                  <>
                    <span className="num text-sm text-ink">{formatMoney(game.currentWishPrice)}</span>{' '}
                    <span className="text-faint">em {formatDate(game.wishPriceUpdatedAt)}</span>
                  </>
                ) : (
                  <span className="text-faint">Sem preço atual</span>
                )}
              </span>
            ) : (
              <StatusBadge status={game.playStatus} />
            )}
          </div>
        </div>
      </div>
      {/* Fora do painel: o overflow da capa arredondada não corta o menu suspenso */}
      {actions && (
        <>
          <div className="absolute right-1.5 top-1.5">
            <FavoriteButton game={game} />
          </div>
          <div className="absolute bottom-0.5 right-1">
            <GameMenu game={game} />
          </div>
        </>
      )}
    </article>
  );
}

/**
 * Grade responsiva pela largura do contêiner (não da tela): 2 colunas no celular,
 * até 5 quando o espaço central permite, sem forçar colunas que não cabem.
 */
export function GameGrid({ games, showPlatform = true }) {
  return (
    <ul className="grid list-none grid-cols-2 gap-3 p-0 sm:gap-4 @lg:grid-cols-3 @2xl:grid-cols-4 @4xl:grid-cols-5 @7xl:grid-cols-6">
      {games.map((game) => (
        <li key={game.id} className="min-w-0">
          <GameCard game={game} showPlatform={showPlatform} />
        </li>
      ))}
    </ul>
  );
}

/** Lista compacta (alternativa à grade): mesmos dados e ações, uma linha por jogo. */
export function GameList({ games, showPlatform = true }) {
  return (
    <ul className="grid list-none gap-2 p-0">
      {games.map((game) => {
        const wish = game.ownershipStatus === 'WISHLIST';
        return (
          <li key={game.id} className={`game-card ${game.isFeatured ? 'is-featured' : ''}`}>
            <div className="panel">
              <div className="panel-body grid grid-cols-[3rem_minmax(0,1fr)_4.5rem] items-center gap-3 p-2 sm:grid-cols-[3rem_minmax(0,1.6fr)_minmax(0,1fr)_4.5rem]">
                <Link to={`/jogos/${game.id}`} tabIndex={-1} aria-hidden="true">
                  <CoverImage src={game.coverUrl} title={game.title} />
                </Link>
                <div className="min-w-0">
                  <Link to={`/jogos/${game.id}`} className="block truncate font-semibold text-ink no-underline hover:text-cyan">
                    {game.title}
                    {game.isFeatured && <FiAward aria-label="em destaque" className="ml-1.5 inline text-amber" />}
                  </Link>
                  <p className="truncate text-xs text-muted">
                    {showPlatform && game.platform.name}
                    {!wish && game.mediaType && <span className="text-faint"> · {mediaLabel(game.mediaType)}</span>}
                    {game.store && <span className="text-faint"> · {game.store.name}</span>}
                  </p>
                </div>
                <div className="col-span-3 row-start-2 flex flex-wrap items-center gap-x-4 gap-y-1 pl-[3.75rem] sm:col-span-1 sm:row-start-auto sm:pl-0">
                  {wish ? (
                    <span className="num text-sm text-ink">{game.currentWishPrice ? formatMoney(game.currentWishPrice) : '—'}</span>
                  ) : (
                    <>
                      <StatusBadge status={game.playStatus} />
                      <span className="num text-xs text-violet">{formatHours(game.playTimeMinutes)}</span>
                      <StarRating value={game.ratingStars} size="text-xs" />
                      {game.paidPrice && <span className="num text-xs text-muted">{formatMoney(game.paidPrice)}</span>}
                    </>
                  )}
                </div>
                <span aria-hidden="true" />
              </div>
            </div>
            <div className="absolute right-2 top-2.5 flex items-center gap-1">
              <FavoriteButton game={game} className="heart-btn h-8 w-8" />
              <GameMenu game={game} placement="right-0 top-full mt-1" />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
