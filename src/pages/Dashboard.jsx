import { useState } from 'react';
import { Link } from 'react-router';
import { FiPlus, FiAward, FiClock, FiLock, FiBookOpen } from 'react-icons/fi';
import {
  useGames,
  useOverview,
  useProfile,
  useProfileStats,
  useFavorites,
  useAchievements,
  useActivities,
  useGoals,
} from '../hooks/queries.js';
import ProfileHero from '../components/ProfileHero.jsx';
import SectionTitle from '../components/SectionTitle.jsx';
import StatTile, { StatGrid } from '../components/StatTile.jsx';
import GameTile, { TileGrid } from '../components/GameTile.jsx';
import CoverImage from '../components/CoverImage.jsx';
import StatusBadge from '../components/StatusBadge.jsx';
import { StarRating } from '../components/StarRating.jsx';
import AchievementCard from '../components/AchievementCard.jsx';
import ActivityFeed from '../components/ActivityFeed.jsx';
import GoalCard from '../components/GoalCard.jsx';
import LibraryBrowser from '../components/LibraryBrowser.jsx';
import SessionDialog from '../components/SessionDialog.jsx';
import { LoadingState, ErrorState, EmptyState } from '../components/States.jsx';
import { formatHours, formatMoney, formatPercent } from '../utils/format.js';
import { LIMITS } from '../../shared/domain.js';

/**
 * Visão geral do jogador. Cada bloco busca só o que precisa (consultas pequenas,
 * em paralelo, com cache do TanStack Query) em vez de uma única consulta pesada.
 */
export default function Dashboard() {
  const overview = useOverview();
  const profile = useProfile();
  const [logging, setLogging] = useState(null);

  if (overview.isPending || profile.isPending) return <LoadingState label="Carregando painel…" />;
  if (overview.isError) return <ErrorState error={overview.error} onRetry={overview.refetch} />;
  if (profile.isError) return <ErrorState error={profile.error} onRetry={profile.refetch} />;

  const stats = overview.data;
  const totalGames = stats.library.owned + stats.wishlist.count;
  const actions = (
    <>
      <Link to="/jogos/novo" className="btn btn-primary btn-sm">
        <FiPlus aria-hidden="true" /> Adicionar jogo
      </Link>
      {stats.library.owned > 0 && (
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setLogging({})}>
          <FiClock aria-hidden="true" /> Registrar sessão
        </button>
      )}
    </>
  );

  return (
    <div className="page-enter space-y-10">
      <ProfileHero profile={profile.data} progress={profile.data.progress} actions={actions} compact />

      {totalGames === 0 ? (
        <EmptyState
          title="Nenhum jogo cadastrado ainda"
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Link to="/jogos/novo" className="btn btn-primary">
                <FiPlus aria-hidden="true" /> Adicionar o primeiro jogo
              </Link>
              <Link to="/importar" className="btn btn-ghost">
                Importar da versão antiga
              </Link>
            </div>
          }
        >
          Cadastre o primeiro jogo informando a plataforma (Xbox, Wii, Steam…). A página da plataforma aparece no menu
          automaticamente — e a primeira conquista também.
        </EmptyState>
      ) : (
        <>
          <PlayingNow onLog={(game) => setLogging({ gameId: game.id })} />
          <Spotlight />
          <div className="grid gap-10 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <section aria-labelledby="ultimas-atividades">
              <SectionTitle id="ultimas-atividades" title="Últimas atividades" accent="violet" action={<Link to="/atividades" className="text-sm">Ver tudo</Link>} />
              <RecentActivity />
            </section>
            <YearProgress />
          </div>
          <FavoritesRow />
          <RecentAchievements />
          <FinanceSummary stats={stats} />
          <section aria-labelledby="colecao">
            <SectionTitle
              id="colecao"
              title="Coleção"
              action={
                <Link to="/biblioteca" className="inline-flex items-center gap-1.5 text-sm">
                  <FiBookOpen aria-hidden="true" /> Filtros completos
                </Link>
              }
            />
            <LibraryBrowser compact pageSize={20} />
          </section>
        </>
      )}
      {logging && <SessionDialog gameId={logging.gameId} onClose={() => setLogging(null)} />}
    </div>
  );
}

