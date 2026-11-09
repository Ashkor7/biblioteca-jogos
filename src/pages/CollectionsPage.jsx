import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { FiPlus, FiFolder, FiGlobe, FiLock } from 'react-icons/fi';
import { useCollections } from '../hooks/queries.js';
import PageHeader from '../components/PageHeader.jsx';
import CollectionDialog from '../components/CollectionDialog.jsx';
import { LoadingState, ErrorState, EmptyState } from '../components/States.jsx';

export default function CollectionsPage() {
  const collections = useCollections();
  const navigate = useNavigate();
  const [creating, setCreating] = useState(false);
  const addButton = (
    <button type="button" className="btn btn-primary" onClick={() => setCreating(true)}>
      <FiPlus aria-hidden="true" /> Nova coleção
    </button>
  );
  return (
    <div className="page-enter">
      <PageHeader title="Coleções" actions={addButton}>
        Listas criadas por você. Um jogo pode estar em várias coleções; excluir uma coleção nunca exclui os jogos.
      </PageHeader>
      {collections.isPending ? (
        <LoadingState label="Carregando coleções…" />
      ) : collections.isError ? (
        <ErrorState error={collections.error} onRetry={collections.refetch} />
      ) : collections.data.items.length === 0 ? (
        <EmptyState title="Nenhuma coleção ainda" action={addButton}>
          Agrupe jogos do seu jeito: “Meus RPGs favoritos”, “Jogos cooperativos”, “Físicos raros”…
        </EmptyState>
      ) : (
        <ul className="grid list-none gap-4 p-0 sm:grid-cols-2 xl:grid-cols-3">
          {collections.data.items.map((c) => (
            <li key={c.id}>
              <Link to={`/colecoes/${c.id}`} className="tile-link block h-full">
                <article className="panel h-full transition-colors hover:bg-cyan/50">
                  <div className="panel-body flex h-full flex-col">
                    <div className="grid h-36 grid-cols-4 gap-px overflow-hidden bg-panel-3">
                      {c.coverUrl ? (
                        <img src={c.coverUrl} alt="" className="col-span-4 h-36 w-full object-cover" loading="lazy" />
                      ) : c.previews.length ? (
                        c.previews.map((g) =>
                          g.coverUrl ? (
                            <img key={g.id} src={g.coverUrl} alt="" className="h-36 w-full object-cover" loading="lazy" />
                          ) : (
                            <div key={g.id} className="h-36 bg-panel-2" />
                          ),
                        )
                      ) : (
                        <div className="col-span-4 flex items-center justify-center text-3xl text-line-strong">
                          <FiFolder aria-hidden="true" />
                        </div>
                      )}
                    </div>
                    <div className="flex flex-1 flex-col gap-1 p-4">
                      <h2 className="text-lg">{c.name}</h2>
                      {c.description && <p className="line-clamp-2 text-sm text-muted">{c.description}</p>}
                      <p className="mt-auto flex items-center justify-between pt-2 text-xs text-muted">
                        <span className="num">
                          {c.gameCount} {c.gameCount === 1 ? 'jogo' : 'jogos'}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          {c.isPublic ? <FiGlobe aria-hidden="true" /> : <FiLock aria-hidden="true" />}
                          {c.isPublic ? 'Pública' : 'Privada'}
                        </span>
                      </p>
                    </div>
                  </div>
                </article>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {creating && <CollectionDialog onClose={() => setCreating(false)} onSaved={(c) => navigate(`/colecoes/${c.id}`)} />}
    </div>
  );
}
