import { useState } from 'react';
import { FiTarget } from 'react-icons/fi';
import { api } from '../services/api.js';
import { useCategories, useLibraryMutation } from '../hooks/queries.js';
import { useToast } from '../hooks/useToast.js';
import Modal, { ModalActions } from './Modal.jsx';
import { Field } from './Field.jsx';
import { GOAL_TYPE_LABELS, LIMITS, todayIn } from '../../shared/domain.js';

const UNIT = { COMPLETE_GAMES: 'jogos', PLAY_HOURS: 'horas', COMPLETE_CATEGORY: 'jogos', COMPLETE_BACKLOG: 'jogos' };
const HINT = {
  COMPLETE_GAMES: 'Jogos adquiridos marcados como zerados dentro do período.',
  PLAY_HOURS: 'Soma das sessões do diário no período (o saldo antigo sem data não entra).',
  COMPLETE_CATEGORY: 'Jogos zerados no período que tenham a categoria escolhida.',
  COMPLETE_BACKLOG: 'Jogos zerados no período que já estavam na biblioteca antes do início da meta.',
};

/** Criar ou editar meta. O progresso é sempre calculado no servidor. */
export default function GoalDialog({ goal = null, onClose }) {
  const toast = useToast();
  const year = todayIn().slice(0, 4);
  const categories = useCategories();
  const [form, setForm] = useState({
    name: goal?.name ?? '',
    type: goal?.type ?? 'COMPLETE_GAMES',
    startsOn: goal?.startsOn ?? `${year}-01-01`,
    endsOn: goal?.endsOn ?? `${year}-12-31`,
    targetValue: goal ? String(goal.targetValue) : '',
    categoryName: goal?.categoryName ?? '',
  });
  const [errors, setErrors] = useState({});
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const save = useLibraryMutation(
    () => {
      const payload = {
        ...form,
        targetValue: Number(form.targetValue),
        categoryName: form.type === 'COMPLETE_CATEGORY' ? form.categoryName : null,
      };
      return goal ? api.updateGoal(goal.id, payload) : api.createGoal(payload);
    },
    {
      onSuccess: () => {
        toast.success(goal ? 'Meta atualizada.' : 'Meta criada.');
        onClose();
      },
      onError: (error) => {
        setErrors(error.fields ?? {});
        if (!error.fields || !Object.keys(error.fields).length) toast.error(error.message);
      },
    },
  );
  return (
    <Modal title={goal ? 'Editar meta' : 'Nova meta'} icon={FiTarget} onClose={onClose} busy={save.isPending}>
      <form
        noValidate
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          const local = {};
          if (!form.name.trim()) local.name = 'Dê um nome para a meta';
          if (!/^\d+$/.test(form.targetValue) || Number(form.targetValue) < 1) local.targetValue = 'Use um número inteiro a partir de 1';
          setErrors(local);
          if (!Object.keys(local).length) save.mutate();
        }}
      >
        <Field label="Nome" error={errors.name} hint={`Ex.: Zerar 20 jogos em ${year}`}>
          {(a11y) => <input {...a11y} className="input" value={form.name} onChange={set('name')} maxLength={LIMITS.goalNameMax} autoFocus />}
        </Field>
        <Field label="Tipo de objetivo" error={errors.type} hint={HINT[form.type]}>
          {(a11y) => (
            <select {...a11y} className="input" value={form.type} onChange={set('type')}>
              {Object.entries(GOAL_TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          )}
        </Field>
        {form.type === 'COMPLETE_CATEGORY' && (
          <Field label="Categoria" error={errors.categoryName}>
            {(a11y) => (
              <>
                <input {...a11y} className="input" list="goal-categories" value={form.categoryName} onChange={set('categoryName')} maxLength={LIMITS.categoryMax} />
                <datalist id="goal-categories">
                  {categories.data?.items.map((c) => (
                    <option key={c.id} value={c.name} />
                  ))}
                </datalist>
              </>
            )}
          </Field>
        )}
        <Field label={`Objetivo (${UNIT[form.type]})`} error={errors.targetValue}>
          {(a11y) => <input {...a11y} className="input num max-w-40" inputMode="numeric" value={form.targetValue} onChange={set('targetValue')} />}
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Início" error={errors.startsOn}>
            {(a11y) => <input {...a11y} type="date" className="input" value={form.startsOn} onChange={set('startsOn')} />}
          </Field>
          <Field label="Fim" error={errors.endsOn}>
            {(a11y) => <input {...a11y} type="date" className="input" value={form.endsOn} min={form.startsOn} onChange={set('endsOn')} />}
          </Field>
        </div>
        <ModalActions onCancel={onClose} busy={save.isPending} submitLabel={goal ? 'Salvar meta' : 'Criar meta'} />
      </form>
    </Modal>
  );
}
