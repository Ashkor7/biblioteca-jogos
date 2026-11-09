import { FiLock, FiAward } from 'react-icons/fi';
import { RARITY } from '../../shared/progression.js';
import { ACHIEVEMENT_ICONS } from '../utils/hubIcons.js';
import { formatDate } from '../utils/format.js';

const nf = new Intl.NumberFormat('pt-BR');

/** Cartão de conquista: raridade (cor + texto), progresso e recompensa. */
export default function AchievementCard({ achievement: a, compact = false }) {
  const Icon = ACHIEVEMENT_ICONS[a.icon] ?? FiAward;
  const unlocked = a.unlocked ?? true;
  return (
    <article
      className={`panel h-full rarity-${a.rarity} ${unlocked ? '' : 'opacity-80'}`}
      style={{ background: unlocked ? 'linear-gradient(135deg, var(--rarity), var(--color-line-strong) 55%)' : undefined }}
      aria-label={`${a.name}${unlocked ? ', desbloqueada' : ', bloqueada'}`}
    >
      <div className={`panel-body flex h-full gap-3 ${compact ? 'p-3' : 'p-4'}`}>
        <span
          aria-hidden="true"
          className={`flex shrink-0 items-center justify-center border ${compact ? 'h-10 w-10 text-lg' : 'h-12 w-12 text-xl'}`}
          style={{
            color: unlocked ? 'var(--rarity)' : 'var(--color-faint)',
            borderColor: unlocked ? 'var(--rarity)' : 'var(--color-line-strong)',
            background: unlocked ? 'color-mix(in srgb, var(--rarity) 12%, transparent)' : 'var(--color-panel-2)',
          }}
        >
          {unlocked ? <Icon /> : <FiLock />}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-[0.98rem] font-semibold leading-snug">{a.name}</h3>
          <p className="text-xs" style={{ color: 'var(--rarity)' }}>
            {RARITY[a.rarity]?.label}
            {a.category && <span className="text-faint"> · {a.category}</span>}
          </p>
          {!compact && <p className="mt-1 text-sm text-muted">{a.description}</p>}
          {!unlocked && a.target !== undefined && (
            <div className="mt-2">
              <div className="flex justify-between text-xs text-muted">
                <span className="num">
                  {nf.format(a.current)} / {nf.format(a.target)}
                </span>
                <span className="num">{a.percent}%</span>
              </div>
              <div
                className="progress-track mt-1"
                role="progressbar"
                aria-label={`Progresso de ${a.name}`}
                aria-valuemin={0}
                aria-valuemax={a.target}
                aria-valuenow={a.current}
                style={{ '--progress-color': 'var(--color-violet)' }}
              >
                <div className="progress-fill" style={{ width: `${a.percent}%` }} />
              </div>
            </div>
          )}
          <p className="mt-2 flex flex-wrap gap-x-3 text-xs text-faint">
            {a.xp !== undefined && <span className="num text-violet">+{a.xp} XP</span>}
            {unlocked && a.unlockedAt && (
              <span>
                {a.retroactive ? 'Registrada retroativamente em ' : 'Desbloqueada em '}
                {formatDate(a.unlockedAt)}
              </span>
            )}
          </p>
        </div>
      </div>
    </article>
  );
}
