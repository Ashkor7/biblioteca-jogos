import { Link } from 'react-router';
import { EmptyState } from '../components/States.jsx';

export default function NotFoundPage() {
  return (
    <EmptyState title="Página não encontrada" action={<Link to="/" className="btn btn-ghost">Ir para a visão geral</Link>}>
      O endereço não existe ou foi alterado.
    </EmptyState>
  );
}
