import { useState } from 'react';
import { FiPlus } from 'react-icons/fi';
import { api } from '../services/api.js';
import { useGoals, useLibraryMutation } from '../hooks/queries.js';
import { useToast } from '../hooks/useToast.js';
import { useUrlFilters } from '../hooks/useUrlFilters.js';
import PageHeader from '../components/PageHeader.jsx';
import SectionTitle from '../components/SectionTitle.jsx';
import GoalCard from '../components/GoalCard.jsx';
import GoalDialog from '../components/GoalDialog.jsx';
import ConfirmDialog from '../components/ConfirmDialog.jsx';
import { LoadingState, ErrorState, EmptyState } from '../components/States.jsx';
import { todayIn } from '../../shared/domain.js';

export default function GoalsPage() {
  const toast = useToast();
  const currentYear = Number(todayIn().slice(0, 4));
  const { filters, update } = useUrlFilters({ ano: '' });
  const goals = useGoals(filters.ano ? { year: filters.ano } : {});
  const [editing, setEditing] = useState(null);
  const [removing, setRemoving] = useState(null);
  const remove = useLibraryMutation((g) => api.deleteGoal(g.id), {
    onSuccess: () => {
      setRemoving(null);
      toast.success('Meta excluída.');
    },
    onError: (error) => {
      setRemoving(null);
      toast.error(error.message);
    },
  });
  const addButton = (
    <button type="button" className="btn btn-primary" onClick={() => setEditing('new')}>
      <FiPlus aria-hidden="true" /> Nova meta
    </button>
  );
  const items = goals.data?.items ?? [];
  const groups = [
    ['Em andamento', items.filter((g) => g.status === 'ACTIVE' || g.status === 'UPCOMING'), 'cyan'],
    ['Concluídas', items.filter((g) => g.status === 'COMPLETED'), 'violet'],
    ['Encerradas sem concluir', items.filter((g) => g.status === 'CLOSED'), 'amber'],
  ];

  return (
    <div className="page-enter space-y-8">
      <PageHeader title="Minhas metas" actions={addButton}>
        O progresso usa os dados reais: jogos zerados (com data de conclusão) e sessões do diário. Criar ou editar metas não dá XP;
        concluir dá.
      </PageHeader>
      <label className="block max-w-xs">
        <span className="field-label">Período</span>
        <select className="input" value={filters.ano} onChange={(e) => update({ ano: e.target.value })}>
          <option value="">Todas as metas</option>
          {Array.from({ length: 6 }, (_, i) => currentYear + 1 - i).map((y) => (
            <option key={y} value={y}>
              Metas de {y}
            </option>
          ))}
        </select>
      </label>
      {goals.isPending ? (
        <LoadingState label="Calculando metas…" />
      ) : goals.isError ? (
        <ErrorState error={goals.error} onRetry={goals.refetch} />
      ) : items.length === 0 ? (
        <EmptyState title="Nenhuma meta ainda" action={addButton}>
          Ex.: zerar 20 jogos no ano, jogar 200 horas, concluir 5 RPGs ou tirar 10 jogos do acervo parado.
        </EmptyState>
      ) : (
        groups
          .filter(([, list]) => list.length)
          .map(([title, list, accent]) => (
            <section key={title} aria-label={title}>
              <SectionTitle title={title} accent={accent} />
              <ul className="grid list-none gap-3 p-0 sm:grid-cols-2 xl:grid-cols-3">
                {list.map((g) => (
                  <li key={g.id}>
                    <GoalCard goal={g} onEdit={setEditing} onDelete={setRemoving} />
                  </li>
                ))}
              </ul>
            </section>
          ))
      )}
      {editing && <GoalDialog goal={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
      <ConfirmDialog
        open={Boolean(removing)}
        title={`Excluir a meta “${removing?.name ?? ''}”?`}
        confirmLabel="Excluir meta"
        busy={remove.isPending}
        onCancel={() => setRemoving(null)}
        onConfirm={() => remove.mutate(removing)}
      >
        A meta sai da lista. O XP já recebido e os jogos não mudam.
      </ConfirmDialog>
    </div>
  );
}
