import { useState } from 'react';
import { Link } from 'react-router';
import { FiBookOpen, FiCheckCircle, FiHeart, FiClock, FiLock, FiArrowRight, FiPlay, FiActivity } from 'react-icons/fi';
import { useActivities, useGames, useOverview } from '../hooks/queries.js';
import { Widget, ProgressRing } from './ContextRail.jsx';
import CoverImage from './CoverImage.jsx';
import SessionDialog from './SessionDialog.jsx';
import { formatHours, formatMoney, formatPercent } from '../utils/format.js';
import { describeActivity, timeAgo } from '../utils/activity.js';
import { ACTIVITY_ICONS, ACTIVITY_TONE } from '../utils/hubIcons.js';

function MoreLink({ to, children = 'Ver tudo' }) {
  return (
    <Link to={to} className="inline-flex items-center gap-1.5 text-cyan no-underline hover:underline">
      {children} <FiArrowRight aria-hidden="true" />
    </Link>
  );
}

function WidgetLoading() {
  return <div className="loading-bar my-4" role="status" aria-label="Carregando" />;
}

function WidgetError({ query }) {
  return (
    <p role="alert" className="text-sm text-danger">
      Não foi possível carregar.{' '}
      <button type="button" className="underline" onClick={() => query.refetch()}>
        Tentar de novo
      </button>
    </p>
  );
}

function Kpi({ icon: Icon, value, label, tone = 'text-cyan' }) {
  return (
    <li className="flex items-center gap-3.5">
      <Icon aria-hidden="true" className={`shrink-0 text-[1.6rem] ${tone}`} style={{ filter: 'drop-shadow(0 0 4px currentColor)' }} />
      <div className="min-w-0 leading-tight">
        <p className="num text-[1.45rem] font-semibold text-cyan">{value}</p>
        <p className="text-xs text-ink/85">{label}</p>
      </div>
    </li>
  );
}

/** Resumo da biblioteca: contagens reais (só jogos adquiridos) e taxa de conclusão. */
export function LibraryStatsWidget() {
  const overview = useOverview();
  const favorites = useGames({ ownership: 'OWNED', favorite: 'true', pageSize: 1 });
  const lib = overview.data?.library;
  const rate = lib?.owned ? (lib.completed / lib.owned) * 100 : 0;
  return (
    <Widget title="Estatísticas" action={<MoreLink to="/estatisticas">Detalhes</MoreLink>}>
      {overview.isPending ? (
        <WidgetLoading />
      ) : overview.isError ? (
        <WidgetError query={overview} />
      ) : (
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
          <ul className="grid list-none gap-3.5 p-0">
            <Kpi icon={FiBookOpen} value={lib.owned} label="Total de jogos" tone="text-violet" />
            <Kpi icon={FiCheckCircle} value={lib.completed} label="Zerados" tone="text-violet" />
            <Kpi icon={FiHeart} value={favorites.data?.total ?? '—'} label="Favoritos" tone="text-neon-pink" />
            <Kpi icon={FiClock} value={formatHours(overview.data.playTime.totalMinutes)} label="Tempo total" tone="text-violet" />
          </ul>
          {lib.owned > 0 && <ProgressRing value={rate} label="Taxa de conclusão" />}
        </div>
      )}
    </Widget>
  );
}

