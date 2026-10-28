import { Navigate, useLocation } from 'react-router';
import { useAuth } from '../hooks/useAuth.js';
import { LoadingState, ErrorState } from './States.jsx';

/**
 * mode="write": exige proprietário logado.
 * mode="read": exige login, a menos que a API esteja em modo leitura pública.
 * (Proteção de verdade está no backend; isto só evita telas inúteis.)
 */
export default function RequireAuth({ children, mode = 'write' }) {
  const { user, publicRead, isLoading, error, refetch } = useAuth();
  const location = useLocation();
  if (isLoading) return <LoadingState label="Verificando sessão…" />;
  if (error) return <ErrorState error={error} onRetry={refetch} title="Servidor indisponível" />;
  if (user || (mode === 'read' && publicRead)) return children;
  return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
}
