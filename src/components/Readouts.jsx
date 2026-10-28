/** Faixa de leituras numéricas (sem gráficos decorativos). */
export function ReadoutStrip({ items, label }) {
  return (
    <dl aria-label={label} className="grid grid-cols-2 border border-line bg-panel/70 sm:grid-cols-4">
      {items.map((item, i) => (
        <div
          key={item.label}
          className={`px-4 py-3 ${i % 2 ? 'border-l border-line' : ''} ${i >= 2 ? 'border-t border-line sm:border-t-0' : ''} ${
            i === 2 ? 'sm:border-l' : ''
          }`}
        >
          <dt className="text-xs text-muted">{item.label}</dt>
          <dd className={`num mt-0.5 text-xl ${item.tone ?? 'text-ink'}`}>{item.value}</dd>
          {item.note && <p className="mt-0.5 text-xs text-faint">{item.note}</p>}
        </div>
      ))}
    </dl>
  );
}
