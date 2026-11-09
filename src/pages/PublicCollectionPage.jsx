import { Link, useParams } from 'react-router';
import { FiArrowLeft } from 'react-icons/fi';
import { usePublicCollection } from '../hooks/queries.js';
import PageHeader from '../components/PageHeader.jsx';
import GameTile, { TileGrid } from '../components/GameTile.jsx';
import { LoadingState, ErrorState, EmptyState } from '../components/States.jsx';

export default function PublicCollectionPage() {
  const { username, id } = useParams();
  const collection = usePublicCollection(username, id);
  const back = (
    <Link to={`/u/${username}`} className="btn btn-ghost btn-sm">
      <FiArrowLeft aria-hidden="true" /> Voltar ao perfil
    </Link>
  );
  if (collection.isPending) return <LoadingState label="Carregando coleção…" />;
  if (collection.isError) {
    if (collection.error.status === 404) {
      return <EmptyState title="Coleção indisponível" action={back}>Esta coleção não existe ou não é pública.</EmptyState>;
    }
    return <ErrorState error={collection.error} onRetry={collection.refetch} />;
  }
  const c = collection.data;
  return (
    <div className="page-enter">
      <PageHeader kicker={`Coleção de ${c.owner.displayName}`} title={c.name} actions={back}>
        {c.description}
      </PageHeader>
      {c.items.length === 0 ? (
        <EmptyState title="Coleção vazia" />
      ) : (
        <TileGrid label={c.name}>
          {c.items.map((g) => (
            <li key={g.id}>
              <GameTile game={g} showStatus />
            </li>
          ))}
        </TileGrid>
      )}
    </div>
  );
}
