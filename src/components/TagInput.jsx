import { useId, useState } from 'react';
import { FiX } from 'react-icons/fi';
import { cleanDisplayName, normalizeKey, LIMITS } from '../../shared/domain.js';

/**
 * Categorias digitadas como etiquetas. Enter ou vírgula adiciona; Backspace com o
 * campo vazio remove a última. Sugere categorias já salvas e evita duplicatas
 * por caixa, acentos e espaços ("RPG" = "rpg", "Ação" = "acao").
 */
export default function TagInput({ id, label, value, onChange, suggestions = [], error, hint }) {
  const [draft, setDraft] = useState('');
  const listId = useId();
  const hintId = useId();
  const keys = new Set(value.map(normalizeKey));

  function add(raw) {
    setDraft('');
    const next = [...value];
    const seen = new Set(keys);
    // Aceita várias de uma vez (ex.: colar "RPG, Ação")
    for (const part of String(raw).split(',')) {
      const name = cleanDisplayName(part).slice(0, LIMITS.categoryMax);
      const key = normalizeKey(name);
      if (!key || seen.has(key) || next.length >= LIMITS.categoriesPerGame) continue;
      seen.add(key);
      // Reaproveita a grafia já salva no banco quando houver
      next.push(suggestions.find((s) => normalizeKey(s) === key) ?? name);
    }
    if (next.length !== value.length) onChange(next);
  }

  function remove(index) {
    onChange(value.filter((_, i) => i !== index));
  }

  function onKeyDown(event) {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault();
      add(draft);
    } else if (event.key === 'Backspace' && draft === '' && value.length) {
      remove(value.length - 1);
    }
  }

  const available = suggestions.filter((s) => !keys.has(normalizeKey(s)));

  return (
    <div>
      <label htmlFor={id} className="field-label">
        {label}
      </label>
      <div
        className={`flex min-h-11 flex-wrap items-center gap-1.5 border bg-panel-2 px-2 py-1.5 focus-within:border-cyan ${
          error ? 'border-danger' : 'border-line-strong'
        }`}
      >
        {value.map((tag, index) => (
          <span key={normalizeKey(tag)} className="tag">
            {tag}
            <button
              type="button"
              onClick={() => remove(index)}
              className="-mr-1 inline-flex h-6 w-6 items-center justify-center text-muted hover:text-danger"
              aria-label={`Remover categoria ${tag}`}
            >
              <FiX aria-hidden="true" />
            </button>
          </span>
        ))}
        <input
          id={id}
          value={draft}
          list={listId}
          onChange={(e) => {
            const text = e.target.value;
            // Escolher uma sugestão do datalist (não digitar) adiciona direto
            const inputType = e.nativeEvent?.inputType;
            const picked = !inputType || inputType === 'insertReplacementText';
            if (picked && suggestions.includes(text)) add(text);
            else if (text.includes(',')) {
              // Texto colado com vírgulas: adiciona as completas e mantém o resto
              const cut = text.lastIndexOf(',');
              add(text.slice(0, cut));
              setDraft(text.slice(cut + 1));
            } else setDraft(text);
          }}
          onKeyDown={onKeyDown}
          onBlur={() => draft.trim() && add(draft)}
          placeholder={value.length ? '' : 'Digite e tecle Enter'}
          className="min-w-[8rem] flex-1 bg-transparent px-1 py-1 text-ink outline-none placeholder:text-faint"
          aria-describedby={hintId}
          aria-invalid={error ? 'true' : undefined}
        />
        <datalist id={listId}>
          {available.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
      </div>
      <p id={hintId} className="field-hint">
        {hint ?? 'Crie suas próprias categorias. Enter ou vírgula para adicionar.'}
      </p>
      {error && <p className="field-error">{error}</p>}
    </div>
  );
}
