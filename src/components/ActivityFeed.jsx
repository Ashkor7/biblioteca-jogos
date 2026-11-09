import { Link } from 'react-router';
import { describeActivity, timeAgo } from '../utils/activity.js';
import { FiActivity } from 'react-icons/fi';
import { ACTIVITY_ICONS, ACTIVITY_TONE } from '../utils/hubIcons.js';

/** Linha do tempo. Eventos retroativos ficam marcados (não aconteceram na data mostrada). */
export default function ActivityFeed({ items, linkGames = true, emptyText = 'Nenhuma atividade ainda.' }) {
  if (!items?.length) return <p className="text-sm text-faint">{emptyText}</p>;
  return (
    <ol className="relative list-none space-y-0 p-0">
      {items.map((a, i) => {
        const Icon = ACTIVITY_ICONS[a.type] ?? FiActivity;
        const text = describeActivity(a);
        return (
          <li key={a.id ?? `${a.type}-${i}`} className="relative flex gap-3 pb-4 last:pb-0">
            {i < items.length - 1 && <span aria-hidden="true" className="absolute left-[0.95rem] top-8 bottom-0 w-px bg-line" />}
            <span
              aria-hidden="true"
              className={`flex h-8 w-8 shrink-0 items-center justify-center border border-line-strong bg-panel-2 ${ACTIVITY_TONE[a.type] ?? 'text-cyan'}`}
            >
              <Icon />
            </span>
            <div className="min-w-0 pt-0.5">
              <p className="text-sm leading-snug">
                {linkGames && a.gameId ? (
                  <Link to={`/jogos/${a.gameId}`} className="text-ink no-underline hover:text-cyan">
                    {text}
                  </Link>
                ) : (
                  text
                )}
              </p>
              <p className="text-xs text-faint">
                {a.label}
                {' · '}
                {a.retroactive ? (
                  <span title={new Date(a.occurredAt).toLocaleString('pt-BR')}>registrado retroativamente</span>
                ) : (
                  <time dateTime={a.occurredAt} title={new Date(a.occurredAt).toLocaleString('pt-BR')}>
                    {timeAgo(a.occurredAt)}
                  </time>
                )}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
