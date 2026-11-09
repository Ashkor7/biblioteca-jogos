import { useActivities } from '../hooks/queries.js';
import { useUrlFilters } from '../hooks/useUrlFilters.js';
import PageHeader from '../components/PageHeader.jsx';
import ActivityFeed from '../components/ActivityFeed.jsx';
import Pagination from '../components/Pagination.jsx';
import { LoadingState, ErrorState, EmptyState } from '../components/States.jsx';
import { ACTIVITY_TYPES } from '../../shared/progression.js';

const ORIGIN = [
  ['', 'Tudo'],
  ['false', 'Aconteceu de fato'],
  ['true', 'Retroativo'],
];

export default function ActivitiesPage() {
  const { filters, update } = useUrlFilters({ page: '1' });
  const activities = useActivities({
    type: filters.tipo,
    from: filters.de,
    to: filters.ate,
    retroactive: filters.origem,
    page: filters.page,
    pageSize: 30,
  });
  const set = (key) => (e) => update({ [key]: e.target.value, page: '1' });
  return (
    <div className="page-enter">
      <PageHeader title="Histórico de atividades">
        Tudo que aconteceu na biblioteca. Registros “retroativos” vieram do processamento de dados antigos e não aconteceram na
        data mostrada.
      </PageHeader>
      <form role="search" aria-label="Filtrar atividades" onSubmit={(e) => e.preventDefault()} className="mb-5 flex flex-wrap gap-2">
        <label className="block min-w-0 flex-[2_1_12rem]">
          <span className="text-xs text-muted">Tipo</span>
          <select className="input" value={filters.tipo ?? ''} onChange={set('tipo')}>
            <option value="">Todos os tipos</option>
            {Object.entries(ACTIVITY_TYPES).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="block min-w-0 flex-[1_1_9rem]">
          <span className="text-xs text-muted">De</span>
          <input type="date" className="input" value={filters.de ?? ''} onChange={set('de')} />
        </label>
        <label className="block min-w-0 flex-[1_1_9rem]">
          <span className="text-xs text-muted">Até</span>
          <input type="date" className="input" value={filters.ate ?? ''} onChange={set('ate')} />
        </label>
        <label className="block min-w-0 flex-[1_1_10rem]">
          <span className="text-xs text-muted">Origem</span>
          <select className="input" value={filters.origem ?? ''} onChange={set('origem')}>
            {ORIGIN.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </form>
      {activities.isPending ? (
        <LoadingState label="Carregando atividades…" />
      ) : activities.isError ? (
        <ErrorState error={activities.error} onRetry={activities.refetch} />
      ) : activities.data.items.length === 0 ? (
        <EmptyState title="Nenhuma atividade encontrada">Ajuste os filtros ou use a biblioteca para gerar novas atividades.</EmptyState>
      ) : (
        <div className="panel">
          <div className="panel-body p-4 sm:p-6">
            <ActivityFeed items={activities.data.items} />
            <Pagination
              page={activities.data.page}
              totalPages={activities.data.totalPages}
              total={activities.data.total}
              noun="atividades"
              onPage={(page) => update({ page: String(page) })}
            />
          </div>
        </div>
      )}
    </div>
  );
}
