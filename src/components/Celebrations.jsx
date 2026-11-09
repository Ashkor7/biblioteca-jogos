import { useEffect, useRef, useState } from 'react';
import { FiAward, FiChevronsUp, FiTarget, FiX } from 'react-icons/fi';
import { api } from '../services/api.js';
import { useNotifications } from '../hooks/queries.js';
import { useAuth } from '../hooks/useAuth.js';
import { describeActivity } from '../utils/activity.js';

const STYLE = {
  ACHIEVEMENT_UNLOCKED: { icon: FiAward, title: 'Conquista desbloqueada', tone: 'text-amber', border: 'border-amber/60' },
  LEVEL_UP: { icon: FiChevronsUp, title: 'Subiu de nível', tone: 'text-violet', border: 'border-violet/60' },
  GOAL_COMPLETED: { icon: FiTarget, title: 'Meta concluída', tone: 'text-violet', border: 'border-violet/60' },
};

/**
 * Avisos de conquista, nível e meta. Vêm do servidor (só eventos novos, nunca os
 * retroativos) e são confirmados lá: recarregar a página não repete o aviso.
 * Não bloqueiam nada e somem sozinhos.
 */
export default function Celebrations() {
  const { user } = useAuth();
  const notifications = useNotifications({ enabled: Boolean(user) });
  const [shown, setShown] = useState([]);
  const acked = useRef(new Set());

  useEffect(() => {
    const items = notifications.data?.items ?? [];
    const fresh = items.filter((n) => !acked.current.has(n.id));
    if (!fresh.length) return;
    for (const n of fresh) acked.current.add(n.id);
    setShown((list) => [...list, ...fresh].slice(-4));
    api.ackNotifications(fresh.at(-1).occurredAt).catch(() => {});
  }, [notifications.data]);

  useEffect(() => {
    if (!shown.length) return;
    const timer = setTimeout(() => setShown((list) => list.slice(1)), 6500);
    return () => clearTimeout(timer);
  }, [shown]);

  if (!shown.length) return null;
  return (
    <div aria-live="polite" className="pointer-events-none fixed inset-x-0 top-3 z-50 flex flex-col items-center gap-2 px-4 sm:items-end">
      {shown.map((n) => {
        const s = STYLE[n.type] ?? STYLE.ACHIEVEMENT_UNLOCKED;
        const Icon = s.icon;
        return (
          <div
            key={n.id}
            role="status"
            className={`unlock-card pointer-events-auto flex w-full max-w-sm items-start gap-3 border ${s.border} bg-panel-2/95 px-4 py-3 shadow-lg shadow-black/50 backdrop-blur`}
          >
            <span aria-hidden="true" className={`mt-0.5 text-xl ${s.tone}`}>
              <Icon />
            </span>
            <div className="min-w-0 flex-1">
              <p className={`font-display text-sm font-semibold ${s.tone}`}>{s.title}</p>
              <p className="text-sm">{describeActivity(n)}</p>
              {n.data?.xp ? <p className="num text-xs text-violet">+{n.data.xp} XP</p> : null}
            </div>
            <button
              type="button"
              className="-m-1 p-1 text-muted hover:text-ink"
              aria-label="Fechar aviso"
              onClick={() => setShown((list) => list.filter((x) => x.id !== n.id))}
            >
              <FiX aria-hidden="true" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
