import { Link } from 'react-router';
import CoverImage from './CoverImage.jsx';
import StatusBadge from './StatusBadge.jsx';
import { StarRating } from './StarRating.jsx';
import { formatHours } from '../utils/format.js';

/**
 * Capa compacta com nome, plataforma e nota. Sem `to`, não é link (perfil público
 * não abre a página administrativa do jogo).
 */
export default function GameTile({ game, to, showStatus = false, showHours = false, badge }) {
  const body = (
    <>
      <div className="tile-cover relative">
        <CoverImage src={game.coverUrl} title={game.title} platform={game.platform?.name} />
        {badge && <span className="absolute left-0 top-0">{badge}</span>}
      </div>
      <div className="mt-2 min-w-0">
        <p className="line-clamp-2 text-sm font-semibold leading-snug">{game.title}</p>
        <p className="truncate text-xs text-muted">{game.platform?.name}</p>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
          {game.ratingStars ? <StarRating value={game.ratingStars} size="text-xs" /> : null}
          {showStatus && game.playStatus && <StatusBadge status={game.playStatus} />}
          {showHours && game.playTimeMinutes > 0 && <span className="num text-xs text-faint">{formatHours(game.playTimeMinutes)}</span>}
        </div>
      </div>
    </>
  );
  return to ? (
    <Link to={to} className="tile-link" aria-label={`${game.title}, ${game.platform?.name ?? ''}`}>
      {body}
    </Link>
  ) : (
    <div>{body}</div>
  );
}

export function TileGrid({ children, label, cols = 'grid-cols-3 sm:grid-cols-4 lg:grid-cols-6' }) {
  return (
    <ul aria-label={label} className={`grid list-none gap-3 p-0 sm:gap-4 ${cols}`}>
      {children}
    </ul>
  );
}
