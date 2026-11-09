import { Navigate, useLocation } from 'react-router';
import { useAuth } from '../hooks/useAuth.js';
import { LoadingState, ErrorState } from './States.jsx';

/**
 * Área do proprietário: exige login. Visitantes usam só o perfil público (/u/:username).
 * (A proteção de verdade está no backend; isto só evita telas inúteis.)
 */
export default function RequireAuth({ children }) {
  const { user, isLoading, error, refetch } = useAuth();
  const location = useLocation();
  if (isLoading) return <LoadingState label="Verificando sessão…" />;
  if (error) return <ErrorState error={error} onRetry={refetch} title="Servidor indisponível" />;
  if (user) return children;
  return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
}
