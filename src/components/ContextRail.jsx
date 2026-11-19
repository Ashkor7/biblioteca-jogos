import { useId } from 'react';

/**
 * Conteúdo principal + coluna contextual à direita (desktop largo). Abaixo de `xl`
 * os widgets descem para depois do conteúdo, em duas colunas no tablet e uma no celular.
 * Sem `rail`, o conteúdo ocupa a largura toda.
 */
export default function WithRail({ rail, children, label = 'Painel contextual' }) {
  if (!rail) return children;
  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_19.5rem] 2xl:grid-cols-[minmax(0,1fr)_21.5rem]">
      <div className="@container min-w-0">{children}</div>
      <aside aria-label={label} className="grid content-start gap-5 sm:grid-cols-2 xl:grid-cols-1">
        {rail}
      </aside>
    </div>
  );
}

const TONES = { neon: 'panel-neon', accent: 'panel-accent', gold: 'panel-gold', plain: '' };

/** Bloco do painel contextual: borda neon, título em caixa alta e ação opcional. */
export function Widget({ title, action, footer, tone = 'neon', children, className = '' }) {
  const id = useId();
  return (
    <section aria-labelledby={id} className={`panel ${TONES[tone] ?? ''} ${className}`} style={{ '--radius': '16px' }}>
      <div className="panel-body flex flex-col p-5">
        <div className="mb-4 flex items-baseline justify-between gap-3">
          <h2 id={id} className="widget-title">
            {title}
          </h2>
          {action && <div className="shrink-0 text-xs">{action}</div>}
        </div>
        {children}
        {footer && <div className="mt-4 text-sm">{footer}</div>}
      </div>
    </section>
  );
}

/** Anel de porcentagem. `value` em 0–100; `label` descreve o que é medido. */
export function ProgressRing({ value, label, size = 112 }) {
  const gradientId = useId();
  const r = 40;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, value ?? 0));
  return (
    <figure className="flex flex-col items-center gap-2">
      <svg viewBox="0 0 100 100" width={size} height={size} role="img" aria-label={`${label}: ${Math.round(pct)}%`}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#39e1ea" />
            <stop offset="1" stopColor="#5b95ff" />
          </linearGradient>
        </defs>
        <circle cx="50" cy="50" r={r} fill="none" strokeWidth="8" className="ring-track" />
        <circle
          cx="50"
          cy="50"
          r={r}
          fill="none"
          strokeWidth="8"
          strokeLinecap="round"
          stroke={`url(#${gradientId})`}
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct / 100)}
          transform="rotate(-90 50 50)"
          style={{ transition: 'stroke-dashoffset 600ms cubic-bezier(.2,.8,.2,1)', filter: 'drop-shadow(0 0 3px #39e1ea99)' }}
        />
        <text x="50" y="50" textAnchor="middle" dominantBaseline="central" fontFamily="Chakra Petch, sans-serif" fill="#e8eefb" fontSize="19">
          {Math.round(pct)}%
        </text>
      </svg>
      <figcaption className="text-center text-xs text-[#9fd8ff]">{label}</figcaption>
    </figure>
  );
}
