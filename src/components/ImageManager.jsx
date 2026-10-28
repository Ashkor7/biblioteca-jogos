import { useId, useRef, useState } from 'react';
import { FiUpload, FiChevronLeft, FiChevronRight, FiTrash2, FiImage, FiLink } from 'react-icons/fi';
import { api } from '../services/api.js';
import { useLibraryMutation } from '../hooks/queries.js';
import { useToast } from '../hooks/useToast.js';
import ConfirmDialog from './ConfirmDialog.jsx';

const ACCEPT = 'image/jpeg,image/png,image/webp,image/gif,image/avif';

/** Galeria do jogo: enviar várias imagens, escolher capa, ordenar e remover. */
export default function ImageManager({ game }) {
  const toast = useToast();
  const inputId = useId();
  const fileInput = useRef(null);
  const [url, setUrl] = useState('');
  const [removing, setRemoving] = useState(null);
  const images = game.images;

  const onError = (error) => toast.error(error.message);
  const upload = useLibraryMutation((files) => api.uploadImages(game.id, files), {
    onSuccess: (_g, files) => {
      toast.success(files.length > 1 ? `${files.length} imagens enviadas.` : 'Imagem enviada.');
      if (fileInput.current) fileInput.current.value = '';
    },
    onError,
  });
  const addUrl = useLibraryMutation((value) => api.addImageUrl(game.id, value), {
    onSuccess: () => {
      setUrl('');
      toast.success('Imagem adicionada.');
    },
    onError,
  });
  const cover = useLibraryMutation((imageId) => api.setCover(game.id, imageId), {
    onSuccess: () => toast.success('Capa atualizada.'),
    onError,
  });
  const reorder = useLibraryMutation((ids) => api.reorderImages(game.id, ids), { onError });
  const remove = useLibraryMutation((imageId) => api.deleteImage(game.id, imageId), {
    onSuccess: () => {
      setRemoving(null);
      toast.success('Imagem removida.');
    },
    onError: (error) => {
      setRemoving(null);
      onError(error);
    },
  });

  function move(index, delta) {
    const ids = images.map((img) => img.id);
    const target = index + delta;
    if (target < 0 || target >= ids.length) return;
    [ids[index], ids[target]] = [ids[target], ids[index]];
    reorder.mutate(ids);
  }

  const busy = upload.isPending || reorder.isPending || cover.isPending || addUrl.isPending;

  return (
    <section aria-labelledby="galeria-titulo">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="galeria-titulo" className="text-lg">
            Imagens
          </h2>
          <p className="text-sm text-muted">
            {images.length ? `${images.length} ${images.length === 1 ? 'imagem' : 'imagens'}. A marcada como capa aparece nos cartões.` : 'Nenhuma imagem ainda.'}
          </p>
        </div>
        <div>
          <input
            ref={fileInput}
            id={inputId}
            type="file"
            accept={ACCEPT}
            multiple
            className="sr-only"
            onChange={(e) => {
              const files = [...(e.target.files ?? [])];
              if (files.length) upload.mutate(files);
            }}
          />
          <label htmlFor={inputId} className={`btn btn-ghost btn-sm ${upload.isPending ? 'pointer-events-none opacity-60' : ''}`}>
            <FiUpload aria-hidden="true" /> {upload.isPending ? 'Enviando…' : 'Enviar imagens'}
          </label>
        </div>
      </div>

      {images.length > 0 && (
        <ol className="mt-4 grid list-none grid-cols-2 gap-3 p-0 sm:grid-cols-3 md:grid-cols-4" aria-busy={busy}>
          {images.map((img, index) => (
            <li key={img.id} className={`border bg-panel-2 ${img.isCover ? 'border-cyan' : 'border-line'}`}>
              <div className="relative aspect-[4/3] bg-panel-3">
                <img src={img.url} alt={img.altText ?? `Imagem ${index + 1} de ${game.title}`} className="h-full w-full object-cover" loading="lazy" />
                {img.isCover && <span className="absolute left-0 top-0 bg-cyan px-2 py-0.5 text-xs font-semibold text-cyan-ink">Capa</span>}
              </div>
              <div className="flex flex-wrap items-center gap-1 p-1.5">
                <button type="button" className="btn btn-ghost btn-sm btn-icon" onClick={() => move(index, -1)} disabled={index === 0 || busy} aria-label={`Mover imagem ${index + 1} para trás`}>
                  <FiChevronLeft aria-hidden="true" />
                </button>
                <button type="button" className="btn btn-ghost btn-sm btn-icon" onClick={() => move(index, 1)} disabled={index === images.length - 1 || busy} aria-label={`Mover imagem ${index + 1} para frente`}>
                  <FiChevronRight aria-hidden="true" />
                </button>
                {!img.isCover && (
                  <button type="button" className="btn btn-ghost btn-sm btn-icon" onClick={() => cover.mutate(img.id)} disabled={busy} aria-label={`Usar imagem ${index + 1} como capa`} title="Usar como capa">
                    <FiImage aria-hidden="true" />
                  </button>
                )}
                <button type="button" className="btn btn-danger btn-sm btn-icon ml-auto" onClick={() => setRemoving(img)} disabled={busy} aria-label={`Remover imagem ${index + 1}`}>
                  <FiTrash2 aria-hidden="true" />
                </button>
              </div>
            </li>
          ))}
        </ol>
      )}

      <form
        className="mt-4 flex flex-col gap-2 sm:flex-row"
        onSubmit={(e) => {
          e.preventDefault();
          if (url.trim()) addUrl.mutate(url.trim());
        }}
      >
        <label htmlFor={`${inputId}-url`} className="sr-only">
          Adicionar imagem por URL
        </label>
        <input id={`${inputId}-url`} type="url" inputMode="url" className="input" placeholder="https://… (opcional: imagem por endereço)" value={url} onChange={(e) => setUrl(e.target.value)} />
        <button type="submit" className="btn btn-ghost" disabled={!url.trim() || addUrl.isPending}>
          <FiLink aria-hidden="true" /> Adicionar URL
        </button>
      </form>

      <ConfirmDialog
        open={Boolean(removing)}
        title="Remover imagem?"
        confirmLabel="Remover"
        busy={remove.isPending}
        onCancel={() => setRemoving(null)}
        onConfirm={() => remove.mutate(removing.id)}
      >
        O arquivo é apagado do servidor. Esta ação não pode ser desfeita.
      </ConfirmDialog>
    </section>
  );
}
