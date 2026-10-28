import { useEffect, useId, useRef, useState } from 'react';
import { NavLink, Link, Outlet, useNavigate } from 'react-router';
import {
  FiGrid,
  FiHeart,
  FiBarChart2,
  FiPlus,
  FiMenu,
  FiX,
  FiLogIn,
  FiLogOut,
  FiDownload,
} from 'react-icons/fi';
import { useAuth } from '../hooks/useAuth.js';
import { useToast } from '../hooks/useToast.js';
import { usePlatforms, useOverview } from '../hooks/queries.js';

function Wordmark() {
  return (
    <Link to="/" className="group inline-flex items-center gap-3 no-underline" aria-label="Biblioteca de Jogos — visão geral">
      <svg viewBox="0 0 32 32" className="h-9 w-9 shrink-0" aria-hidden="true">
        <path d="M4 3h18l6 6v20H4z" fill="#0c121c" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" className="text-cyan" />
        <rect x="9" y="8" width="11" height="10" className="fill-cyan" opacity=".9" />
        <path d="M9 23h4M15 23h2M19 23h4" stroke="#ffb547" strokeWidth="2" />
      </svg>
      <span className="font-display leading-none">
        <span className="block text-[1.05rem] font-bold text-ink">Biblioteca</span>
        <span className="block text-sm font-medium text-muted">de Jogos</span>
      </span>
    </Link>
  );
}

const linkClass = ({ isActive }) =>
  `flex min-h-11 items-center gap-3 px-3 text-[0.95rem] no-underline transition-colors ${
    isActive
      ? 'bg-cyan-soft text-cyan shadow-[inset_2px_0_0_var(--color-cyan)]'
      : 'text-ink hover:bg-panel-2 hover:text-cyan'
  }`;

function NavContent({ onNavigate }) {
  const { user, publicRead, logout } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const canRead = Boolean(user) || publicRead;
  const platforms = usePlatforms({ enabled: canRead });
  const overview = useOverview({}, { enabled: canRead });
  const wishlistCount = overview.data?.wishlist.count;
  const headingId = useId();

  async function handleLogout() {
    try {
      await logout();
      onNavigate?.();
      navigate('/login');
      toast.info('Sessão encerrada.');
    } catch (error) {
      toast.error(error.message);
    }
  }

  return (
    <div className="flex h-full flex-col">
      <nav aria-label="Principal" className="flex flex-col gap-0.5">
        <NavLink to="/" end className={linkClass} onClick={onNavigate}>
          <FiGrid aria-hidden="true" /> Visão geral
        </NavLink>
        <NavLink to="/desejos" className={linkClass} onClick={onNavigate}>
          <FiHeart aria-hidden="true" /> Lista de desejos
          {wishlistCount > 0 && <span className="num ml-auto text-xs text-magenta">{wishlistCount}</span>}
        </NavLink>
        <NavLink to="/estatisticas" className={linkClass} onClick={onNavigate}>
          <FiBarChart2 aria-hidden="true" /> Estatísticas
        </NavLink>
      </nav>

      {user && (
        <Link to="/jogos/novo" className="btn btn-primary mt-5 w-full" onClick={onNavigate}>
          <FiPlus aria-hidden="true" /> Adicionar jogo
        </Link>
      )}

      <nav aria-labelledby={headingId} className="mt-7 min-h-0 flex-1">
        <h2 id={headingId} className="mb-2 flex items-baseline justify-between px-3 text-sm font-semibold text-muted">
          Plataformas
          {platforms.data?.items.length > 0 && (
            <span className="num text-xs font-normal text-faint">{platforms.data.items.length}</span>
          )}
        </h2>
        {platforms.isPending && canRead && <div className="loading-bar mx-3" aria-label="Carregando plataformas" />}
        {platforms.isError && <p className="px-3 text-xs text-danger">Não foi possível carregar as plataformas.</p>}
        {platforms.data?.items.length === 0 && (
          <p className="px-3 text-xs leading-relaxed text-faint">
            Nenhuma ainda. Cada plataforma aparece aqui quando você cadastra o primeiro jogo dela.
          </p>
        )}
        <ul className="flex list-none flex-col gap-0.5 p-0">
          {platforms.data?.items.map((p) => (
            <li key={p.id}>
              <NavLink to={`/plataformas/${p.slug}`} className={linkClass} onClick={onNavigate}>
                <span className="min-w-0 flex-1 truncate">{p.name}</span>
                <span className="num text-xs text-faint">
                  {p.ownedCount}
                  <span className="sr-only"> adquiridos</span>
                </span>
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      <div className="mt-6 border-t border-line pt-4 text-sm">
        {user ? (
          <>
            <NavLink to="/importar" className={linkClass} onClick={onNavigate}>
              <FiDownload aria-hidden="true" /> Importar dados antigos
            </NavLink>
            <p className="mt-3 truncate px-3 text-xs text-faint" title={user.email}>
              {user.email}
            </p>
            <button type="button" onClick={handleLogout} className={`${linkClass({ isActive: false })} w-full`}>
              <FiLogOut aria-hidden="true" /> Sair
            </button>
          </>
        ) : (
          <NavLink to="/login" className={linkClass} onClick={onNavigate}>
            <FiLogIn aria-hidden="true" /> Entrar
          </NavLink>
        )}
      </div>
    </div>
  );
}

export default function Layout() {
  const [open, setOpen] = useState(false);
  const drawer = useRef(null);

  useEffect(() => {
    const d = drawer.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[16.5rem_1fr]">
      <a href="#conteudo" className="skip-link">
        Pular para o conteúdo
      </a>

      {/* Barra superior (celular/tablet) */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-line bg-void/95 px-4 py-3 backdrop-blur lg:hidden">
        <Wordmark />
        <button
          type="button"
          className="btn btn-ghost btn-icon"
          onClick={() => setOpen(true)}
          aria-label="Abrir menu"
          aria-expanded={open}
          aria-controls="menu-celular"
        >
          <FiMenu aria-hidden="true" />
        </button>
      </header>

      <dialog
        id="menu-celular"
        ref={drawer}
        aria-label="Menu"
        className="h-dvh max-h-dvh w-[min(20rem,88vw)] border-0 border-r border-line bg-panel p-0 text-ink backdrop:bg-black/70 lg:hidden"
        onClose={() => setOpen(false)}
        onClick={(e) => e.target === drawer.current && setOpen(false)}
      >
        <div className="flex h-full flex-col p-4">
          <div className="mb-6 flex items-center justify-between">
            <Wordmark />
            <button type="button" className="btn btn-ghost btn-icon" onClick={() => setOpen(false)} aria-label="Fechar menu">
              <FiX aria-hidden="true" />
            </button>
          </div>
          {open && <NavContent onNavigate={() => setOpen(false)} />}
        </div>
      </dialog>

      {/* Trilho lateral (desktop) */}
      <aside className="sticky top-0 hidden h-dvh overflow-y-auto border-r border-line bg-panel/80 px-4 py-6 lg:block">
        <div className="mb-8 px-1">
          <Wordmark />
        </div>
        <NavContent />
      </aside>

      <main id="conteudo" tabIndex={-1} className="min-w-0 px-4 pb-16 pt-6 outline-none sm:px-6 lg:px-10 lg:pt-10">
        <div className="mx-auto max-w-[78rem]">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
