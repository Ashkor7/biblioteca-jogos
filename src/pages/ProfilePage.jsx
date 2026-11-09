import { Link } from 'react-router';
import {
  FiEdit2,
  FiEye,
  FiPackage,
  FiFlag,
  FiPlay,
  FiPause,
  FiXCircle,
  FiClock,
  FiGlobe,
  FiAward,
  FiPieChart,
  FiLock,
} from 'react-icons/fi';
import { useProfile, useProfileStats, useFavorites, useAchievements, useActivities } from '../hooks/queries.js';
import ProfileHero from '../components/ProfileHero.jsx';
import StatTile, { StatGrid } from '../components/StatTile.jsx';
import SectionTitle from '../components/SectionTitle.jsx';
import GameTile, { TileGrid } from '../components/GameTile.jsx';
import AchievementCard from '../components/AchievementCard.jsx';
import ActivityFeed from '../components/ActivityFeed.jsx';
import FavoritesManager from '../components/FavoritesManager.jsx';
import { LoadingState, ErrorState } from '../components/States.jsx';
import { formatHours, formatMoney, formatPercent } from '../utils/format.js';
import { LIMITS } from '../../shared/domain.js';

export default function ProfilePage() {
  const profile = useProfile();
  if (profile.isPending) return <LoadingState label="Carregando perfil…" />;
  if (profile.isError) return <ErrorState error={profile.error} onRetry={profile.refetch} />;
  const p = profile.data;
  return (
    <div className="page-enter space-y-10">
      <ProfileHero
        profile={p}
        progress={p.progress}
        actions={
          <>
            <Link to="/configuracoes" className="btn btn-primary btn-sm">
              <FiEdit2 aria-hidden="true" /> Editar perfil
            </Link>
            <Link to="/configuracoes/previa" className="btn btn-ghost btn-sm">
              <FiEye aria-hidden="true" /> Ver como visitante
            </Link>
          </>
        }
      />
      <FavoritesHeader />
      <ProfileStats />
      <div className="grid gap-10 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <RecentAchievements />
        <section aria-labelledby="atividades-recentes">
          <SectionTitle
            id="atividades-recentes"
            title="Atividades recentes"
            accent="violet"
            action={
              <Link to="/atividades" className="text-sm">
                Histórico completo
              </Link>
            }
          />
          <RecentActivity />
        </section>
      </div>
      <section aria-labelledby="gerenciar-favoritos">
        <SectionTitle id="gerenciar-favoritos" title="Todos os favoritos" accent="amber">
          Ordene, escolha quais aparecem no perfil e remova. O jogo “em destaque” continua separado.
        </SectionTitle>
        <FavoritesManager />
      </section>
    </div>
  );
}

function FavoritesHeader() {
  const favorites = useFavorites();
  const shown = favorites.data?.items.filter((f) => f.showOnProfile).slice(0, LIMITS.favoritesOnProfileHeader) ?? [];
  if (!shown.length) return null;
  return (
    <section aria-labelledby="favoritos">
      <SectionTitle id="favoritos" title="Jogos favoritos" accent="amber" />
      <TileGrid label="Jogos favoritos">
        {shown.map((g) => (
          <li key={g.id}>
            <GameTile game={g} to={`/jogos/${g.id}`} showStatus={g.ownershipStatus === 'OWNED'} />
          </li>
        ))}
      </TileGrid>
    </section>
  );
}

