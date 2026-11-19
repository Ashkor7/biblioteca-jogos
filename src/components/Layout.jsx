import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { NavLink, Link, Outlet, useLocation, useNavigate, useSearchParams } from 'react-router';
import { useIsFetching, useIsMutating } from '@tanstack/react-query';
import {
  FiGrid,
  FiUser,
  FiBookOpen,
  FiGift,
  FiBarChart2,
  FiPlus,
  FiPlusCircle,
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
  FiSearch,
  FiChevronDown,
  FiEye,
  FiMonitor,
  FiBell,
  FiBookmark,
  FiRefreshCw,
  FiCheckCircle,
  FiZap,
  FiArrowRight,
} from 'react-icons/fi';
import { useAuth } from '../hooks/useAuth.js';
import { useToast } from '../hooks/useToast.js';
import { useDismiss } from '../hooks/useDismiss.js';
import { useActivities, usePlatforms, useOverview, useProfile } from '../hooks/queries.js';
import Avatar from './Avatar.jsx';
import XpBar from './XpBar.jsx';
import Celebrations from './Celebrations.jsx';
import CityBackdrop from './CityBackdrop.jsx';
import { formatHours, formatPercent } from '../utils/format.js';
import { describeActivity, timeAgo } from '../utils/activity.js';
import { ACTIVITY_ICONS, ACTIVITY_TONE } from '../utils/hubIcons.js';
import { version } from '../../package.json';

const APP_NAME = 'Nexus Play';

/** Logotipo: controle em traço neon (ciano → violeta). */
function NexusLogo({ className = 'h-11 w-11' }) {
  const id = useId();
  return (
    <svg viewBox="0 0 48 48" className={`shrink-0 ${className}`} aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#39e1ea" />
          <stop offset="0.55" stopColor="#a88bff" />
          <stop offset="1" stopColor="#d946ef" />
        </linearGradient>
      </defs>
      <g fill="none" stroke={`url(#${id})`} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" style={{ filter: 'drop-shadow(0 0 4px #a88bff99)' }}>
        <path d="M15 14h18c5.5 0 8.5 3.5 9.6 9l1.7 9.4c.7 4-2.2 6.6-5.3 6.6-2.3 0-3.7-1.2-5-3l-2.6-3.6H21.6L19 36c-1.3 1.8-2.7 3-5 3-3.1 0-6-2.6-5.3-6.6L10.4 23c1.1-5.5 4.1-9 4.6-9z" />
        <path d="M17.5 21.5v7M14 25h7" />
        <circle cx="31.5" cy="22.5" r="1.3" />
        <circle cx="35.5" cy="26.5" r="1.3" />
        <path d="M21 9.5c1.2 1.6 2.4 2.4 3 4.5" />
      </g>
    </svg>
  );
}

function Wordmark() {
  return (
    <Link to="/" className="inline-flex shrink-0 items-center gap-3 no-underline" aria-label={`${APP_NAME} — visão geral`}>
      <NexusLogo className="h-9 w-9 sm:h-11 sm:w-11" />
      <span className="leading-none">
        <span className="brand-name block whitespace-nowrap text-[0.95rem] tracking-[0.1em] sm:text-[1.3rem] sm:tracking-[0.16em]">{APP_NAME}</span>
        <span className="brand-tagline mt-1 hidden whitespace-nowrap text-[0.66rem] sm:block">Biblioteca de jogos</span>
      </span>
    </Link>
  );
}

const MAIN_LINKS = [
  { to: '/', label: 'Visão geral', icon: FiGrid, end: true },
  { to: '/biblioteca', label: 'Biblioteca', icon: FiBookOpen },
  { to: '/desejos', label: 'Lista de desejos', icon: FiGift, wishlist: true },
  { to: '/diario', label: 'Diário', icon: FiClock },
  { to: '/colecoes', label: 'Coleções', icon: FiFolder },
  { to: '/conquistas', label: 'Conquistas', icon: FiAward },
  { to: '/atividades', label: 'Atividades', icon: FiActivity },
  { to: '/estatisticas', label: 'Estatísticas', icon: FiBarChart2 },
  { to: '/perfil', label: 'Perfil', icon: FiUser },
  { to: '/configuracoes', label: 'Configurações', icon: FiSettings, end: true },
];