function PlayingNow({ onLog }) {
  const playing = useGames({ ownership: 'OWNED', status: 'PLAYING', sort: 'recent', pageSize: 6 });
  return (
    <section aria-labelledby="jogando">
      <SectionTitle id="jogando" title="Jogando atualmente" accent="blue" action={<Link to="/diario" className="text-sm">Abrir diário</Link>} />
      {playing.isPending ? (
        <LoadingState />
      ) : playing.isError ? (
        <ErrorState error={playing.error} onRetry={playing.refetch} />
      ) : playing.data.items.length === 0 ? (
        <p className="text-sm text-faint">
          Nenhum jogo no estado “Jogando”. Mude o estado de um jogo na edição para ele aparecer aqui.
        </p>
      ) : (
        <ul className="grid list-none gap-3 p-0 sm:grid-cols-2 xl:grid-cols-3">
          {playing.data.items.map((g) => (
            <li key={g.id} className="panel">
              <div className="panel-body grid grid-cols-[4.5rem_1fr] gap-3 p-3">
                <Link to={`/jogos/${g.id}`} tabIndex={-1} aria-hidden="true">
                  <CoverImage src={g.coverUrl} title={g.title} platform={g.platform.name} />
                </Link>
                <div className="flex min-w-0 flex-col">
                  <Link to={`/jogos/${g.id}`} className="line-clamp-2 font-semibold text-ink no-underline hover:text-cyan">
                    {g.title}
                  </Link>
                  <p className="text-xs text-muted">{g.platform.name}</p>
                  <p className="num mt-1 text-sm text-violet">{formatHours(g.playTimeMinutes)}</p>
                  {g.sessionMinutes > 0 && <p className="text-xs text-faint">{formatHours(g.sessionMinutes)} no diário</p>}
                  <button type="button" className="btn btn-ghost btn-sm mt-auto self-start" onClick={() => onLog(g)}>
                    <FiClock aria-hidden="true" /> Registrar sessão
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** Destaque único herdado da versão antiga (diferente dos favoritos). */
function Spotlight() {
  const featured = useGames({ ownership: 'ALL', sort: 'featured', pageSize: 1 });
  const game = featured.data?.items[0]?.isFeatured ? featured.data.items[0] : null;
  if (!game) return null;
  return (
    <section aria-label="Jogo em destaque" className="panel panel-gold">
      <div className="panel-body grid grid-cols-[6.5rem_1fr] gap-4 p-3 sm:grid-cols-[9rem_1fr] sm:gap-6 sm:p-5">
        <Link to={`/jogos/${game.id}`} tabIndex={-1} aria-hidden="true">
          <CoverImage src={game.coverUrl} title={game.title} platform={game.platform.name} />
        </Link>
        <div className="flex min-w-0 flex-col">
          <p className="hud-label text-amber">
            <FiAward aria-hidden="true" /> Em destaque
          </p>
          <h2 className="mt-1 text-[clamp(1.35rem,3.2vw,2rem)] font-bold break-words">
            <Link to={`/jogos/${game.id}`} className="text-ink no-underline hover:text-cyan">
              {game.title}
            </Link>
          </h2>
          <p className="mt-1 text-sm text-muted">{game.platform.name}</p>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
            {game.ownershipStatus === 'OWNED' && <StatusBadge status={game.playStatus} />}
            <StarRating value={game.ratingStars} />
          </div>
          {game.reviewText && <p className="mt-3 line-clamp-2 max-w-[62ch] text-sm text-ink/90 sm:line-clamp-3">{game.reviewText}</p>}
        </div>
      </div>
    </section>
  );
}

function RecentActivity() {
  const activities = useActivities({ pageSize: 6 });
  if (activities.isPending) return <LoadingState />;
  if (activities.isError) return <ErrorState error={activities.error} onRetry={activities.refetch} />;
  return <ActivityFeed items={activities.data.items} />;
}

function YearProgress() {
  const stats = useProfileStats();
  const year = stats.data?.year;
  const goals = useGoals(year ? { year, status: 'ALL' } : {});
  const active = (goals.data?.items ?? []).filter((g) => g.status !== 'CLOSED').slice(0, 3);
  return (
    <section aria-labelledby="progresso-anual">
      <SectionTitle id="progresso-anual" title={`Progresso de ${year ?? 'este ano'}`} accent="violet" action={<Link to="/metas" className="text-sm">Metas</Link>} />
      {stats.data && (
        <StatGrid label="Resumo do ano" className="mb-3 grid-cols-2">
          <StatTile label="Zerados no ano" value={stats.data.completedThisYear} tone="text-ok" note="com data de conclusão registrada" />
          <StatTile label="Coleção concluída" value={formatPercent(stats.data.library.completionPercent)} note={`${stats.data.library.completed} de ${stats.data.library.owned}`} />
        </StatGrid>
      )}
      {goals.isPending ? (
        <LoadingState />
      ) : active.length === 0 ? (
        <p className="text-sm text-faint">
          Nenhuma meta para este ano. <Link to="/metas">Criar uma meta</Link>
        </p>
      ) : (
        <ul className="grid list-none gap-3 p-0">
          {active.map((g) => (
            <li key={g.id}>
              <GoalCard goal={g} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function FavoritesRow() {
  const favorites = useFavorites();
  const shown = favorites.data?.items.filter((f) => f.showOnProfile).slice(0, LIMITS.favoritesOnProfileHeader) ?? [];
  return (
    <section aria-labelledby="favoritos">
      <SectionTitle id="favoritos" title="Favoritos" accent="amber" action={<Link to="/perfil" className="text-sm">Gerenciar</Link>} />
      {favorites.isPending ? (
        <LoadingState />
      ) : shown.length === 0 ? (
        <p className="text-sm text-faint">Marque jogos como favoritos na página de cada jogo para destacá-los aqui e no perfil.</p>
      ) : (
        <TileGrid label="Favoritos">
          {shown.map((g) => (
            <li key={g.id}>
              <GameTile game={g} to={`/jogos/${g.id}`} />
            </li>
          ))}
        </TileGrid>
      )}
    </section>
  );
}

function RecentAchievements() {
  const achievements = useAchievements();
  const recent = (achievements.data?.items ?? [])
    .filter((a) => a.unlocked)
    .sort((a, b) => new Date(b.unlockedAt) - new Date(a.unlockedAt))
    .slice(0, 3);
  const next = (achievements.data?.items ?? [])
    .filter((a) => !a.unlocked)
    .sort((a, b) => b.percent - a.percent)
    .slice(0, 3);
  return (
    <section aria-labelledby="conquistas">
      <SectionTitle id="conquistas" title="Conquistas" accent="amber" action={<Link to="/conquistas" className="text-sm">Ver todas</Link>} />
      {achievements.isPending ? (
        <LoadingState />
      ) : achievements.isError ? (
        <ErrorState error={achievements.error} onRetry={achievements.refetch} />
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <div>
            <h3 className="mb-2 text-sm text-muted">Desbloqueadas recentemente</h3>
            {recent.length === 0 ? (
              <p className="text-sm text-faint">Nenhuma ainda.</p>
            ) : (
              <ul className="grid list-none gap-2 p-0">
                {recent.map((a) => (
                  <li key={a.code}>
                    <AchievementCard achievement={a} compact />
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <h3 className="mb-2 text-sm text-muted">Mais perto de desbloquear</h3>
            <ul className="grid list-none gap-2 p-0">
              {next.map((a) => (
                <li key={a.code}>
                  <AchievementCard achievement={a} compact />
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </section>
  );
}

function FinanceSummary({ stats }) {
  const savings = Number(stats.finance.savings);
  return (
    <section aria-labelledby="resumo-financeiro">
      <SectionTitle
        id="resumo-financeiro"
        title="Resumo financeiro"
        accent="amber"
        action={
          <span className="inline-flex items-center gap-3 text-sm">
            <span className="inline-flex items-center gap-1 text-xs text-muted">
              <FiLock aria-hidden="true" /> Privado
            </span>
            <Link to="/estatisticas#financeiro">Dashboard financeiro</Link>
          </span>
        }
      />
      <StatGrid label="Resumo financeiro" className="grid-cols-2 lg:grid-cols-4">
        <StatTile label="Total pago" value={formatMoney(stats.finance.paidTotal)} />
        <StatTile
          label={savings >= 0 ? 'Economia acumulada' : 'Gasto acima da referência'}
          value={formatMoney(Math.abs(savings))}
          tone={savings >= 0 ? 'text-ok' : 'text-amber'}
          note={stats.finance.discountPercent !== null ? `${formatPercent(stats.finance.discountPercent)} de desconto` : undefined}
        />
        <StatTile label="Valor original (referência)" value={formatMoney(stats.finance.originalTotal)} note="não é valor de mercado" />
        <StatTile label="Lista de desejos" value={formatMoney(stats.wishlist.currentValue)} tone="text-magenta" note={stats.wishlist.isPartial ? 'parcial: há itens sem preço' : 'último preço informado'} />
      </StatGrid>
    </section>
  );
}