function ProfileStats() {
  const stats = useProfileStats();
  if (stats.isPending) return <LoadingState label="Calculando estatísticas…" />;
  if (stats.isError) return <ErrorState error={stats.error} onRetry={stats.refetch} />;
  const s = stats.data;
  const savings = Number(s.finance.savings);
  return (
    <>
      <section aria-labelledby="estatisticas-perfil">
        <SectionTitle id="estatisticas-perfil" title="Estatísticas do jogador" />
        <StatGrid label="Estatísticas do jogador" className="grid-cols-2 sm:grid-cols-3 xl:grid-cols-5">
          <StatTile icon={FiPackage} label="Jogos adquiridos" value={s.library.owned} />
          <StatTile icon={FiFlag} label="Zerados" value={s.library.completed} tone="text-ok" />
          <StatTile icon={FiPlay} label="Jogando" value={s.library.playing} tone="text-blue" />
          <StatTile icon={FiPause} label="Não iniciados" value={s.library.notStarted} />
          <StatTile icon={FiXCircle} label="Abandonados" value={s.library.abandoned} tone="text-danger" />
          <StatTile icon={FiClock} label="Horas jogadas" value={formatHours(s.playTime.totalMinutes)} />
          <StatTile icon={FiGlobe} label="Plataformas" value={s.platforms} />
          <StatTile icon={FiAward} label="Conquistas" value={`${s.achievements.unlocked}/${s.achievements.total}`} tone="text-amber" />
          <StatTile icon={FiPieChart} label="Coleção concluída" value={formatPercent(s.library.completionPercent)} note="zerados ÷ adquiridos" />
        </StatGrid>
      </section>

      <section aria-labelledby="financeiro-perfil">
        <SectionTitle
          id="financeiro-perfil"
          title="Finanças"
          accent="amber"
          action={
            <span className="inline-flex items-center gap-1.5 text-xs text-muted">
              <FiLock aria-hidden="true" /> Área privada
            </span>
          }
        >
          Só jogos adquiridos com preço original e pago. “Valor original” é a soma dos preços de referência informados — não é o
          valor de mercado atual da coleção.
        </SectionTitle>
        <StatGrid label="Finanças">
          <StatTile label="Valor original (referência)" value={formatMoney(s.finance.originalTotal)} />
          <StatTile label="Total efetivamente pago" value={formatMoney(s.finance.paidTotal)} />
          <StatTile
            label={savings >= 0 ? 'Economia líquida' : 'Gasto acima da referência'}
            value={formatMoney(Math.abs(savings))}
            tone={savings >= 0 ? 'text-ok' : 'text-amber'}
          />
          <StatTile label="Desconto obtido" value={formatPercent(s.finance.discountPercent)} note="economia ÷ valor original" />
        </StatGrid>
        <div className="mt-5 grid gap-5 md:grid-cols-2">
          <StoreList title="Onde mais comprei" items={s.stores.byCount} metric={(st) => `${st.games} ${st.games === 1 ? 'compra' : 'compras'}`} />
          <StoreList title="Onde mais economizei" items={s.stores.bySavings} metric={(st) => formatMoney(st.savings)} />
        </div>
        <p className="mt-3 text-sm">
          <Link to="/estatisticas#financeiro">Abrir o dashboard financeiro completo</Link>
        </p>
      </section>
    </>
  );
}

function StoreList({ title, items, metric }) {
  return (
    <div className="panel">
      <div className="panel-body p-4">
        <h3 className="mb-2 text-base text-muted">{title}</h3>
        {items.length === 0 ? (
          <p className="text-sm text-faint">Sem dados ainda.</p>
        ) : (
          <ol className="list-none p-0">
            {items.map((st, i) => (
              <li key={st.id} className="readout">
                <span className="min-w-0 truncate">
                  <span className="num mr-2 text-faint">{i + 1}.</span>
                  {st.name}
                </span>
                <span className="num shrink-0 text-sm">{metric(st)}</span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}

function RecentAchievements() {
  const achievements = useAchievements();
  const recent = (achievements.data?.items ?? [])
    .filter((a) => a.unlocked)
    .sort((a, b) => new Date(b.unlockedAt) - new Date(a.unlockedAt))
    .slice(0, 4);
  return (
    <section aria-labelledby="conquistas-recentes">
      <SectionTitle
        id="conquistas-recentes"
        title="Conquistas recentes"
        accent="amber"
        action={
          <Link to="/conquistas" className="text-sm">
            Ver todas
          </Link>
        }
      />
      {achievements.isPending ? (
        <LoadingState />
      ) : achievements.isError ? (
        <ErrorState error={achievements.error} onRetry={achievements.refetch} />
      ) : recent.length === 0 ? (
        <p className="text-sm text-faint">Nenhuma conquista ainda. Cadastre e zere jogos para começar.</p>
      ) : (
        <ul className="grid list-none gap-3 p-0 sm:grid-cols-2">
          {recent.map((a) => (
            <li key={a.code}>
              <AchievementCard achievement={a} compact />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function RecentActivity({ pageSize = 8 }) {
  const activities = useActivities({ pageSize });
  if (activities.isPending) return <LoadingState />;
  if (activities.isError) return <ErrorState error={activities.error} onRetry={activities.refetch} />;
  return <ActivityFeed items={activities.data.items} />;
}
