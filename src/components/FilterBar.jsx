import { FiSearch } from 'react-icons/fi';
import { PLAY_STATUS_LABELS, MEDIA_LABELS, WISH_PRIORITY_LABELS } from '../../shared/domain.js';

const SORT_LABELS = {
  featured: 'Destaque primeiro',
  recent: 'Mais recentes',
  title: 'Nome (A–Z)',
  rating: 'Melhor nota',
  hours: 'Mais horas',
  paid: 'Maior valor pago',
  wishPrice: 'Menor último preço',
  priority: 'Maior prioridade',
};

/**
 * Busca + filtros combináveis. `filters` é o estado (vem da URL); `onChange` recebe o patch.
 * `show` escolhe quais controles aparecem. Todos os filtros rodam no servidor (paginado).
 */
export default function FilterBar({
  filters,
  onChange,
  categories = [],
  platforms = [],
  stores = [],
  collections = [],
  show = ['status', 'media', 'category', 'sort'],
  sorts = ['featured', 'recent', 'title', 'rating', 'hours', 'paid'],
  label = 'Filtrar jogos',
  priceLabel = 'Preço pago',
}) {
  const has = (key) => show.includes(key);
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
          placeholder="Buscar por nome, plataforma, loja, categoria ou coleção"
          value={filters.search ?? ''}
          onChange={(e) => onChange({ search: e.target.value })}
        />
      </div>
      {has('platform') && (
        <Select label="Plataforma" value={filters.platform} onChange={(v) => onChange({ platform: v })}>
          <option value="">Todas as plataformas</option>
          {platforms.map((p) => (
            <option key={p.id} value={p.slug}>
              {p.name}
            </option>
          ))}
        </Select>
      )}
      {has('store') && (
        <Select label="Loja" value={filters.storeId} onChange={(v) => onChange({ storeId: v })}>
          <option value="">Todas as lojas</option>
          {stores.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </Select>
      )}
      {has('preferredStore') && (
        <Select label="Loja preferida" value={filters.preferredStoreId} onChange={(v) => onChange({ preferredStoreId: v })}>
          <option value="">Qualquer loja preferida</option>
          {stores.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </Select>
      )}
      {has('status') && (
        <Select label="Estado" value={filters.status} onChange={(v) => onChange({ status: v })}>
          <option value="">Todos os estados</option>
          {Object.entries(PLAY_STATUS_LABELS).map(([value, text]) => (
            <option key={value} value={value}>
              {text}
            </option>
          ))}
        </Select>
      )}
      {has('media') && (
        <Select label="Mídia" value={filters.media} onChange={(v) => onChange({ media: v })}>
          <option value="">Físico e digital</option>
          {Object.entries(MEDIA_LABELS).map(([value, text]) => (
            <option key={value} value={value}>
              {text}
            </option>
          ))}
        </Select>
      )}
      {has('category') && (
        <Select label="Categoria" value={filters.categoryId} onChange={(v) => onChange({ categoryId: v })}>
          <option value="">Todas as categorias</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
      )}
      {has('collection') && (
        <Select label="Coleção" value={filters.collectionId} onChange={(v) => onChange({ collectionId: v })}>
          <option value="">Todas as coleções</option>
          {collections.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
      )}
      {has('rating') && (
        <Select label="Nota mínima" value={filters.minRating} onChange={(v) => onChange({ minRating: v })}>
          <option value="">Qualquer nota</option>
          {[5, 4, 3, 2, 1].map((n) => (
            <option key={n} value={n}>
              {n === 5 ? '5 estrelas' : `${n}+ estrelas`}
            </option>
          ))}
        </Select>
      )}
      {has('favorite') && (
        <Select label="Favoritos" value={filters.favorite} onChange={(v) => onChange({ favorite: v })}>
          <option value="">Favoritos ou não</option>
          <option value="true">Só favoritos</option>
          <option value="false">Fora dos favoritos</option>
        </Select>
      )}
      {has('priority') && (
        <Select label="Prioridade" value={filters.priority} onChange={(v) => onChange({ priority: v })}>
          <option value="">Qualquer prioridade</option>
          {Object.entries(WISH_PRIORITY_LABELS).map(([value, text]) => (
            <option key={value} value={value}>
              {text}
            </option>
          ))}
        </Select>
      )}
      {has('target') && (
        <Select label="Preço-alvo" value={filters.targetReached} onChange={(v) => onChange({ targetReached: v })}>
          <option value="">Alvo atingido ou não</option>
          <option value="true">Último preço no alvo ou abaixo</option>
        </Select>
      )}
      {has('price') && (
        <fieldset className="flex min-w-0 flex-[1_1_14rem] gap-2 border-0 p-0">
          <legend className="sr-only">{priceLabel}</legend>
          <label className="block min-w-0 flex-1">
            <span className="sr-only">{priceLabel} mínimo</span>
            <input
              className="input num"
              inputMode="decimal"
              placeholder="R$ mín."
              value={filters.minPrice ?? ''}
              onChange={(e) => onChange({ minPrice: e.target.value })}
            />
          </label>
          <label className="block min-w-0 flex-1">
            <span className="sr-only">{priceLabel} máximo</span>
            <input
              className="input num"
              inputMode="decimal"
              placeholder="R$ máx."
              value={filters.maxPrice ?? ''}
              onChange={(e) => onChange({ maxPrice: e.target.value })}
            />
          </label>
        </fieldset>
      )}
      {has('sort') && (
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
