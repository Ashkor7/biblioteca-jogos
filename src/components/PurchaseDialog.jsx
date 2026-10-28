import { useEffect, useId, useRef, useState } from 'react';
import { FiShoppingCart } from 'react-icons/fi';
import { api } from '../services/api.js';
import { useStores, useLibraryMutation } from '../hooks/queries.js';
import { useToast } from '../hooks/useToast.js';
import { Field, MoneyInput } from './Field.jsx';
import { moneyToInput } from '../utils/format.js';

const today = () => new Date().toISOString().slice(0, 10);

/** Converte um desejo em jogo comprado: exige mídia, preço pago e loja. */
export default function PurchaseDialog({ game, open, onClose, onDone }) {
  const ref = useRef(null);
  const storesId = useId();
  const toast = useToast();
  const stores = useStores({ enabled: open });
  const [form, setForm] = useState(() => initialForm(game));
  const [errors, setErrors] = useState({});

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  const mutation = useLibraryMutation((payload) => api.markPurchased(game.id, payload), {
    onSuccess: (updated) => {
      toast.success(`${updated.title} entrou na biblioteca.`);
      onDone?.(updated);
    },
    onError: (error) => {
      setErrors(error.fields ?? {});
      if (!error.fields || Object.keys(error.fields).length === 0) toast.error(error.message);
    },
  });

  function set(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function submit(event) {
    event.preventDefault();
    const local = {};
    if (!form.mediaType) local.mediaType = 'Escolha Físico ou Digital';
    if (!form.paidPrice.trim()) local.paidPrice = 'Informe quanto você pagou (0 para gratuito)';
    if (!form.store.trim()) local.store = 'Informe onde comprou';
    if (!form.originalPrice.trim()) local.originalPrice = 'Informe o preço original (sem desconto)';
    setErrors(local);
    if (Object.keys(local).length) return;
    mutation.mutate({
      mediaType: form.mediaType,
      originalPrice: form.originalPrice,
      paidPrice: form.paidPrice,
      store: form.store,
      purchasedAt: form.purchasedAt || null,
    });
  }

  return (
    <dialog
      ref={ref}
      className="modal"
      aria-labelledby="compra-titulo"
      onClose={() => {
        setErrors({});
        onClose();
      }}
    >
      <form onSubmit={submit} noValidate className="p-5 sm:p-6">
        <h2 id="compra-titulo" className="flex items-center gap-2 text-xl">
          <FiShoppingCart className="text-cyan" aria-hidden="true" /> Marcar como comprado
        </h2>
        <p className="mt-1 text-sm text-muted">
          {game.title} sai da lista de desejos e passa a contar na biblioteca e nos gastos.
        </p>

        <fieldset className="mt-5 border-0 p-0">
          <legend className="field-label">Mídia</legend>
          <div className="segmented" role="radiogroup">
            {[
              ['PHYSICAL', 'Físico'],
              ['DIGITAL', 'Digital'],
            ].map(([value, label]) => (
              <label key={value}>
                <input
                  type="radio"
                  name="purchase-media"
                  value={value}
                  checked={form.mediaType === value}
                  onChange={() => set('mediaType', value)}
                />
                {label}
              </label>
            ))}
          </div>
          {errors.mediaType && <p className="field-error">{errors.mediaType}</p>}
        </fieldset>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label="Preço original" error={errors.originalPrice} hint="Sem desconto">
            {(a11y) => <MoneyInput {...a11y} value={form.originalPrice} onChange={(e) => set('originalPrice', e.target.value)} />}
          </Field>
          <Field label="Preço pago" error={errors.paidPrice}>
            {(a11y) => <MoneyInput {...a11y} value={form.paidPrice} onChange={(e) => set('paidPrice', e.target.value)} />}
          </Field>
          <Field label="Onde comprou" error={errors.store} hint="Loja ou vendedor">
            {(a11y) => (
              <>
                <input
                  {...a11y}
                  className="input"
                  list={storesId}
                  value={form.store}
                  onChange={(e) => set('store', e.target.value)}
                  autoComplete="off"
                  maxLength={60}
                />
                <datalist id={storesId}>
                  {stores.data?.items.map((s) => (
                    <option key={s.id} value={s.name} />
                  ))}
                </datalist>
              </>
            )}
          </Field>
          <Field label="Data da compra" error={errors.purchasedAt}>
            {(a11y) => (
              <input {...a11y} type="date" className="input" value={form.purchasedAt} max={today()} onChange={(e) => set('purchasedAt', e.target.value)} />
            )}
          </Field>
        </div>

        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={mutation.isPending}>
            Cancelar
          </button>
          <button type="submit" className="btn btn-primary" disabled={mutation.isPending}>
            {mutation.isPending ? 'Salvando…' : 'Confirmar compra'}
          </button>
        </div>
      </form>
    </dialog>
  );
}

function initialForm(game) {
  return {
    mediaType: '',
    originalPrice: moneyToInput(game.originalPrice),
    paidPrice: moneyToInput(game.currentWishPrice),
    store: '',
    purchasedAt: today(),
  };
}
