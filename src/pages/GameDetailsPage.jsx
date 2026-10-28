import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { FiEdit2, FiTrash2, FiAward, FiShoppingCart, FiArrowLeft, FiChevronLeft, FiChevronRight, FiX } from 'react-icons/fi';
import { api } from '../services/api.js';
import { useMutation } from '@tanstack/react-query';
import { useGame, useLibraryMutation, useInvalidateLibrary } from '../hooks/queries.js';
import { useAuth } from '../hooks/useAuth.js';
import { useToast } from '../hooks/useToast.js';
import CoverImage from '../components/CoverImage.jsx';
import StatusBadge from '../components/StatusBadge.jsx';
import { StarRating } from '../components/StarRating.jsx';
import ConfirmDialog from '../components/ConfirmDialog.jsx';
import PurchaseDialog from '../components/PurchaseDialog.jsx';
import { LoadingState, ErrorState } from '../components/States.jsx';
import { formatMoney, formatDate, formatHours, conditionLabel, describeDifference } from '../utils/format.js';

export default function GameDetailsPage() {
  const { id } = useParams();
  const game = useGame(id);
  if (game.isPending) return <LoadingState label="Carregando jogo…" />;
  if (game.isError) return <ErrorState error={game.error} onRetry={game.refetch} title={game.error.status === 404 ? 'Jogo não encontrado' : undefined} />;
  return <Details game={game.data} />;
}

