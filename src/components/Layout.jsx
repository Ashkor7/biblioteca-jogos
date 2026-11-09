import { useEffect, useId, useRef, useState } from 'react';
import { NavLink, Link, Outlet, useNavigate } from 'react-router';
import {
  FiGrid,
  FiUser,
  FiBookOpen,
  FiHeart,
  FiBarChart2,
  FiPlus,
  FiMenu,
  FiX,
  FiLogIn,
  FiLogOut,
  FiDownload,
  FiClock,
  FiFolder,
  FiAward,
  FiSettings,
  FiActivity,
} from 'react-icons/fi';
import { useAuth } from '../hooks/useAuth.js';
import { useToast } from '../hooks/useToast.js';
import { usePlatforms, useOverview, useProfile } from '../hooks/queries.js';
import Avatar from './Avatar.jsx';
import XpBar from './XpBar.jsx';
import Celebrations from './Celebrations.jsx';

function Wordmark() {
  return (
    <Link to="/" className="group inline-flex items-center gap-3 no-underline" aria-label="Biblioteca de Jogos — visão geral">
      <svg viewBox="0 0 32 32" className="h-9 w-9 shrink-0" aria-hidden="true">
        <path d="M4 3h18l6 6v20H4z" fill="#0b111d" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" className="text-cyan" />
        <rect x="9" y="8" width="11" height="10" fill="#a88bff" opacity=".9" />
        <path d="M9 23h4M15 23h2M19 23h4" stroke="#ffb547" strokeWidth="2" />
      </svg>
      <span className="font-display leading-none">
        <span className="block text-[1.05rem] font-bold text-ink">Biblioteca</span>
        <span className="block text-sm font-medium text-muted">Player Hub</span>
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

const MAIN_LINKS = [
  { to: '/', label: 'Visão geral', icon: FiGrid, end: true },
  { to: '/perfil', label: 'Meu perfil', icon: FiUser },
  { to: '/biblioteca', label: 'Biblioteca', icon: FiBookOpen },
  { to: '/desejos', label: 'Lista de desejos', icon: FiHeart, wishlist: true },
  { to: '/diario', label: 'Diário de jogatina', icon: FiClock },
  { to: '/colecoes', label: 'Coleções', icon: FiFolder },
  { to: '/conquistas', label: 'Metas e conquistas', icon: FiAward },
  { to: '/atividades', label: 'Atividades', icon: FiActivity },
  { to: '/estatisticas', label: 'Estatísticas', icon: FiBarChart2 },
];

function PlayerCard({ onNavigate }) {
  const profile = useProfile();
  if (!profile.data) return <div className="loading-bar mx-1 mb-6" aria-label="Carregando perfil" />;
  const p = profile.data;
  return (
    <Link to="/perfil" onClick={onNavigate} className="panel panel-accent mb-6 block no-underline" aria-label={`Meu perfil: ${p.displayName}, nível ${p.progress.level}`}>
      <div className="panel-body flex items-center gap-3 p-3">
        <Avatar src={p.avatarUrl} name={p.displayName} size="sm" />
        <div className="min-w-0 flex-1">
          <p className="truncate font-display font-semibold text-ink">{p.displayName}</p>
          <p className="truncate text-xs text-amber">{p.title.name}</p>
          <div className="mt-1.5">
            <XpBar progress={p.progress} compact />
          </div>
        </div>
      </div>
    </Link>
  );
}

function NavContent({ onNavigate }) {
  const { user, logout } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const platforms = usePlatforms({ enabled: Boolean(user) });
  const overview = useOverview({}, { enabled: Boolean(user) });
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

  if (!user) {
    return (
      <nav aria-label="Principal">
        <NavLink to="/login" className={linkClass} onClick={onNavigate}>
          <FiLogIn aria-hidden="true" /> Entrar
        </NavLink>
      </nav>
    );
  }

  return (
    <div className="flex min-h-full flex-col">
      <PlayerCard onNavigate={onNavigate} />
      <nav aria-label="Principal" className="flex flex-col gap-0.5">
        {MAIN_LINKS.map(({ to, label, icon: Icon, end, wishlist }) => (
          <NavLink key={to} to={to} end={end} className={linkClass} onClick={onNavigate}>
            <Icon aria-hidden="true" /> {label}
            {wishlist && wishlistCount > 0 && <span className="num ml-auto text-xs text-magenta">{wishlistCount}</span>}
          </NavLink>
        ))}
      </nav>

      <Link to="/jogos/novo" className="btn btn-primary mt-5 w-full" onClick={onNavigate}>
        <FiPlus aria-hidden="true" /> Adicionar jogo
      </Link>

      <nav aria-labelledby={headingId} className="mt-7 flex-1">
        <h2 id={headingId} className="mb-2 flex items-baseline justify-between px-3 text-sm font-semibold text-muted">
          Plataformas
          {platforms.data?.items.length > 0 && (
            <span className="num text-xs font-normal text-faint">{platforms.data.items.length}</span>
          )}
        </h2>
        {platforms.isPending && <div className="loading-bar mx-3" aria-label="Carregando plataformas" />}
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
        <NavLink to="/configuracoes" className={linkClass} onClick={onNavigate}>
          <FiSettings aria-hidden="true" /> Configurações
        </NavLink>
        <NavLink to="/importar" className={linkClass} onClick={onNavigate}>
          <FiDownload aria-hidden="true" /> Importar dados antigos
        </NavLink>
        <p className="mt-3 truncate px-3 text-xs text-faint" title={user.email}>
          {user.email}
        </p>
        <button type="button" onClick={handleLogout} className={`${linkClass({ isActive: false })} w-full`}>
          <FiLogOut aria-hidden="true" /> Sair
        </button>
      </div>
    </div>
  );
}

const TAB_LINKS = [
  { to: '/', label: 'Início', icon: FiGrid, end: true },
  { to: '/biblioteca', label: 'Biblioteca', icon: FiBookOpen },
  { to: '/diario', label: 'Diário', icon: FiClock },
  { to: '/conquistas', label: 'Conquistas', icon: FiAward },
  { to: '/perfil', label: 'Perfil', icon: FiUser },
];

/** Barra inferior do celular: atalhos para as áreas mais usadas. */
function TabBar() {
  return (
    <nav aria-label="Atalhos" className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-void/95 backdrop-blur lg:hidden">
      <ul className="mx-auto grid max-w-lg list-none grid-cols-5 p-0">
        {TAB_LINKS.map(({ to, label, icon: Icon, end }) => (
          <li key={to}>
            <NavLink
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex min-h-14 flex-col items-center justify-center gap-0.5 text-[0.7rem] no-underline ${
                  isActive ? 'text-cyan' : 'text-muted hover:text-ink'
                }`
              }
            >
              <Icon aria-hidden="true" className="text-lg" />
              {label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export default function Layout() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const drawer = useRef(null);

  useEffect(() => {
    const d = drawer.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[17rem_1fr]">
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
        <div className="flex h-full flex-col overflow-y-auto p-4">
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
      <aside className="sticky top-0 hidden h-dvh overflow-y-auto border-r border-line bg-panel/70 px-4 py-6 backdrop-blur lg:block">
        <div className="mb-6 px-1">
          <Wordmark />
        </div>
        <NavContent />
      </aside>

      <main id="conteudo" tabIndex={-1} className={`min-w-0 px-4 pt-6 outline-none sm:px-6 lg:px-10 lg:pb-16 lg:pt-10 ${user ? 'pb-24' : 'pb-16'}`}>
        <div className="mx-auto max-w-[78rem]">
          <Outlet />
        </div>
      </main>

      {user && <TabBar />}
      {user && <Celebrations />}
    </div>
  );
}