/** Jogos no estado "Jogando" (o estado é definido pelo usuário em cada jogo). */
export function NowPlayingWidget({ limit = 2 }) {
  const playing = useGames({ ownership: 'OWNED', status: 'PLAYING', sort: 'hours', pageSize: limit });
  const [logging, setLogging] = useState(null);
  const extra = playing.data ? playing.data.total - playing.data.items.length : 0;
  return (
    <Widget title="Jogando agora" footer={extra > 0 && <MoreLink to="/biblioteca?status=PLAYING">Mais {extra} jogando</MoreLink>}>
      {playing.isPending ? (
        <WidgetLoading />
      ) : playing.isError ? (
        <WidgetError query={playing} />
      ) : playing.data.items.length === 0 ? (
        <p className="text-sm text-muted">
          Nenhum jogo no estado “Jogando”. Mude o estado na edição de um jogo para ele aparecer aqui.
        </p>
      ) : (
        <ul className="grid list-none gap-4 p-0">
          {playing.data.items.map((g) => (
            <li key={g.id}>
              <div className="grid grid-cols-[4.75rem_minmax(0,1fr)] gap-3.5">
                <Link to={`/jogos/${g.id}`} tabIndex={-1} aria-hidden="true" className="tile-link">
                  <CoverImage src={g.coverUrl} title={g.title} className="tile-cover" ratio="aspect-square" />
                </Link>
                <div className="flex min-w-0 flex-col justify-center">
                  <Link to={`/jogos/${g.id}`} className="truncate font-display text-[1.05rem] font-semibold text-ink no-underline hover:text-cyan">
                    {g.title}
                  </Link>
                  <p className="truncate text-xs uppercase tracking-wide text-[#9fd8ff]">{g.platform.name}</p>
                </div>
              </div>
              <div className="mt-2.5 flex items-center justify-between gap-3">
                <span className="num text-sm text-ink">{formatHours(g.playTimeMinutes)}</span>
                {g.sessionMinutes > 0 && <span className="truncate text-xs text-muted">{formatHours(g.sessionMinutes)} no diário</span>}
                <button
                  type="button"
                  className="icon-ring h-9 w-9 text-cyan"
                  aria-label={`Registrar sessão de ${g.title}`}
                  title="Registrar sessão"
                  onClick={() => setLogging(g.id)}
                >
                  <FiPlay aria-hidden="true" className="fill-current" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {logging && <SessionDialog gameId={logging} onClose={() => setLogging(null)} />}
    </Widget>
  );
}

/**
 * Resumo financeiro privado. Total pago e economia só contam jogos adquiridos com
 * preço original E pago (mesma regra das estatísticas); o original é referência, não valor de mercado.
 */
export function FinanceWidget() {
  const overview = useOverview();
  const finance = overview.data?.finance;
  const savings = finance ? Number(finance.savings) : 0;
  return (
    <Widget
      title="Resumo financeiro"
      tone="accent"
      action={
        <span className="inline-flex items-center gap-1 text-muted">
          <FiLock aria-hidden="true" /> Privado
        </span>
      }
      footer={<MoreLink to="/estatisticas#financeiro">Dashboard financeiro</MoreLink>}
    >
      {overview.isPending ? (
        <WidgetLoading />
      ) : overview.isError ? (
        <WidgetError query={overview} />
      ) : (
        <>
          <dl className="grid gap-0 text-sm">
            <div className="readout">
              <dt className="text-muted">Total pago</dt>
              <dd className="num text-ink">{formatMoney(finance.paidTotal)}</dd>
            </div>
            <div className="readout">
              <dt className="text-muted">{savings >= 0 ? 'Economia' : 'Acima da referência'}</dt>
              <dd className={`num ${savings >= 0 ? 'text-ok' : 'text-amber'}`}>
                {formatMoney(Math.abs(savings))}
                {finance.discountPercent !== null && (
                  <span className="ml-1 text-xs text-faint">({formatPercent(finance.discountPercent)})</span>
                )}
              </dd>
            </div>
            <div className="readout">
              <dt className="text-muted">Valor original</dt>
              <dd className="num text-muted">{formatMoney(finance.originalTotal)}</dd>
            </div>
          </dl>
          <p className="mt-2 text-xs text-faint">
            Só jogos com preço original e pago informados.
            {finance.pendingPriceReview > 0 && (
              <>
                {' '}
                <span className="num text-amber">{finance.pendingPriceReview}</span> sem preços completos.
              </>
            )}
          </p>
        </>
      )}
    </Widget>
  );
}

/** Lista de desejos: quantidade e soma do último preço informado pelo usuário. */
export function WishlistWidget() {
  const overview = useOverview();
  const wish = overview.data?.wishlist;
  return (
    <Widget title="Lista de desejos" tone="accent" footer={<MoreLink to="/desejos">Ver lista</MoreLink>}>
      {overview.isPending ? (
        <WidgetLoading />
      ) : overview.isError ? (
        <WidgetError query={overview} />
      ) : wish.count === 0 ? (
        <p className="text-sm text-muted">Nenhum jogo desejado ainda.</p>
      ) : (
        <>
          <dl className="grid text-sm">
            <div className="readout">
              <dt className="text-muted">Jogos desejados</dt>
              <dd className="num text-magenta">{wish.count}</dd>
            </div>
            <div className="readout">
              <dt className="text-muted">Soma do último preço</dt>
              <dd className="num text-ink">{formatMoney(wish.currentValue)}</dd>
            </div>
          </dl>
          {wish.isPartial && (
            <p className="pt-2 text-xs text-faint">
              Parcial: <span className="num">{wish.withoutPrice}</span> sem preço informado.
            </p>
          )}
        </>
      )}
    </Widget>
  );
}

/** Últimos eventos reais do histórico (no lugar do "Amigos online" da referência). */
export function RecentActivityWidget({ limit = 4 }) {
  const activities = useActivities({ pageSize: limit });
  return (
    <Widget title="Atividade recente" footer={<MoreLink to="/atividades">Ver todas as atividades</MoreLink>}>
      {activities.isPending ? (
        <WidgetLoading />
      ) : activities.isError ? (
        <WidgetError query={activities} />
      ) : activities.data.items.length === 0 ? (
        <p className="text-sm text-muted">Nenhuma atividade ainda.</p>
      ) : (
        <ul className="grid list-none gap-3.5 p-0">
          {activities.data.items.map((a) => {
            const Icon = ACTIVITY_ICONS[a.type] ?? FiActivity;
            const text = describeActivity(a);
            return (
              <li key={a.id} className="flex items-center gap-3">
                <span className="avatar-frame h-10 w-10 shrink-0" aria-hidden="true">
                  <span className={`flex h-full w-full items-center justify-center bg-panel-2 text-base ${ACTIVITY_TONE[a.type] ?? 'text-cyan'}`}>
                    <Icon />
                  </span>
                </span>
                <div className="min-w-0">
                  {a.gameId ? (
                    <Link to={`/jogos/${a.gameId}`} className="line-clamp-1 text-sm font-semibold text-ink no-underline hover:text-cyan" title={text}>
                      {text}
                    </Link>
                  ) : (
                    <p className="line-clamp-1 text-sm font-semibold text-ink" title={text}>
                      {text}
                    </p>
                  )}
                  <p className="truncate text-xs text-[#9fd8ff]">
                    {a.label} · {a.retroactive ? 'retroativo' : timeAgo(a.occurredAt)}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Widget>
  );
}
