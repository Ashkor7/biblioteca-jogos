import { useId, useState } from 'react';
import { FiTrendingDown, FiTrash2 } from 'react-icons/fi';
import { api } from '../services/api.js';
import { usePriceHistory, useStores, useLibraryMutation } from '../hooks/queries.js';
import { useToast } from '../hooks/useToast.js';
import Modal from './Modal.jsx';
import TrendChart from './TrendChart.jsx';
import { Field, MoneyInput } from './Field.jsx';
import { LoadingState, ErrorState } from './States.jsx';
import { formatMoney, formatDay } from '../utils/format.js';
import { LIMITS, todayIn } from '../../shared/domain.js';

const TARGET = {
  BELOW: { label: 'Abaixo do preço-alvo', tone: 'text-ok' },
  AT: { label: 'No preço-alvo', tone: 'text-ok' },
  ABOVE: { label: 'Acima do preço-alvo', tone: 'text-amber' },
};

/** Histórico MANUAL de preços: registrar, ver evolução e comparar com o alvo. */
export default function PriceHistoryDialog({ game, onClose, readOnly = false }) {
  const toast = useToast();
  const storesId = useId();
  const history = usePriceHistory(game.id);
  const stores = useStores();
  const [form, setForm] = useState({ price: '', store: game.preferredStore?.name ?? '', recordedOn: todayIn(), note: '' });
  const [errors, setErrors] = useState({});
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const add = useLibraryMutation(
    () => api.addPrice(game.id, { ...form, store: form.store || null, note: form.note || null }),
    {
      onSuccess: () => {
        setErrors({});
        setForm((f) => ({ ...f, price: '', note: '' }));
        toast.success('Preço registrado no histórico.');
      },
      onError: (error) => {
        setErrors(error.fields ?? {});
        if (!error.fields || !Object.keys(error.fields).length) toast.error(error.message);
      },
    },
  );
  const remove = useLibraryMutation((entry) => api.deletePrice(game.id, entry.id), {
    onSuccess: () => toast.success('Registro removido.'),
    onError: (error) => toast.error(error.message),
  });

  const h = history.data;
  const chart = h?.entries.map((e) => ({ ...e, value: Number(e.price) })) ?? [];
  const target = h?.targetState ? TARGET[h.targetState] : null;

  return (
    <Modal title={`Preços de ${game.title}`} icon={FiTrendingDown} onClose={onClose} wide busy={add.isPending}>
      {history.isPending ? (
        <LoadingState />
      ) : history.isError ? (
        <ErrorState error={history.error} onRetry={history.refetch} />
      ) : (
        <div className="space-y-5">
          <p className="text-xs text-faint">{h.note}</p>
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Readout label="Último informado" value={h.latest ? formatMoney(h.latest.price) : '—'} note={h.latest ? formatDay(h.latest.recordedOn) : undefined} />
            <Readout label="Menor registrado" value={formatMoney(h.lowest)} tone="text-ok" />
            <Readout label="Maior registrado" value={formatMoney(h.highest)} />
            <Readout
              label="Preço-alvo"
              value={formatMoney(h.targetPrice)}
              tone="text-violet"
              note={target ? `${target.label}${h.differenceToTarget && h.targetState !== 'AT' ? ` (${formatMoney(Math.abs(Number(h.differenceToTarget)))})` : ''}` : 'sem alvo definido'}
              noteTone={target?.tone}
            />
          </dl>

          {chart.length > 1 && (
            <div className="panel">
              <div className="panel-body p-3">
                <TrendChart
                  data={chart}
                  xKey="recordedOn"
                  dataKey="value"
                  format={formatMoney}
                  labelFormat={formatDay}
                  caption={`Evolução dos preços registrados de ${game.title}`}
                  detail={(r) => r.store?.name ?? 'Loja não informada'}
                  height={180}
                />
              </div>
            </div>
          )}

          {h.entries.length === 0 ? (
            <p className="text-sm text-faint">Nenhum preço registrado ainda.</p>
          ) : (
            <ol className="max-h-56 list-none overflow-y-auto border border-line p-0">
              {[...h.entries].reverse().map((e) => (
                <li key={e.id} className="flex items-center gap-3 border-b border-line px-3 py-2 last:border-b-0">
                  <span className="num w-24 shrink-0">{formatMoney(e.price)}</span>
                  <span className="min-w-0 flex-1 text-sm">
                    {formatDay(e.recordedOn)}
                    <span className="text-muted"> · {e.store?.name ?? 'loja não informada'}</span>
                    {e.note && <span className="block truncate text-xs text-faint">{e.note}</span>}
                  </span>
                  {!readOnly && (
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm btn-icon"
                      disabled={remove.isPending}
                      onClick={() => remove.mutate(e)}
                      aria-label={`Remover registro de ${formatMoney(e.price)} em ${formatDay(e.recordedOn)}`}
                    >
                      <FiTrash2 aria-hidden="true" />
                    </button>
                  )}
                </li>
              ))}
            </ol>
          )}

          {!readOnly && (
            <form
              noValidate
              className="border-t border-line pt-4"
              onSubmit={(e) => {
                e.preventDefault();
                if (!form.price.trim()) return setErrors({ price: 'Informe o preço encontrado' });
                add.mutate();
              }}
            >
              <h3 className="mb-3 text-base">Registrar preço visto</h3>
              <div className="grid gap-3 sm:grid-cols-3">
                <Field label="Preço" error={errors.price}>
                  {(a11y) => <MoneyInput {...a11y} value={form.price} onChange={set('price')} />}
                </Field>
                <Field label="Loja" error={errors.store} hint="Opcional">
                  {(a11y) => (
                    <>
                      <input {...a11y} className="input" list={storesId} value={form.store} onChange={set('store')} maxLength={LIMITS.lookupNameMax} autoComplete="off" />
                      <datalist id={storesId}>
                        {stores.data?.items.map((s) => (
                          <option key={s.id} value={s.name} />
                        ))}
                      </datalist>
                    </>
                  )}
                </Field>
                <Field label="Data" error={errors.recordedOn}>
                  {(a11y) => <input {...a11y} type="date" className="input" value={form.recordedOn} max={todayIn()} onChange={set('recordedOn')} />}
                </Field>
              </div>
              <Field label="Observação" error={errors.note} hint="Opcional. Ex.: promoção de fim de ano" className="mt-3">
                {(a11y) => <input {...a11y} className="input" value={form.note} onChange={set('note')} maxLength={LIMITS.priceNoteMax} />}
              </Field>
              <div className="mt-4 flex justify-end">
                <button type="submit" className="btn btn-primary" disabled={add.isPending}>
                  {add.isPending ? 'Salvando…' : 'Registrar preço'}
                </button>
              </div>
            </form>
          )}
        </div>
      )}
    </Modal>
  );
}

function Readout({ label, value, note, tone = 'text-ink', noteTone = 'text-faint' }) {
  return (
    <div className="border border-line bg-panel-2 px-3 py-2">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className={`num text-lg ${tone}`}>{value}</dd>
      {note && <dd className={`text-xs ${noteTone}`}>{note}</dd>}
    </div>
  );
}
