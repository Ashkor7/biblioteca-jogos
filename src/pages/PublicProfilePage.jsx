import { useParams } from 'react-router';
import { usePublicProfile } from '../hooks/queries.js';
import PublicProfileView from '../components/PublicProfileView.jsx';
import { LoadingState, ErrorState, EmptyState } from '../components/States.jsx';

export default function PublicProfilePage() {
  const { username } = useParams();
  const profile = usePublicProfile(username);
  if (profile.isPending) return <LoadingState label="Carregando perfil…" />;
  if (profile.isError) {
    if (profile.error.status === 404) {
      return (
        <EmptyState title="Perfil indisponível">
          Este perfil não existe ou não está público. Se foi você quem compartilhou, confira as configurações de privacidade.
        </EmptyState>
      );
    }
    return <ErrorState error={profile.error} onRetry={profile.refetch} />;
  }
  return <PublicProfileView view={profile.data} />;
}
