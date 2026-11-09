/** Cartão de indicador do HUD: ícone, rótulo, valor e observação. */
export default function StatTile({ icon: Icon, label, value, note, tone = 'text-ink' }) {
  return (
    <div className="panel h-full">
      <div className="panel-body flex h-full flex-col gap-1 p-3 sm:p-4">
        <p className="flex items-center gap-2 text-xs text-muted">
          {Icon && <Icon aria-hidden="true" className={tone} />}
          {label}
        </p>
        <p className={`num text-xl sm:text-2xl ${tone}`}>{value}</p>
        {note && <p className="text-xs text-faint">{note}</p>}
      </div>
    </div>
  );
}

export function StatGrid({ children, label, className = 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4' }) {
  return (
    <ul aria-label={label} className={`grid list-none gap-3 p-0 ${className}`}>
      {(Array.isArray(children) ? children : [children]).filter(Boolean).map((child, i) => (
        <li key={i} className="min-w-0">
          {child}
        </li>
      ))}
    </ul>
  );
}
