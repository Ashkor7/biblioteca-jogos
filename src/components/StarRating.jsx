import { FiStar } from 'react-icons/fi';

/** Exibição de nota (somente leitura). */
export function StarRating({ value, size = 'text-sm' }) {
  if (!value) return <span className={`${size} text-faint`}>Sem nota</span>;
  return (
    <span className={`inline-flex items-center gap-0.5 ${size}`} role="img" aria-label={`${value} de 5 estrelas`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <FiStar
          key={n}
          aria-hidden="true"
          className={n <= value ? 'fill-amber text-amber' : 'text-line-strong'}
        />
      ))}
    </span>
  );
}

/** Entrada de nota: grupo de rádios nativo (teclado e leitor de tela funcionam). */
export function StarInput({ value, onChange, name = 'ratingStars' }) {
  return (
    <fieldset className="border-0 p-0">
      <legend className="field-label">Nota</legend>
      <div className="flex flex-wrap items-center gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <label
            key={n}
            className="group relative inline-flex h-11 w-11 cursor-pointer items-center justify-center"
            title={`${n} ${n === 1 ? 'estrela' : 'estrelas'}`}
          >
            <input
              type="radio"
              name={name}
              value={n}
              checked={value === n}
              onChange={() => onChange(n)}
              className="peer sr-only"
            />
            <span className="sr-only">
              {n} {n === 1 ? 'estrela' : 'estrelas'}
            </span>
            <FiStar
              aria-hidden="true"
              className={`text-2xl transition-colors peer-focus-visible:outline-2 peer-focus-visible:outline-cyan ${
                value && n <= value ? 'fill-amber text-amber' : 'text-line-strong group-hover:text-amber'
              }`}
            />
          </label>
        ))}
        <label className="ml-2 inline-flex min-h-11 cursor-pointer items-center gap-2 text-sm text-muted">
          <input
            type="radio"
            name={name}
            value=""
            checked={!value}
            onChange={() => onChange(null)}
            className="accent-cyan"
          />
          Ainda sem nota
        </label>
      </div>
    </fieldset>
  );
}
