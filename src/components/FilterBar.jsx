import { FiSearch } from 'react-icons/fi';
import { PLAY_STATUS_LABELS, MEDIA_LABELS } from '../../shared/domain.js';

const SORT_LABELS = {
  featured: 'Destaque primeiro',
  recent: 'Mais recentes',
  title: 'Nome (A–Z)',
  rating: 'Melhor nota',
  hours: 'Mais horas',
  paid: 'Maior valor pago',
  wishPrice: 'Menor preço atual',
};

/**
 * Busca + filtros. `filters` é o estado (vem da URL); `onChange` recebe o patch.
 * `show` escolhe quais controles aparecem.
 */
export default function FilterBar({
  filters,
  onChange,
  categories = [],
  platforms = [],
  show = ['status', 'media', 'category', 'sort'],
  sorts = ['featured', 'recent', 'title', 'rating', 'hours', 'paid'],
  label = 'Filtrar jogos',
}) {
  return (
    <form role="search" aria-label={label} onSubmit={(e) => e.preventDefault()} className="mb-5 flex flex-wrap gap-2">
      <div className="relative min-w-0 flex-[3_1_18rem]">
        <label htmlFor="busca" className="sr-only">
          Buscar
        </label>
        <FiSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint" aria-hidden="true" />
        <input
          id="busca"
          type="search"
          className="input pl-9"
          placeholder="Buscar por nome, plataforma, loja ou categoria"
          value={filters.search ?? ''}
          onChange={(e) => onChange({ search: e.target.value })}
        />
      </div>
      {show.includes('platform') && (
        <Select label="Plataforma" value={filters.platform} onChange={(v) => onChange({ platform: v })}>
          <option value="">Todas as plataformas</option>
          {platforms.map((p) => (
            <option key={p.id} value={p.slug}>
              {p.name}
            </option>
          ))}
        </Select>
      )}
      {show.includes('status') && (
        <Select label="Estado" value={filters.status} onChange={(v) => onChange({ status: v })}>
          <option value="">Todos os estados</option>
          {Object.entries(PLAY_STATUS_LABELS).map(([value, text]) => (
            <option key={value} value={value}>
              {text}
            </option>
          ))}
        </Select>
      )}
      {show.includes('media') && (
        <Select label="Mídia" value={filters.media} onChange={(v) => onChange({ media: v })}>
          <option value="">Físico e digital</option>
          {Object.entries(MEDIA_LABELS).map(([value, text]) => (
            <option key={value} value={value}>
              {text}
            </option>
          ))}
        </Select>
      )}
      {show.includes('category') && (
        <Select label="Categoria" value={filters.categoryId} onChange={(v) => onChange({ categoryId: v })}>
          <option value="">Todas as categorias</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
      )}
      {show.includes('sort') && (
        <Select label="Ordenar" value={filters.sort} onChange={(v) => onChange({ sort: v })}>
          {sorts.map((value) => (
            <option key={value} value={value}>
              {SORT_LABELS[value]}
            </option>
          ))}
        </Select>
      )}
    </form>
  );
}

function Select({ label, value, onChange, children }) {
  return (
    <label className="block min-w-0 flex-[1_1_10.5rem]">
      <span className="sr-only">{label}</span>
      <select className="input" value={value ?? ''} onChange={(e) => onChange(e.target.value)} aria-label={label}>
        {children}
      </select>
    </label>
  );
}
