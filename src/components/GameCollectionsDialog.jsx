import { useState } from 'react';
import { Link } from 'react-router';
import { FiFolder, FiPlus } from 'react-icons/fi';
import { api } from '../services/api.js';
import { useCollections, useGameCollections, useLibraryMutation } from '../hooks/queries.js';
import { useToast } from '../hooks/useToast.js';
import Modal from './Modal.jsx';
import CollectionDialog from './CollectionDialog.jsx';
import { LoadingState, ErrorState } from './States.jsx';

/** Marca/desmarca as coleções de um jogo (cada clique salva na hora). */
export default function GameCollectionsDialog({ game, onClose }) {
  const toast = useToast();
  const all = useCollections();
  const mine = useGameCollections(game.id);
  const [creating, setCreating] = useState(false);
  const inside = new Set(mine.data?.items.map((c) => c.id));
  const toggle = useLibraryMutation(
    (c) => (inside.has(c.id) ? api.removeFromCollection(c.id, game.id) : api.addToCollection(c.id, [game.id])),
    {
      onSuccess: (_r, c) => toast.success(inside.has(c.id) ? `Saiu de “${c.name}”.` : `Adicionado a “${c.name}”.`),
      onError: (error) => toast.error(error.message),
    },
  );
  if (creating) {
    return (
      <CollectionDialog
        onClose={() => setCreating(false)}
        onSaved={(c) => api.addToCollection(c.id, [game.id]).catch((error) => toast.error(error.message))}
      />
    );
  }
  return (
    <Modal title={`Coleções de ${game.title}`} icon={FiFolder} onClose={onClose}>
      {all.isPending || mine.isPending ? (
        <LoadingState />
      ) : all.isError ? (
        <ErrorState error={all.error} onRetry={all.refetch} />
      ) : (
        <>
          {all.data.items.length === 0 ? (
            <p className="text-sm text-muted">Você ainda não tem coleções.</p>
          ) : (
            <ul className="list-none space-y-1 p-0">
              {all.data.items.map((c) => (
                <li key={c.id}>
                  <label className="flex cursor-pointer items-center gap-3 border border-line px-3 py-2 hover:border-cyan/60">
                    <input type="checkbox" className="accent-cyan" checked={inside.has(c.id)} disabled={toggle.isPending} onChange={() => toggle.mutate(c)} />
                    <span className="min-w-0 flex-1 truncate">{c.name}</span>
                    <span className="num text-xs text-faint">{c.gameCount}</span>
                  </label>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-5 flex flex-wrap justify-between gap-2">
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setCreating(true)}>
              <FiPlus aria-hidden="true" /> Nova coleção com este jogo
            </button>
            <Link to="/colecoes" className="btn btn-ghost btn-sm">
              Gerenciar coleções
            </Link>
          </div>
        </>
      )}
    </Modal>
  );
}
