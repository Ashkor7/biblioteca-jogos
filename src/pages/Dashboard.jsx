import { Link } from 'react-router';
import { FiPlus, FiAward } from 'react-icons/fi';
import { useGames, useOverview, useCategories, usePlatforms } from '../hooks/queries.js';
import { useAuth } from '../hooks/useAuth.js';
import { useUrlFilters } from '../hooks/useUrlFilters.js';
import PageHeader from '../components/PageHeader.jsx';
import FilterBar from '../components/FilterBar.jsx';
import { GameGrid } from '../components/GameCard.jsx';
import CoverImage from '../components/CoverImage.jsx';
import StatusBadge from '../components/StatusBadge.jsx';
import { StarRating } from '../components/StarRating.jsx';
import Pagination from '../components/Pagination.jsx';
import { ReadoutStrip } from '../components/Readouts.jsx';
import { LoadingState, ErrorState, EmptyState } from '../components/States.jsx';
import { formatHours } from '../utils/format.js';

const DEFAULTS = { sort: 'featured', page: '1' };

export default function Dashboard() {
  const { user } = useAuth();
  const overview = useOverview();
  const { filters, queryFilters, update } = useUrlFilters(DEFAULTS);
  const categories = useCategories();
  const platforms = usePlatforms();
  const library = useGames({ ...queryFilters, ownership: 'OWNED', pageSize: 40 });
  const featured = useGames({ ownership: 'ALL', sort: 'featured', pageSize: 1 });
  const recent = useGames({ ownership: 'OWNED', sort: 'recent', pageSize: 6 });

  if (overview.isPending) return <LoadingState label="Carregando biblioteca…" />;
  if (overview.isError) return <ErrorState error={overview.error} onRetry={overview.refetch} />;

  const stats = overview.data;
  const totalGames = stats.library.owned + stats.wishlist.count;
  const ownedPlatforms = platforms.data ? platforms.data.items.filter((p) => p.ownedCount > 0).length : null;
  const spotlight = featured.data?.items[0]?.isFeatured ? featured.data.items[0] : null;
  const filtering = Boolean(filters.search || filters.status || filters.media || filters.categoryId || filters.platform);
  const addButton = user && (
    <Link to="/jogos/novo" className="btn btn-primary">
      <FiPlus aria-hidden="true" /> Adicionar jogo
    </Link>
  );

  if (totalGames === 0) {
    return (
      <div className="page-enter">
        <PageHeader title="Sua biblioteca" />
        <EmptyState
          title="Nenhum jogo cadastrado ainda"
          action={
            user ? (
              <div className="flex flex-wrap justify-center gap-2">
                {addButton}
                <Link to="/importar" className="btn btn-ghost">
                  Importar da versão antiga
                </Link>
              </div>
            ) : null
          }
        >
          Cadastre o primeiro jogo informando a plataforma (Xbox, Wii, Steam…). A página da plataforma aparece no menu
          automaticamente.
        </EmptyState>
      </div>
    );
  }

  return (
    <div className="page-enter space-y-8">
      <PageHeader title="Sua biblioteca" actions={addButton}>
        {stats.library.owned} {stats.library.owned === 1 ? 'jogo adquirido' : 'jogos adquiridos'}
        {ownedPlatforms !== null && ` em ${ownedPlatforms} ${ownedPlatforms === 1 ? 'plataforma' : 'plataformas'}`}.
      </PageHeader>

      {spotlight && <Spotlight game={spotlight} />}

      <ReadoutStrip
        label="Resumo da biblioteca"
        items={[
          { label: 'Na biblioteca', value: stats.library.owned },
          { label: 'Zerados', value: stats.library.completed, tone: 'text-ok' },
          { label: 'Na lista de desejos', value: stats.wishlist.count, tone: 'text-magenta' },
          { label: 'Horas jogadas', value: formatHours(stats.playTime.totalMinutes) },
        ]}
      />

      {!filtering && recent.data?.items.length > 0 && (
        <section aria-labelledby="recentes">
          <h2 id="recentes" className="mb-3 text-xl">
            Adicionados recentemente
          </h2>
          <ul className="grid list-none grid-cols-3 gap-3 p-0 sm:grid-cols-6">
            {recent.data.items.map((g) => (
              <li key={g.id}>
                <Link to={`/jogos/${g.id}`} className="block border border-line hover:border-cyan" aria-label={g.title}>
                  <CoverImage src={g.coverUrl} title={g.title} platform={g.platform.name} />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="acervo">
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <h2 id="acervo" className="text-xl">
            Acervo
          </h2>
          {library.data && <span className="num text-sm text-muted">{library.data.total} resultados</span>}
        </div>
        <FilterBar
          filters={filters}
          onChange={(patch) => update({ ...patch, page: '1' })}
          categories={categories.data?.items}
          platforms={platforms.data?.items.filter((p) => p.ownedCount > 0)}
          show={['platform', 'status', 'category', 'sort']}
          label="Filtrar acervo"
        />
        {library.isPending ? (
          <LoadingState />
        ) : library.isError ? (
          <ErrorState error={library.error} onRetry={library.refetch} />
        ) : library.data.items.length === 0 ? (
          <EmptyState title="Nada encontrado">Ajuste a busca ou os filtros.</EmptyState>
        ) : (
          <>
            <GameGrid games={library.data.items} />
            <Pagination
              page={library.data.page}
              totalPages={library.data.totalPages}
              total={library.data.total}
              onPage={(page) => update({ page: String(page) })}
            />
          </>
        )}
      </section>
    </div>
  );
}

function Spotlight({ game }) {
  return (
    <section aria-label="Jogo em destaque" className="panel bg-amber/70">
      <div className="panel-body grid grid-cols-[6.5rem_1fr] gap-4 p-3 sm:grid-cols-[10rem_1fr] sm:gap-6 sm:p-5">
        <Link to={`/jogos/${game.id}`} tabIndex={-1} aria-hidden="true">
          <CoverImage src={game.coverUrl} title={game.title} platform={game.platform.name} />
        </Link>
        <div className="flex min-w-0 flex-col">
          <p className="inline-flex items-center gap-1.5 text-sm font-semibold text-amber">
            <FiAward aria-hidden="true" /> Em destaque
          </p>
          <h2 className="mt-1 text-[clamp(1.35rem,3.2vw,2.1rem)] font-bold break-words">
            <Link to={`/jogos/${game.id}`} className="text-ink no-underline hover:text-cyan">
              {game.title}
            </Link>
          </h2>
          <p className="mt-1 text-sm text-muted">{game.platform.name}</p>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
            {game.ownershipStatus === 'OWNED' && <StatusBadge status={game.playStatus} />}
            <StarRating value={game.ratingStars} />
          </div>
          {game.reviewText && (
            <p className="mt-3 line-clamp-2 max-w-[62ch] text-sm text-ink/90 sm:line-clamp-3">{game.reviewText}</p>
          )}
        </div>
      </div>
    </section>
  );
}