function Details({ game }) {
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const invalidate = useInvalidateLibrary();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [buying, setBuying] = useState(false);
  const [viewer, setViewer] = useState(null);
  const wish = game.ownershipStatus === 'WISHLIST';
  const diff = describeDifference(game.priceDifference);

  // Navega antes de invalidar: a página do jogo excluído não tenta recarregar.
  const remove = useMutation({
    mutationFn: () => api.deleteGame(game.id),
    onSuccess: () => {
      navigate(wish ? '/desejos' : '/', { replace: true });
      toast.success(`${game.title} foi excluído.`);
      invalidate();
    },
    onError: (error) => {
      setConfirmDelete(false);
      toast.error(error.message);
    },
  });
  const feature = useLibraryMutation(() => api.setFeatured(game.id, !game.isFeatured), {
    onSuccess: (g) => toast.success(g.isFeatured ? `${g.title} está em destaque.` : 'Destaque removido.'),
    onError: (error) => toast.error(error.message),
  });

  const gallery = game.images;

  return (
    <article className="page-enter">
      <nav aria-label="Navegação" className="mb-4 flex flex-wrap items-center gap-2 text-sm text-muted">
        <Link to={wish ? '/desejos' : `/plataformas/${game.platform.slug}`} className="inline-flex items-center gap-1 text-muted hover:text-cyan">
          <FiArrowLeft aria-hidden="true" /> {wish ? 'Lista de desejos' : game.platform.name}
        </Link>
      </nav>

      <div className="grid gap-6 md:grid-cols-[minmax(0,18rem)_minmax(0,1fr)] lg:gap-10">
        <div className="mx-auto w-full max-w-[15rem] sm:max-w-[18rem] md:mx-0">
          <div className={`panel ${game.isFeatured ? 'bg-amber/80' : ''}`}>
            <div className="panel-body">
              <CoverImage src={game.coverUrl} title={game.title} platform={game.platform.name} />
            </div>
          </div>
          {gallery.length > 1 && (
            <ul className="mt-3 grid list-none grid-cols-4 gap-2 p-0" aria-label="Galeria">
              {gallery.map((img, index) => (
                <li key={img.id}>
                  <button
                    type="button"
                    onClick={() => setViewer(index)}
                    className={`block aspect-square w-full overflow-hidden border ${img.isCover ? 'border-cyan' : 'border-line hover:border-cyan'}`}
                    aria-label={`Ampliar imagem ${index + 1} de ${gallery.length}`}
                  >
                    <img src={img.url} alt="" className="h-full w-full object-cover" loading="lazy" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Link to={`/plataformas/${game.platform.slug}`} className="tag no-underline hover:border-cyan hover:text-cyan">
              {game.platform.name}
            </Link>
            <span className={`tag ${wish ? 'border-magenta/60 text-magenta' : ''}`}>{conditionLabel(game)}</span>
            {game.isFeatured && (
              <span className="tag border-amber/60 text-amber">
                <FiAward aria-hidden="true" /> Em destaque
              </span>
            )}
          </div>
          <h1 className="mt-3 text-[clamp(1.9rem,5vw,3rem)] font-bold break-words">{game.title}</h1>
          <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2">
            <StatusBadge status={game.playStatus} className="text-sm" />
            <StarRating value={game.ratingStars} size="text-base" />
            <span className="num text-sm text-muted">{formatHours(game.playTimeMinutes)}</span>
          </div>

          {game.needsReview && (
            <p className="mt-4 border border-amber/50 bg-amber-soft px-4 py-3 text-sm">
              Faltam dados da compra (mídia, preço pago e loja). Até lá, este jogo não entra nos cálculos de gastos.
            </p>
          )}

          {user && (
            <div className="mt-5 flex flex-wrap gap-2">
              <Link to={`/jogos/${game.id}/editar`} className="btn btn-primary">
                <FiEdit2 aria-hidden="true" /> Editar
              </Link>
              {wish && (
                <button type="button" className="btn btn-ghost" onClick={() => setBuying(true)}>
                  <FiShoppingCart aria-hidden="true" /> Marcar como comprado
                </button>
              )}
              <button type="button" className="btn btn-ghost" onClick={() => feature.mutate()} disabled={feature.isPending} aria-pressed={game.isFeatured}>
                <FiAward aria-hidden="true" /> {game.isFeatured ? 'Remover destaque' : 'Destacar'}
              </button>
              <button type="button" className="btn btn-danger" onClick={() => setConfirmDelete(true)}>
                <FiTrash2 aria-hidden="true" /> Excluir
              </button>
            </div>
          )}

          <div className="mt-7 grid gap-6 xl:grid-cols-2">
            <section aria-labelledby="compra" className="panel">
              <div className="panel-body p-4 sm:p-5">
                <h2 id="compra" className="mb-2 text-base text-muted">
                  {wish ? 'Preços acompanhados' : 'Compra'}
                </h2>
                {wish ? (
                  <dl >
                    <Readout label="Preço atual informado" value={game.currentWishPrice ? formatMoney(game.currentWishPrice) : 'Sem preço atual'} />
                    <Readout label="Atualizado em" value={formatDate(game.wishPriceUpdatedAt)} />
                    <Readout label="Preço de referência" value={formatMoney(game.originalPrice)} />
                  </dl>
                ) : (
                  <dl >
                    <Readout label="Preço original" value={formatMoney(game.originalPrice)} />
                    <Readout label="Preço pago" value={formatMoney(game.paidPrice)} strong />
                    {diff && <Readout label="Diferença" value={<span className={diff.tone}>{diff.label}</span>} />}
                    <Readout label="Onde comprou" value={game.store?.name ?? '—'} />
                    <Readout label="Data da compra" value={formatDate(game.purchasedAt)} />
                  </dl>
                )}
              </div>
            </section>

            <section aria-labelledby="categorias-titulo">
              <h2 id="categorias-titulo" className="mb-2 text-base text-muted">
                Categorias
              </h2>
              {game.categories.length ? (
                <ul className="flex list-none flex-wrap gap-1.5 p-0">
                  {game.categories.map((c) => (
                    <li key={c.id} className="tag">
                      {c.name}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-faint">Nenhuma categoria.</p>
              )}
            </section>
          </div>

          <section aria-labelledby="avaliacao" className="mt-7">
            <h2 id="avaliacao" className="mb-2 text-base text-muted">
              Avaliação
            </h2>
            {game.reviewText ? (
              <p className="max-w-[68ch] whitespace-pre-line text-[1.02rem] leading-relaxed">{game.reviewText}</p>
            ) : (
              <p className="text-sm text-faint">Ainda sem avaliação escrita.</p>
            )}
          </section>
        </div>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        title={`Excluir ${game.title}?`}
        confirmLabel="Excluir jogo"
        busy={remove.isPending}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => remove.mutate()}
      >
        O jogo, suas imagens e avaliações saem do banco de dados e as estatísticas são recalculadas. Não dá para desfazer.
      </ConfirmDialog>

      {buying && (
        <PurchaseDialog
          game={game}
          open
          onClose={() => setBuying(false)}
          onDone={() => setBuying(false)}
        />
      )}

      {viewer !== null && <Lightbox images={gallery} index={viewer} title={game.title} onChange={setViewer} onClose={() => setViewer(null)} />}
    </article>
  );
}

function Readout({ label, value, strong = false }) {
  return (
    <div className="readout">
      <dt className="text-sm text-muted">{label}</dt>
      <dd className={`text-right ${strong ? 'num text-lg text-ink' : 'text-sm'}`}>{value}</dd>
    </div>
  );
}

function Lightbox({ images, index, title, onChange, onClose }) {
  const ref = useRef(null);
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  const go = (delta) => onChange((index + delta + images.length) % images.length);
  const image = images[index];
  return (
    <dialog
      ref={ref}
      className="modal w-[min(60rem,calc(100vw-1rem))]"
      aria-label={`Imagem ${index + 1} de ${images.length}`}
      onClose={onClose}
      onKeyDown={(e) => {
        if (e.key === 'ArrowRight') go(1);
        if (e.key === 'ArrowLeft') go(-1);
      }}
    >
      <div className="flex items-center justify-between border-b border-line px-3 py-2">
        <span className="num text-sm text-muted">
          {index + 1} / {images.length}
        </span>
        <button type="button" className="btn btn-ghost btn-sm btn-icon" onClick={() => ref.current?.close()} aria-label="Fechar">
          <FiX aria-hidden="true" />
        </button>
      </div>
      <img src={image.url} alt={image.altText ?? `Imagem ${index + 1} de ${title}`} className="mx-auto max-h-[75dvh] w-auto object-contain" />
      <div className="flex justify-between border-t border-line p-2">
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => go(-1)}>
          <FiChevronLeft aria-hidden="true" /> Anterior
        </button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => go(1)}>
          Próxima <FiChevronRight aria-hidden="true" />
        </button>
      </div>
    </dialog>
  );
}
