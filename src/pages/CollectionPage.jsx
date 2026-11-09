import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { FiArrowLeft, FiPlus, FiEdit2, FiTrash2, FiArrowUp, FiArrowDown, FiImage, FiX, FiGlobe, FiLock } from 'react-icons/fi';
import { useMutation } from '@tanstack/react-query';
import { api } from '../services/api.js';
import { useCollection, useLibraryMutation, useInvalidateLibrary } from '../hooks/queries.js';
import { useToast } from '../hooks/useToast.js';
import PageHeader from '../components/PageHeader.jsx';
import CoverImage from '../components/CoverImage.jsx';
import StatusBadge from '../components/StatusBadge.jsx';
import { StarRating } from '../components/StarRating.jsx';
import CollectionDialog from '../components/CollectionDialog.jsx';
import GamePickerDialog from '../components/GamePickerDialog.jsx';
import ConfirmDialog from '../components/ConfirmDialog.jsx';
import { LoadingState, ErrorState, EmptyState } from '../components/States.jsx';

export default function CollectionPage() {
  const { id } = useParams();
  const collection = useCollection(id);
  if (collection.isPending) return <LoadingState label="Carregando coleção…" />;
  if (collection.isError) {
    return (
      <ErrorState
        error={collection.error}
        onRetry={collection.refetch}
        title={collection.error.status === 404 ? 'Coleção não encontrada' : undefined}
      />
    );
  }
  return <CollectionView collection={collection.data} />;
}

