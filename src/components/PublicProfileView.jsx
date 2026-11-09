import { useState } from 'react';
import { Link } from 'react-router';
import { FiFolder } from 'react-icons/fi';
import ProfileHero from './ProfileHero.jsx';
import StatTile, { StatGrid } from './StatTile.jsx';
import SectionTitle from './SectionTitle.jsx';
import GameTile, { TileGrid } from './GameTile.jsx';
import AchievementCard from './AchievementCard.jsx';
import ActivityFeed from './ActivityFeed.jsx';
import Pagination from './Pagination.jsx';
import { LoadingState, ErrorState } from './States.jsx';
import { usePublicGames } from '../hooks/queries.js';
import { formatHours, formatMoney, formatPercent } from '../utils/format.js';

/**
 * O que um visitante vê. Recebe exatamente o JSON do servidor (seções ausentes
 * foram ocultadas pelo dono) — este componente não decide privacidade.
 * `preview` = prévia do dono: sem paginação ao vivo e sem links.
 */
export default function PublicProfileView({ view, preview = false }) {
  const s = view.sections;
  const progress = { level: view.level, percent: view.progressPercent, totalXp: 0, nextLevelXp: null, xpForNext: 0 };
  return (
    <div className="page-enter space-y-10">
      <ProfileHero profile={view} progress={null} />
      <p className="-mt-6 flex items-center gap-3 text-sm text-violet">
        Nível <span className="num text-lg">{progress.level}</span>
        <span className="xp-track inline-block w-40" aria-hidden="true">
          <span className="xp-fill block" style={{ width: `${progress.percent}%` }} />
        </span>
      </p>

      {s.playStats && (
        <section aria-labelledby="pub-stats">
          <SectionTitle id="pub-stats" title="Estatísticas" />
          <StatGrid label="Estatísticas de jogatina">
            <StatTile label="Jogos na coleção" value={s.playStats.owned} />
            <StatTile label="Zerados" value={s.playStats.completed} tone="text-ok" />
            <StatTile label="Jogando" value={s.playStats.playing} tone="text-blue" />
            <StatTile label="Horas jogadas" value={formatHours(s.playStats.totalMinutes)} />
            <StatTile label="Plataformas" value={s.playStats.platforms} />
            <StatTile label="Conquistas" value={s.playStats.achievementsUnlocked} tone="text-amber" />
            <StatTile label="Coleção concluída" value={formatPercent(s.playStats.completionPercent)} />
            <StatTile label="Não iniciados" value={s.playStats.notStarted} />
          </StatGrid>
        </section>
      )}

      {s.finance && Object.keys(s.finance).length > 0 && (
        <section aria-labelledby="pub-fin">
          <SectionTitle id="pub-fin" title="Compras" accent="amber">
            Valor original é a soma dos preços de referência informados, não o valor de mercado da coleção.
          </SectionTitle>
          <StatGrid label="Valores da coleção">
            {s.finance.originalTotal && <StatTile label="Valor original (referência)" value={formatMoney(s.finance.originalTotal)} />}
            {s.finance.paidTotal && <StatTile label="Total pago" value={formatMoney(s.finance.paidTotal)} />}
            {s.finance.savings && (
              <StatTile
                label="Economia acumulada"
                value={formatMoney(s.finance.savings)}
                tone={Number(s.finance.savings) >= 0 ? 'text-ok' : 'text-amber'}
                note={s.finance.discountPercent !== null ? `${formatPercent(s.finance.discountPercent)} de desconto` : undefined}
              />
            )}
          </StatGrid>
        </section>
      )}

      {s.favorites?.length > 0 && (
        <section aria-labelledby="pub-fav">
          <SectionTitle id="pub-fav" title="Jogos favoritos" accent="amber" />
          <TileGrid label="Jogos favoritos">
            {s.favorites.map((g) => (
              <li key={g.id}>
                <GameTile game={g} showStatus />
              </li>
            ))}
          </TileGrid>
        </section>
      )}

      {s.achievements?.length > 0 && (
        <section aria-labelledby="pub-ach">
          <SectionTitle id="pub-ach" title="Conquistas" accent="amber" />
          <ul className="grid list-none gap-3 p-0 sm:grid-cols-2 lg:grid-cols-3">
            {s.achievements.map((a) => (
              <li key={a.code}>
                <AchievementCard achievement={a} compact />
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="grid gap-10 lg:grid-cols-2">
        {s.activity && (
          <section aria-labelledby="pub-act">
            <SectionTitle id="pub-act" title="Atividades recentes" accent="violet" />
            <ActivityFeed items={s.activity} linkGames={false} />
          </section>
        )}
        {s.storeRanking?.length > 0 && (
          <section aria-labelledby="pub-stores">
            <SectionTitle id="pub-stores" title="Lojas mais usadas" />
            <ol className="list-none space-y-2 p-0">
              {s.storeRanking.map((store, i) => (
                <li key={store.name} className="readout">
                  <span>
                    <span className="num mr-2 text-faint">{i + 1}.</span>
                    {store.name}
                  </span>
                  <span className="num text-sm text-muted">
                    {store.purchases} {store.purchases === 1 ? 'compra' : 'compras'}
                    {store.savings && ` · economia ${formatMoney(store.savings)}`}
                  </span>
                </li>
              ))}
            </ol>
          </section>
        )}
      </div>

      {s.collections?.length > 0 && (
        <section aria-labelledby="pub-col">
          <SectionTitle id="pub-col" title="Coleções" />
          <ul className="grid list-none gap-3 p-0 sm:grid-cols-2 lg:grid-cols-3">
            {s.collections.map((c) => (
              <li key={c.id}>
                <CollectionCard collection={c} to={preview ? null : `/u/${view.username}/colecoes/${c.id}`} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {s.library && <GamesSection view={view} kind="library" title="Biblioteca" initial={s.library} preview={preview} />}
      {s.wishlist && <GamesSection view={view} kind="wishlist" title="Lista de desejos" initial={s.wishlist} preview={preview} accent="magenta" />}
    </div>
  );
}

function CollectionCard({ collection: c, to }) {
  const body = (
    <div className="panel h-full">
      <div className="panel-body flex h-full gap-3 p-3">
        <div className="h-20 w-16 shrink-0 overflow-hidden bg-panel-3">
          {c.coverUrl ? (
            <img src={c.coverUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
          ) : (
            <div className="flex h-full items-center justify-center text-faint">
              <FiFolder aria-hidden="true" />
            </div>
          )}
        </div>
        <div className="min-w-0">
          <h3 className="text-base font-semibold">{c.name}</h3>
          <p className="num text-xs text-muted">
            {c.gameCount} {c.gameCount === 1 ? 'jogo' : 'jogos'}
          </p>
          {c.description && <p className="mt-1 line-clamp-2 text-sm text-muted">{c.description}</p>}
        </div>
      </div>
    </div>
  );
  return to ? (
    <Link to={to} className="tile-link">
      {body}
    </Link>
  ) : (
    body
  );
}

function GamesSection({ view, kind, title, initial, preview, accent = 'cyan' }) {
  const [page, setPage] = useState(1);
  const live = usePublicGames(view.username, kind, page, { enabled: !preview && page > 1 });
  const data = page === 1 || preview ? initial : live.data;
  return (
    <section aria-labelledby={`pub-${kind}`}>
      <SectionTitle id={`pub-${kind}`} title={title} accent={accent}>
        <span className="num">{initial.total}</span> {initial.total === 1 ? 'jogo' : 'jogos'}
        {preview && initial.totalPages > 1 && ' · a prévia mostra só a primeira página'}
      </SectionTitle>
      {live.isError ? (
        <ErrorState error={live.error} onRetry={live.refetch} />
      ) : !data ? (
        <LoadingState />
      ) : data.items.length === 0 ? (
        <p className="text-sm text-faint">Nada por aqui ainda.</p>
      ) : (
        <>
          <TileGrid label={title}>
            {data.items.map((g) => (
              <li key={g.id}>
                <GameTile game={g} showStatus={kind === 'library'} />
              </li>
            ))}
          </TileGrid>
          {!preview && <Pagination page={data.page} totalPages={data.totalPages} total={data.total} onPage={setPage} />}
        </>
      )}
    </section>
  );
}
