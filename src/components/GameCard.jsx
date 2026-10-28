import { Link } from 'react-router';
import { FiAward, FiAlertCircle } from 'react-icons/fi';
import CoverImage from './CoverImage.jsx';
import StatusBadge from './StatusBadge.jsx';
import { StarRating } from './StarRating.jsx';
import { formatMoney, formatDate, mediaLabel } from '../utils/format.js';

/** Cartão de jogo em formato de "cartucho": a capa é o centro visual. */
export default function GameCard({ game, showPlatform = true }) {
  const wish = game.ownershipStatus === 'WISHLIST';
  const frame = game.isFeatured
    ? 'bg-amber/80'
    : 'bg-line group-hover:bg-cyan/70 group-focus-visible:bg-cyan';

  return (
    <article>
      <Link
        to={`/jogos/${game.id}`}
        className="group block focus-visible:outline-offset-4"
        aria-label={`${game.title}${showPlatform ? `, ${game.platform.name}` : ''}${game.isFeatured ? ', em destaque' : ''}`}
      >
        <div className={`panel transition-colors ${frame}`}>
          <div className="panel-body flex flex-col">
            <div className="relative">
              <CoverImage src={game.coverUrl} title={game.title} platform={game.platform.name} />
              {game.isFeatured && (
                <span className="absolute left-0 top-0 inline-flex items-center gap-1 bg-amber px-2 py-0.5 text-xs font-semibold text-[#1c1102]">
                  <FiAward aria-hidden="true" /> Destaque
                </span>
              )}
              {wish && (
                <span className="absolute bottom-0 left-0 bg-magenta px-2 py-0.5 text-xs font-semibold text-[#22030f]">
                  Desejado
                </span>
              )}
            </div>
            <div className="flex flex-1 flex-col gap-1.5 p-3">
              <h3 className="line-clamp-2 text-[0.98rem] font-semibold leading-snug">{game.title}</h3>
              <p className="flex min-w-0 items-center gap-2 text-xs text-muted">
                {showPlatform && <span className="truncate">{game.platform.name}</span>}
                {!wish && game.mediaType && (
                  <span className="shrink-0 text-faint">{mediaLabel(game.mediaType)}</span>
                )}
              </p>
              <div className="mt-auto flex flex-wrap items-center justify-between gap-x-3 gap-y-1 pt-1">
                {wish ? (
                  <span className="text-xs">
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
                  <>
                    <StatusBadge status={game.playStatus} />
                    <StarRating value={game.ratingStars} size="text-xs" />
                  </>
                )}
              </div>
              {game.needsReview && (
                <p className="flex items-center gap-1 text-xs text-amber">
                  <FiAlertCircle aria-hidden="true" /> Completar dados da compra
                </p>
              )}
            </div>
          </div>
        </div>
      </Link>
    </article>
  );
}

export function GameGrid({ games, showPlatform = true }) {
  return (
    <ul className="grid list-none grid-cols-2 gap-3 p-0 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 xl:grid-cols-5">
      {games.map((game) => (
        <li key={game.id} className="min-w-0">
          <GameCard game={game} showPlatform={showPlatform} />
        </li>
      ))}
    </ul>
  );
}