/* ------------------------------------------------------------------ */
/* Topo                                                                */
/* ------------------------------------------------------------------ */

/**
 * Busca global: pesquisa os jogos adquiridos. Na página da biblioteca ela edita o
 * filtro da URL ao vivo; nas outras, Enter leva para a biblioteca já filtrada.
 * Ctrl+K (ou ⌘K) foca o campo.
 */
function GlobalSearch() {
  const location = useLocation();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const onLibrary = location.pathname === '/biblioteca';
  const [draft, setDraft] = useState('');
  const input = useRef(null);
  const value = onLibrary ? (params.get('search') ?? '') : draft;

  useEffect(() => {
    const onKey = (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        input.current?.focus();
        input.current?.select();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  function handleChange(text) {
    if (!onLibrary) return setDraft(text);
    setParams(
      (current) => {
        const next = new URLSearchParams(current);
        if (text) next.set('search', text);
        else next.delete('search');
        next.delete('page');
        return next;
      },
      { replace: true },
    );
  }

  function handleSubmit(event) {
    event.preventDefault();
    if (onLibrary) return;
    const text = draft.trim();
    navigate(text ? `/biblioteca?search=${encodeURIComponent(text)}` : '/biblioteca');
    setDraft('');
  }

  return (
    <form role="search" aria-label="Busca global" onSubmit={handleSubmit} className="w-full max-w-[26rem]">
      <div className="search-shell">
        <label htmlFor="busca-global" className="sr-only">
          Buscar na biblioteca
        </label>
        <FiSearch aria-hidden="true" className="pointer-events-none absolute left-3.5 text-lg text-ink" />
        <input
          ref={input}
          id="busca-global"
          type="search"
          autoComplete="off"
          placeholder="Buscar jogos, plataformas ou lojas…"
          value={value}
          onChange={(e) => handleChange(e.target.value)}
        />
        <span className="pointer-events-none absolute right-2.5 flex items-center" aria-hidden="true">
          <kbd className="kbd">Ctrl + K</kbd>
        </span>
      </div>
    </form>
  );
}

/** Sino: últimas atividades reais (conquistas, níveis, jogos adicionados…). */
function ActivityBell() {
  const [open, setOpen] = useState(false);
  const wrapper = useRef(null);
  const trigger = useRef(null);
  const panelId = useId();
  const close = useCallback(() => setOpen(false), []);
  useDismiss(open, close, wrapper, trigger);
  const activities = useActivities({ pageSize: 6 }, { enabled: open });

  return (
    <div ref={wrapper} className="relative">
      <button
        ref={trigger}
        type="button"
        className="icon-ring"
        aria-label="Atividades recentes"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
      >
        <FiBell aria-hidden="true" />
      </button>
      {open && (
        <div id={panelId} role="dialog" aria-label="Atividades recentes" className="menu-pop right-0 top-full mt-2 w-80 p-3">
          <p className="widget-title mb-2 text-sm">Atividades recentes</p>
          {activities.isPending ? (
            <div className="loading-bar my-3" />
          ) : activities.isError ? (
            <p className="text-sm text-danger">Não foi possível carregar.</p>
          ) : activities.data.items.length === 0 ? (
            <p className="text-sm text-faint">Nenhuma atividade ainda.</p>
          ) : (
            <ul className="grid list-none gap-2.5 p-0">
              {activities.data.items.map((a) => {
                const Icon = ACTIVITY_ICONS[a.type] ?? FiActivity;
                return (
                  <li key={a.id} className="flex gap-2.5">
                    <Icon aria-hidden="true" className={`mt-0.5 shrink-0 ${ACTIVITY_TONE[a.type] ?? 'text-cyan'}`} />
                    <div className="min-w-0">
                      <p className="text-sm leading-snug">{describeActivity(a)}</p>
                      <p className="text-xs text-cyan">{a.retroactive ? 'retroativo' : timeAgo(a.occurredAt)}</p>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          <Link to="/atividades" className="mt-3 inline-flex items-center gap-1 text-sm text-cyan" onClick={close}>
            Ver todas <FiArrowRight aria-hidden="true" />
          </Link>
        </div>
      )}
    </div>
  );
}

function AccountMenu() {
  const { user, logout } = useAuth();
  const profile = useProfile();
  const toast = useToast();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const wrapper = useRef(null);
  const trigger = useRef(null);
  const menuId = useId();
  const close = useCallback(() => setOpen(false), []);
  useDismiss(open, close, wrapper, trigger);

  async function handleLogout() {
    setOpen(false);
    try {
      await logout();
      navigate('/login');
      toast.info('Sessão encerrada.');
    } catch (error) {
      toast.error(error.message);
    }
  }

  const p = profile.data;
  const name = p?.displayName ?? user.email;
  return (
    <div ref={wrapper} className="relative">
      <button
        ref={trigger}
        type="button"
        className="flex min-h-11 items-center gap-3 rounded-full pr-1 text-left hover:text-cyan"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((v) => !v)}
      >
        <Avatar src={p?.avatarUrl} name={name} size="sm" className="!h-11 !w-11" />
        <span className="hidden min-w-0 leading-tight sm:block">
          <span className="block max-w-[10rem] truncate font-display font-semibold text-ink">{name}</span>
          {p && (
            <span className="mt-0.5 flex items-center gap-1 text-xs text-violet">
              <FiBookmark aria-hidden="true" /> Nv. <span className="num">{p.progress.level}</span>
            </span>
          )}
        </span>
        <FiChevronDown aria-hidden="true" className={`hidden text-muted transition-transform xs:block ${open ? 'rotate-180' : ''}`} />
        <span className="sr-only">Menu da conta</span>
      </button>
      {open && (
        <div id={menuId} role="menu" aria-label="Conta" className="menu-pop right-0 top-full mt-2 w-64">
          {p && (
            <div className="border-b border-line px-3 pb-3 pt-2">
              <p className="mb-2 truncate text-xs text-amber">{p.title.name}</p>
              <XpBar progress={p.progress} compact />
            </div>
          )}
          <div className="py-1">
            <Link role="menuitem" to="/perfil" className="menu-item" onClick={close}>
              <FiUser aria-hidden="true" /> Meu perfil
            </Link>
            <Link role="menuitem" to="/configuracoes/previa" className="menu-item" onClick={close}>
              <FiEye aria-hidden="true" /> Prévia do perfil público
            </Link>
            <Link role="menuitem" to="/configuracoes" className="menu-item" onClick={close}>
              <FiSettings aria-hidden="true" /> Configurações
            </Link>
            <Link role="menuitem" to="/importar" className="menu-item" onClick={close}>
              <FiDownload aria-hidden="true" /> Importar dados antigos
            </Link>
          </div>
          <div className="border-t border-line pt-1">
            <p className="truncate px-3 py-1.5 text-xs text-faint" title={user.email}>
              {user.email}
            </p>
            <button role="menuitem" type="button" className="menu-item" onClick={handleLogout}>
              <FiLogOut aria-hidden="true" /> Sair
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Topbar({ onOpenMenu, menuOpen }) {
  const { user } = useAuth();
  const onLogin = useLocation().pathname === '/login';
  return (
    <header className="topbar sticky top-0 z-30 lg:static">
      <div className="flex h-16 items-center gap-3 px-3 sm:px-5 lg:h-[5.25rem] lg:gap-6 lg:px-8">
        {user && (
          <button
            type="button"
            className="btn btn-ghost btn-icon lg:hidden"
            onClick={onOpenMenu}
            aria-label="Abrir menu"
            aria-expanded={menuOpen}
            aria-controls="menu-celular"
          >
            <FiMenu aria-hidden="true" />
          </button>
        )}
        <div className="min-w-0 lg:w-[19rem]">
          <Wordmark />
        </div>
        {user ? (
          <>
            <div className="hidden min-w-0 flex-1 md:block">
              <GlobalSearch />
            </div>
            <div className="ml-auto flex items-center gap-1 sm:gap-2">
              <Link to="/biblioteca" className="icon-ring hidden xs:inline-flex md:hidden" aria-label="Buscar na biblioteca">
                <FiSearch aria-hidden="true" />
              </Link>
              <ActivityBell />
              <Link to="/jogos/novo" className="icon-ring hidden sm:inline-flex" aria-label="Adicionar jogo" title="Adicionar jogo">
                <FiPlusCircle aria-hidden="true" />
              </Link>
              <span className="mx-1 hidden h-8 w-px bg-line sm:block" aria-hidden="true" />
              <AccountMenu />
            </div>
          </>
        ) : (
          !onLogin && (
            <Link to="/login" className="btn btn-ghost btn-sm ml-auto">
              <FiLogIn aria-hidden="true" /> Entrar
            </Link>
          )
        )}
      </div>
      <div className="neon-rule lg:hidden" />
    </header>
  );
}

/* ------------------------------------------------------------------ */
/* Navegação lateral                                                   */
/* ------------------------------------------------------------------ */

/** Cartão inferior da lateral (a arte "Play more" da referência), com a versão real do app. */
function PromoCard() {
  return (
    <div className="relative mt-4 overflow-hidden rounded-[14px] border border-[#a88bff66] [@media(max-height:50rem)]:hidden">
      <svg viewBox="0 0 200 230" className="absolute inset-0 h-full w-full" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
        <defs>
          <linearGradient id="promo-sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#0a0f2a" />
            <stop offset="0.6" stopColor="#2a1259" />
            <stop offset="1" stopColor="#5b1a7a" />
          </linearGradient>
          <linearGradient id="promo-tower" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#39e1ea" stopOpacity="0.9" />
            <stop offset="1" stopColor="#a88bff" stopOpacity="0.3" />
          </linearGradient>
        </defs>
        <rect width="200" height="230" fill="url(#promo-sky)" />
        <g fill="#160c3a" stroke="#d946ef" strokeOpacity="0.6">
          <rect x="6" y="150" width="22" height="80" />
          <rect x="30" y="125" width="18" height="105" />
          <rect x="150" y="135" width="20" height="95" />
          <rect x="172" y="155" width="24" height="75" />
          <rect x="50" y="165" width="16" height="65" />
          <rect x="132" y="170" width="16" height="60" />
        </g>
        <g fill="#120a30" stroke="#39e1ea" strokeOpacity="0.7">
          <rect x="104" y="150" width="16" height="80" />
          <rect x="146" y="140" width="16" height="90" />
          <path d="M124 230V122l8-22 8 22v108z" fill="url(#promo-tower)" />
        </g>
        <line x1="132" y1="100" x2="132" y2="78" stroke="#39e1ea" strokeWidth="1.5" />
        <rect y="222" width="200" height="8" fill="#d946ef" opacity="0.35" />
      </svg>
      <div className="relative flex min-h-[11.5rem] flex-col justify-between p-4">
        <p className="font-display text-[1rem] font-semibold uppercase leading-snug tracking-wide text-ink [text-shadow:0_1px_6px_#04060f]">
          Jogue mais
          <br />
          Descubra mais
          <br />
          Seja mais
        </p>
        <div className="flex items-center justify-between rounded-md bg-[#04060fb3] px-2 py-1.5 text-[0.68rem] uppercase tracking-wider text-muted">
          <span className="flex items-center gap-1.5">
            <NexusLogo className="h-4 w-4" /> {APP_NAME}
          </span>
          <span className="num">v{version}</span>
        </div>
      </div>
    </div>
  );
}

function PlatformsNav({ onNavigate }) {
  const { user } = useAuth();
  const location = useLocation();
  const platforms = usePlatforms({ enabled: Boolean(user) });
  const onPlatform = location.pathname.startsWith('/plataformas/');
  const items = platforms.data?.items ?? [];
  return (
    <details className="group mt-2" open={onPlatform || undefined}>
      <summary className="nav-item cursor-pointer list-none [&::-webkit-details-marker]:hidden">
        <FiMonitor aria-hidden="true" /> Plataformas
        <span className="num ml-auto text-xs text-faint">{items.length || ''}</span>
        <FiChevronDown aria-hidden="true" className="!text-sm !text-muted transition-transform group-open:rotate-180" />
      </summary>
      {platforms.isPending && <div className="loading-bar mx-3 my-2" aria-label="Carregando plataformas" />}
      {platforms.isError && <p className="px-3 text-xs text-danger">Não foi possível carregar as plataformas.</p>}
      {platforms.data && items.length === 0 && (
        <p className="px-4 py-2 text-xs leading-relaxed text-faint">Cada plataforma aparece aqui quando você cadastra o primeiro jogo dela.</p>
      )}
      <ul className="mt-1 flex list-none flex-col gap-0.5 p-0 pl-4">
        {items.map((p) => (
          <li key={p.id}>
            <NavLink to={`/plataformas/${p.slug}`} className="nav-item min-h-9 text-sm" onClick={onNavigate}>
              <span className="min-w-0 flex-1 truncate">{p.name}</span>
              <span className="num text-xs text-faint">
                {p.ownedCount}
                <span className="sr-only"> adquiridos</span>
              </span>
            </NavLink>
          </li>
        ))}
      </ul>
    </details>
  );
}

function NavContent({ onNavigate }) {
  const { user } = useAuth();
  const overview = useOverview({}, { enabled: Boolean(user) });
  const wishlistCount = overview.data?.wishlist.count;

  return (
    <div className="flex min-h-full flex-col">
      <nav aria-label="Principal" className="flex flex-col gap-0.5">
        {MAIN_LINKS.map(({ to, label, icon: Icon, end, wishlist }) => (
          <NavLink key={to} to={to} end={end} className="nav-item" onClick={onNavigate}>
            <Icon aria-hidden="true" /> {label}
            {wishlist && wishlistCount > 0 && <span className="num ml-auto text-xs text-magenta">{wishlistCount}</span>}
          </NavLink>
        ))}
        <PlatformsNav onNavigate={onNavigate} />
      </nav>
      <div className="mt-auto">
        <PromoCard />
      </div>
    </div>
  );
}

/** Menu do celular/tablet: além da navegação, traz as ações que o topo esconde. */
function MobileMenuExtras({ onNavigate }) {
  const { logout } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  async function handleLogout() {
    try {
      await logout();
      onNavigate();
      navigate('/login');
      toast.info('Sessão encerrada.');
    } catch (error) {
      toast.error(error.message);
    }
  }
  return (
    <div className="mt-6 flex flex-col gap-1 border-t border-line pt-4">
      <Link to="/jogos/novo" className="btn btn-primary mb-2 w-full" onClick={onNavigate}>
        <FiPlus aria-hidden="true" /> Adicionar jogo
      </Link>
      <NavLink to="/importar" className="nav-item" onClick={onNavigate}>
        <FiDownload aria-hidden="true" /> Importar dados antigos
      </NavLink>
      <button type="button" onClick={handleLogout} className="nav-item w-full bg-transparent text-left">
        <FiLogOut aria-hidden="true" /> Sair
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Barras inferiores                                                   */
/* ------------------------------------------------------------------ */

function SignalBars({ online }) {
  return (
    <svg viewBox="0 0 20 16" className={`h-4 w-5 ${online ? 'text-cyan' : 'text-faint'}`} aria-hidden="true">
      {[0, 1, 2, 3].map((i) => (
        <rect key={i} x={i * 5} y={12 - i * 4} width="3" height={4 + i * 4} rx="1" fill="currentColor" opacity={online ? 1 : 0.4} />
      ))}
    </svg>
  );
}

/**
 * Rodapé do desktop no formato da barra de downloads da referência, só com dados reais:
 * estado da sincronização com a API, progresso de conclusão da coleção e conexão.
 */
function StatusBar() {
  const { user } = useAuth();
  const saving = useIsMutating();
  const fetching = useIsFetching();
  const overview = useOverview({}, { enabled: Boolean(user) });
  const lib = overview.data?.library;
  const offline = overview.isError;
  const percent = lib?.owned ? (lib.completed / lib.owned) * 100 : 0;
  const sync = saving
    ? { text: 'Salvando…', icon: FiRefreshCw, tone: 'text-amber', spin: true }
    : fetching
      ? { text: 'Sincronizando…', icon: FiRefreshCw, tone: 'text-cyan', spin: true }
      : { text: 'Sincronizado', icon: FiCheckCircle, tone: 'text-ok', spin: false };
  const SyncIcon = sync.icon;

  return (
    <footer className="hud-panel mx-5 mb-5 hidden h-14 shrink-0 items-center gap-6 px-6 text-sm lg:flex">
      <span className="flex shrink-0 items-center gap-2.5">
        <SyncIcon aria-hidden="true" className={`text-lg ${sync.tone} ${sync.spin ? 'animate-spin' : ''}`} />
        <span className="text-ink">{sync.text}</span>
      </span>
      <span className="h-7 w-px bg-line" aria-hidden="true" />
      {lib && (
        <div className="flex min-w-0 flex-1 items-center gap-5">
          <span className="shrink-0 text-muted">Coleção concluída</span>
          <div
            className="neon-progress min-w-24 flex-1"
            role="progressbar"
            aria-label="Jogos zerados na coleção"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(percent)}
          >
            <span style={{ width: `${percent}%` }} />
          </div>
          <span className="num shrink-0 text-ink">
            {lib.completed} / {lib.owned} ({formatPercent(percent)})
          </span>
          <span className="flex shrink-0 items-center gap-1.5 text-ink">
            <FiZap aria-hidden="true" className="text-cyan" />
            <span className="num">{formatHours(overview.data.playTime.totalMinutes)}</span>
            <span className="hidden text-muted xl:inline">registradas</span>
          </span>
        </div>
      )}
      <span className="h-7 w-px bg-line" aria-hidden="true" />
      <span className="flex shrink-0 items-center gap-2.5">
        <span className={`led ${offline ? 'text-danger' : 'text-ok'}`} aria-hidden="true" />
        <span className="text-ink">{offline ? 'Offline — servidor indisponível' : 'Online — servidor conectado'}</span>
        <SignalBars online={!offline} />
      </span>
    </footer>
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
    <nav aria-label="Atalhos" className="topbar fixed inset-x-0 bottom-0 z-30 lg:hidden">
      <div className="neon-rule" />
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

/* ------------------------------------------------------------------ */

export default function Layout() {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const drawer = useRef(null);
  const main = useRef(null);

  useEffect(() => {
    const d = drawer.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  // No desktop o conteúdo rola dentro da moldura: volta ao topo ao trocar de página.
  useEffect(() => {
    main.current?.scrollTo?.(0, 0);
  }, [pathname]);

  return (
    <div className="min-h-dvh lg:h-dvh lg:p-4 xl:px-8">
      <a href="#conteudo" className="skip-link">
        Pular para o conteúdo
      </a>
      <CityBackdrop />
      <div className="app-frame flex min-h-dvh flex-col lg:h-full lg:min-h-0 lg:overflow-hidden">
        <Topbar onOpenMenu={() => setOpen(true)} menuOpen={open} />

        {user && (
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
              {open && (
                <>
                  <NavContent onNavigate={() => setOpen(false)} />
                  <MobileMenuExtras onNavigate={() => setOpen(false)} />
                </>
              )}
            </div>
          </dialog>
        )}

        <div className={`flex-1 lg:min-h-0 ${user ? 'lg:grid lg:grid-cols-[16.5rem_minmax(0,1fr)] lg:gap-5 lg:px-5 lg:pb-5' : ''}`}>
          {user && (
            <aside aria-label="Navegação lateral" className="hud-panel hidden overflow-y-auto p-3 lg:block">
              <NavContent />
            </aside>
          )}

          <main
            ref={main}
            id="conteudo"
            tabIndex={-1}
            className={`min-w-0 px-4 pt-5 outline-none sm:px-6 lg:min-h-0 lg:overflow-y-auto lg:px-0 lg:pb-1 lg:pt-0 ${user ? 'pb-24' : 'pb-16'}`}
          >
            <div className="@container mx-auto max-w-[120rem]">
              <Outlet />
            </div>
          </main>
        </div>

        {user && <StatusBar />}
      </div>
      {user && <TabBar />}
      {user && <Celebrations />}
    </div>
  );
}
