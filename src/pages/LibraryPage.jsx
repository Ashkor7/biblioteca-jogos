import { Link } from 'react-router';
import { FiPlus } from 'react-icons/fi';
import PageHeader from '../components/PageHeader.jsx';
import LibraryBrowser from '../components/LibraryBrowser.jsx';

export default function LibraryPage() {
  return (
    <div className="page-enter">
      <PageHeader
        title="Biblioteca"
        actions={
          <Link to="/jogos/novo" className="btn btn-primary">
            <FiPlus aria-hidden="true" /> Adicionar jogo
          </Link>
        }
      >
        Todos os jogos adquiridos. Combine busca, plataforma, loja, categoria, estado, mídia, nota, faixa de preço, favoritos e
        coleções.
      </PageHeader>
      <LibraryBrowser />
    </div>
  );
}