function CollectionView({ collection: c }) {
  const toast = useToast();
  const navigate = useNavigate();
  const invalidate = useInvalidateLibrary();
  const [editing, setEditing] = useState(false);
  const [adding, setAdding] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const onError = (error) => toast.error(error.message);

  const add = useLibraryMutation((ids) => api.addToCollection(c.id, ids), {
    onSuccess: (_r, ids) => {
      setAdding(false);
      toast.success(ids.length === 1 ? 'Jogo adicionado à coleção.' : `${ids.length} jogos adicionados.`);
    },
    onError,
  });
  const remove = useLibraryMutation((game) => api.removeFromCollection(c.id, game.id), {
    onSuccess: (_r, game) => toast.success(`${game.title} saiu da coleção (o jogo continua na biblioteca).`),
    onError,
  });
  const reorder = useLibraryMutation((ids) => api.reorderCollection(c.id, ids), { onError });
  const cover = useLibraryMutation((gameId) => api.updateCollection(c.id, { coverGameId: gameId }), {
    onSuccess: () => toast.success('Capa da coleção atualizada.'),
    onError,
  });
  const destroy = useMutation({
    mutationFn: () => api.deleteCollection(c.id),
    onSuccess: () => {
      navigate('/colecoes', { replace: true });
      toast.success(`Coleção “${c.name}” excluída. Os jogos continuam na biblioteca.`);
      invalidate();
    },
    onError: (error) => {
      setDeleting(false);
      onError(error);
    },
  });
  const busy = reorder.isPending || remove.isPending || cover.isPending;

  function move(index, delta) {
    const ids = c.items.map((g) => g.id);
    const [moved] = ids.splice(index, 1);
    ids.splice(index + delta, 0, moved);
    reorder.mutate(ids);
  }

  return (
    <div className="page-enter">
      <nav aria-label="Navegação" className="mb-4 text-sm">
        <Link to="/colecoes" className="inline-flex items-center gap-1 text-muted hover:text-cyan">
          <FiArrowLeft aria-hidden="true" /> Coleções
        </Link>
      </nav>
      <PageHeader
        kicker={
          <span className="inline-flex items-center gap-1.5">
            {c.isPublic ? <FiGlobe aria-hidden="true" /> : <FiLock aria-hidden="true" />}
            {c.isPublic ? 'Coleção pública' : 'Coleção privada'} · <span className="num">{c.gameCount}</span> {c.gameCount === 1 ? 'jogo' : 'jogos'}
          </span>
        }
        title={c.name}
        actions={
          <>
            <button type="button" className="btn btn-primary btn-sm" onClick={() => setAdding(true)}>
              <FiPlus aria-hidden="true" /> Adicionar jogos
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditing(true)}>
              <FiEdit2 aria-hidden="true" /> Editar
            </button>
            <button type="button" className="btn btn-danger btn-sm" onClick={() => setDeleting(true)}>
              <FiTrash2 aria-hidden="true" /> Excluir
            </button>
          </>
        }
      >
        {c.description}
      </PageHeader>

      {c.items.length === 0 ? (
        <EmptyState
          title="Coleção vazia"
          action={
            <button type="button" className="btn btn-ghost" onClick={() => setAdding(true)}>
              Adicionar jogos
            </button>
          }
        >
          Escolha jogos da sua biblioteca (ou da lista de desejos) para esta coleção.
        </EmptyState>
      ) : (
        <ol className="list-none space-y-2 p-0">
          {c.items.map((g, i) => {
            const isCover = c.coverGameId === g.id;
            return (
              <li key={g.id} className={`flex items-center gap-3 border p-2 sm:p-3 ${isCover ? 'border-amber/60 bg-amber-soft' : 'border-line bg-panel/70'}`}>
                <span className="num w-6 text-center text-sm text-faint">{i + 1}</span>
                <Link to={`/jogos/${g.id}`} className="w-12 shrink-0" tabIndex={-1} aria-hidden="true">
                  <CoverImage src={g.coverUrl} title={g.title} />
                </Link>
                <div className="min-w-0 flex-1">
                  <Link to={`/jogos/${g.id}`} className="block truncate font-semibold text-ink no-underline hover:text-cyan">
                    {g.title}
                  </Link>
                  <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
                    {g.platform.name}
                    {g.ownershipStatus === 'OWNED' ? <StatusBadge status={g.playStatus} /> : <span className="text-magenta">Desejado</span>}
                    {g.ratingStars ? <StarRating value={g.ratingStars} size="text-xs" /> : null}
                    {isCover && <span className="text-amber">Capa da coleção</span>}
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap justify-end gap-1">
                  <button type="button" className="btn btn-ghost btn-sm btn-icon" disabled={busy || i === 0} onClick={() => move(i, -1)} aria-label={`Subir ${g.title}`}>
                    <FiArrowUp aria-hidden="true" />
                  </button>
                  <button type="button" className="btn btn-ghost btn-sm btn-icon" disabled={busy || i === c.items.length - 1} onClick={() => move(i, 1)} aria-label={`Descer ${g.title}`}>
                    <FiArrowDown aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm btn-icon"
                    disabled={busy}
                    aria-pressed={isCover}
                    onClick={() => cover.mutate(isCover ? null : g.id)}
                    aria-label={isCover ? `Remover ${g.title} como capa` : `Usar ${g.title} como capa`}
                  >
                    <FiImage aria-hidden="true" />
                  </button>
                  <button type="button" className="btn btn-danger btn-sm btn-icon" disabled={busy} onClick={() => remove.mutate(g)} aria-label={`Tirar ${g.title} da coleção`}>
                    <FiX aria-hidden="true" />
                  </button>
                </div>
              </li>
            );
          })}
        </ol>
      )}

      {editing && <CollectionDialog collection={c} onClose={() => setEditing(false)} />}
      {adding && (
        <GamePickerDialog
          title={`Adicionar a “${c.name}”`}
          exclude={c.items.map((g) => g.id)}
          busy={add.isPending}
          onClose={() => setAdding(false)}
          onConfirm={(ids) => add.mutate(ids)}
        />
      )}
      <ConfirmDialog
        open={deleting}
        title={`Excluir a coleção “${c.name}”?`}
        confirmLabel="Excluir coleção"
        busy={destroy.isPending}
        onCancel={() => setDeleting(false)}
        onConfirm={() => destroy.mutate()}
      >
        Só a coleção é apagada. Os {c.gameCount} jogos continuam na biblioteca, com todos os dados.
      </ConfirmDialog>
    </div>
  );
}
