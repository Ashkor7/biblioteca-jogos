import { Link, Outlet } from 'react-router';
import { useAuth } from '../hooks/useAuth.js';

/** Moldura do perfil público: sem menu administrativo nem botões de edição. */
export default function PublicLayout() {
  const { user } = useAuth();
  return (
    <div className="min-h-dvh">
      <a href="#conteudo" className="skip-link">
        Pular para o conteúdo
      </a>
      <header className="border-b border-line bg-void/90 backdrop-blur">
        <div className="mx-auto flex max-w-[72rem] items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <p className="font-display font-semibold text-muted">
            <span className="text-ink">Biblioteca de Jogos</span> · perfil público
          </p>
          {user && (
            <Link to="/" className="btn btn-ghost btn-sm">
              Voltar à minha biblioteca
            </Link>
          )}
        </div>
      </header>
      <main id="conteudo" tabIndex={-1} className="mx-auto max-w-[72rem] px-4 pb-16 pt-6 outline-none sm:px-6">
        <Outlet />
      </main>
    </div>
  );
}
