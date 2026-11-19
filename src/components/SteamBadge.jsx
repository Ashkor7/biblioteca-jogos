import { FaSteam } from 'react-icons/fa';

/**
 * Selo discreto "Steam" para jogos ligados a um app da Steam. Com link (padrão),
 * abre a página da loja em nova aba; dentro de outro link use link={false}.
 */
export default function SteamBadge({ game, link = true, className = '' }) {
  if (!game?.steam && game?.source !== 'STEAM') return null;
  const url = game.steam?.storeUrl;
  const content = (
    <>
      <FaSteam aria-hidden="true" /> Steam
    </>
  );
  if (link && url) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className={`steam-badge ${className}`}
        title="Abrir na loja Steam (nova aba)"
        aria-label={`${game.title} na loja Steam (abre em nova aba)`}
      >
        {content}
      </a>
    );
  }
  return (
    <span className={`steam-badge ${className}`} title="Importado da Steam">
      {content}
    </span>
  );
}
