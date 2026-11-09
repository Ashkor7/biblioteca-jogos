import { useState } from 'react';
import { Link } from 'react-router';
import { FiArrowUp, FiArrowDown, FiEye, FiEyeOff, FiTrash2, FiPlus } from 'react-icons/fi';
import { api } from '../services/api.js';
import { useFavorites, useLibraryMutation } from '../hooks/queries.js';
import { useToast } from '../hooks/useToast.js';
import CoverImage from './CoverImage.jsx';
import { StarRating } from './StarRating.jsx';
import GamePickerDialog from './GamePickerDialog.jsx';
import { LoadingState, ErrorState, EmptyState } from './States.jsx';

/** Lista completa de favoritos: ordenar, escolher o que aparece no perfil e remover. */
export default function FavoritesManager() {
  const toast = useToast();
  const favorites = useFavorites();
  const [picking, setPicking] = useState(false);
  const onError = (error) => toast.error(error.message);

  const reorder = useLibraryMutation((ids) => api.reorderFavorites(ids), { onError });
  const toggle = useLibraryMutation((f) => api.updateFavorite(f.id, { showOnProfile: !f.showOnProfile }), { onError });
  const remove = useLibraryMutation((f) => api.removeFavorite(f.id), {
    onSuccess: (_r, f) => toast.success(`${f.title} saiu dos favoritos.`),
    onError,
  });
  const add = useLibraryMutation(
    async (ids) => {
      for (const id of ids) await api.addFavorite(id);
    },
    {
      onSuccess: (_r, ids) => {
        setPicking(false);
        toast.success(ids.length === 1 ? 'Favorito adicionado.' : `${ids.length} favoritos adicionados.`);
      },
      onError,
    },
  );

  if (favorites.isPending) return <LoadingState label="Carregando favoritos…" />;
  if (favorites.isError) return <ErrorState error={favorites.error} onRetry={favorites.refetch} />;
  const items = favorites.data.items;
  const busy = reorder.isPending || toggle.isPending || remove.isPending;

  function move(index, delta) {
    const ids = items.map((f) => f.id);
    const [moved] = ids.splice(index, 1);
    ids.splice(index + delta, 0, moved);
    reorder.mutate(ids);
  }

  const addButton = (
    <button type="button" className="btn btn-ghost btn-sm" onClick={() => setPicking(true)}>
      <FiPlus aria-hidden="true" /> Adicionar favoritos
    </button>
  );

  return (
    <div>
      {items.length === 0 ? (
        <EmptyState title="Nenhum favorito ainda" action={addButton}>
          Favoritos são diferentes do jogo em destaque: escolha quantos quiser e a ordem em que aparecem no perfil.
        </EmptyState>
      ) : (
        <>
          <div className="mb-3 flex justify-end">{addButton}</div>
          <ol className="list-none space-y-2 p-0">
            {items.map((f, i) => (
              <li key={f.id} className="flex items-center gap-3 border border-line bg-panel/70 p-2">
                <span className="num w-6 text-center text-sm text-faint">{i + 1}</span>
                <Link to={`/jogos/${f.id}`} className="w-10 shrink-0" tabIndex={-1} aria-hidden="true">
                  <CoverImage src={f.coverUrl} title={f.title} />
                </Link>
                <div className="min-w-0 flex-1">
                  <Link to={`/jogos/${f.id}`} className="block truncate font-semibold text-ink no-underline hover:text-cyan">
                    {f.title}
                  </Link>
                  <p className="flex flex-wrap items-center gap-x-3 text-xs text-muted">
                    {f.platform.name}
                    {f.ratingStars ? <StarRating value={f.ratingStars} size="text-xs" /> : null}
                    {!f.showOnProfile && <span className="text-faint">oculto no perfil</span>}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <button type="button" className="btn btn-ghost btn-sm btn-icon" disabled={busy || i === 0} onClick={() => move(i, -1)} aria-label={`Subir ${f.title}`}>
                    <FiArrowUp aria-hidden="true" />
                  </button>
                  <button type="button" className="btn btn-ghost btn-sm btn-icon" disabled={busy || i === items.length - 1} onClick={() => move(i, 1)} aria-label={`Descer ${f.title}`}>
                    <FiArrowDown aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm btn-icon"
                    disabled={busy}
                    onClick={() => toggle.mutate(f)}
                    aria-pressed={f.showOnProfile}
                    aria-label={f.showOnProfile ? `Ocultar ${f.title} do perfil` : `Mostrar ${f.title} no perfil`}
                  >
                    {f.showOnProfile ? <FiEye aria-hidden="true" /> : <FiEyeOff aria-hidden="true" />}
                  </button>
                  <button type="button" className="btn btn-danger btn-sm btn-icon" disabled={busy} onClick={() => remove.mutate(f)} aria-label={`Remover ${f.title} dos favoritos`}>
                    <FiTrash2 aria-hidden="true" />
                  </button>
                </div>
              </li>
            ))}
          </ol>
          <p className="mt-2 text-xs text-faint">Os seis primeiros visíveis aparecem no topo do perfil.</p>
        </>
      )}
      {picking && (
        <GamePickerDialog
          title="Adicionar favoritos"
          exclude={items.map((f) => f.id)}
          busy={add.isPending}
          onClose={() => setPicking(false)}
          onConfirm={(ids) => add.mutate(ids)}
        />
      )}
    </div>
  );
}
