import { Link } from 'react-router';
import { FiArrowLeft, FiEye } from 'react-icons/fi';
import { useProfilePreview } from '../hooks/queries.js';
import PublicProfileView from '../components/PublicProfileView.jsx';
import { LoadingState, ErrorState } from '../components/States.jsx';

/** Prévia montada pelo servidor com as mesmas regras do endpoint público. */
export default function ProfilePreviewPage() {
  const preview = useProfilePreview();
  if (preview.isPending) return <LoadingState label="Montando a prévia…" />;
  if (preview.isError) return <ErrorState error={preview.error} onRetry={preview.refetch} />;
  return (
    <div>
      <div role="note" className="mb-6 flex flex-col gap-3 border border-violet/50 bg-violet-soft px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
        <p className="flex items-start gap-2">
          <FiEye className="mt-0.5 shrink-0 text-violet" aria-hidden="true" />
          <span>
            Prévia: é exatamente isto que um visitante recebe.{' '}
            {preview.data.isPublic ? (
              <strong className="text-ok">Seu perfil está público.</strong>
            ) : (
              <strong className="text-amber">Seu perfil está privado — visitantes ainda não veem nada.</strong>
            )}
          </span>
        </p>
        <Link to="/configuracoes#privacidade" className="btn btn-ghost btn-sm shrink-0">
          <FiArrowLeft aria-hidden="true" /> Ajustar privacidade
        </Link>
      </div>
      <PublicProfileView view={preview.data} preview />
    </div>
  );
}
