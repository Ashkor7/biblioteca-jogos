const nf = new Intl.NumberFormat('pt-BR');

/** Nível + barra de XP. `progress` vem de levelProgress() (servidor). */
export default function XpBar({ progress, compact = false }) {
  if (!progress) return null;
  const { level, totalXp, nextLevelXp, xpForNext, percent } = progress;
  return (
    <div className="min-w-0">
      <div className={`flex items-baseline justify-between ${compact ? 'gap-2' : 'gap-3'}`}>
        <p className="font-display font-semibold text-violet">
          Nível <span className={`num ${compact ? 'text-base' : 'text-2xl'}`}>{level}</span>
        </p>
        <p className={`num text-muted ${compact ? 'whitespace-nowrap text-[0.68rem]' : 'text-xs'}`}>
          {nf.format(totalXp)}
          {nextLevelXp !== null && <span className="text-faint"> / {nf.format(nextLevelXp)} XP</span>}
        </p>
      </div>
      <div
        className="xp-track mt-1.5"
        role="progressbar"
        aria-label={`Progresso para o nível ${level + 1}`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        aria-valuetext={nextLevelXp === null ? 'Nível máximo' : `${percent}%: faltam ${nf.format(xpForNext)} XP`}
      >
        <div className="xp-fill" style={{ width: `${percent}%` }} />
      </div>
      {!compact && nextLevelXp !== null && (
        <p className="mt-1 text-xs text-faint">
          Faltam <span className="num text-muted">{nf.format(xpForNext)} XP</span> para o nível {level + 1}
        </p>
      )}
    </div>
  );
}
