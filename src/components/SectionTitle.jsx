const ACCENTS = {
  cyan: 'var(--color-cyan)',
  violet: 'var(--color-violet)',
  amber: 'var(--color-amber)',
  magenta: 'var(--color-magenta)',
  blue: 'var(--color-blue)',
};

/** Título de seção com marcador diagonal colorido e ação opcional à direita. */
export default function SectionTitle({ id, title, accent = 'cyan', action, children }) {
  return (
    <div className="section-title flex-wrap" style={{ '--section-accent': ACCENTS[accent] }}>
      <h2 id={id}>{title}</h2>
      {action}
      {children && <div className="basis-full text-sm text-muted">{children}</div>}
    </div>
  );
}
