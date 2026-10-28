import { useEffect, useId, useMemo, useState } from 'react';
import { useForm, Controller, useWatch } from 'react-hook-form';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import { FiArrowLeft, FiUpload, FiX } from 'react-icons/fi';
import { api } from '../services/api.js';
import { useGame, usePlatforms, useStores, useCategories, useLibraryMutation } from '../hooks/queries.js';
import { useToast } from '../hooks/useToast.js';
import PageHeader from '../components/PageHeader.jsx';
import TagInput from '../components/TagInput.jsx';
import { StarInput } from '../components/StarRating.jsx';
import { Field, MoneyInput } from '../components/Field.jsx';
import ImageManager from '../components/ImageManager.jsx';
import { LoadingState, ErrorState } from '../components/States.jsx';
import { emptyGameForm, gameToForm, formToPayload, makeGameResolver, apiFieldsToForm } from '../utils/gameForm.js';
import { describeDifference } from '../utils/format.js';
import { COLLECTION_CONDITIONS, PLAY_STATUS_LABELS, moneyToCents } from '../../shared/domain.js';

const ACCEPT = 'image/jpeg,image/png,image/webp,image/gif,image/avif';

export default function GameFormPage() {
  const { id } = useParams();
  const editing = Boolean(id);
  const game = useGame(id);

  if (editing && game.isPending) return <LoadingState label="Carregando jogo…" />;
  if (editing && game.isError) return <ErrorState error={game.error} onRetry={game.refetch} />;
  return <GameForm key={game.data?.id ?? 'novo'} game={editing ? game.data : null} />;
}

function GameForm({ game }) {
  const editing = Boolean(game);
  const navigate = useNavigate();
  const toast = useToast();
  const [params] = useSearchParams();
  const platforms = usePlatforms();
  const stores = useStores();
  const categories = useCategories();
  const platformListId = useId();
  const storeListId = useId();
  const coverInputId = useId();
  const [coverFile, setCoverFile] = useState(null);

  const defaultValues = useMemo(() => {
    if (game) return gameToForm(game);
    const condition = params.get('condicao');
    return {
      ...emptyGameForm,
      platform: params.get('plataforma') ?? '',
      condition: ['PHYSICAL', 'DIGITAL', 'WISHLIST'].includes(condition) ? condition : '',
    };
  }, [game, params]);

  const {
    register,
    handleSubmit,
    control,
    setError,
    formState: { errors, isSubmitting, isDirty },
  } = useForm({
    defaultValues,
    resolver: makeGameResolver({ allowIncompletePurchase: Boolean(game?.needsReview) }),
    mode: 'onTouched',
  });

  const condition = useWatch({ control, name: 'condition' });
  const originalPrice = useWatch({ control, name: 'originalPrice' });
  const paidPrice = useWatch({ control, name: 'paidPrice' });
  const coverUrl = useWatch({ control, name: 'coverUrl' });
  const wishlist = condition === 'WISHLIST';

  const preview = useMemo(() => (coverFile ? URL.createObjectURL(coverFile) : null), [coverFile]);
  useEffect(() => () => preview && URL.revokeObjectURL(preview), [preview]);

  const difference = useMemo(() => {
    const o = moneyToCents(originalPrice);
    const p = moneyToCents(paidPrice);
    if (!Number.isInteger(o) || !Number.isInteger(p)) return null;
    return describeDifference((o - p) / 100);
  }, [originalPrice, paidPrice]);

  const save = useLibraryMutation(
    (values) => {
      const payload = formToPayload(values);
      return editing ? api.updateGame(game.id, payload) : api.createGame(payload, coverFile);
    },
    {
      onSuccess: (saved) => {
        toast.success(editing ? 'Alterações salvas.' : `${saved.title} adicionado em ${saved.platform.name}.`);
        navigate(`/jogos/${saved.id}`);
      },
      onError: (error) => {
        const fields = apiFieldsToForm(error.fields);
        for (const [name, message] of Object.entries(fields)) setError(name, { type: 'server', message });
        if (!Object.keys(fields).length || fields._) toast.error(error.message);
        else toast.error('Confira os campos destacados.');
      },
    },
  );

  const onSubmit = (values) => save.mutateAsync(values).catch(() => {});
  const busy = isSubmitting || save.isPending;
  const backTo = editing ? `/jogos/${game.id}` : -1;

  return (
    <div className="page-enter">
      <PageHeader
        title={editing ? `Editar ${game.title}` : 'Adicionar jogo'}
        actions={
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => navigate(backTo)}>
            <FiArrowLeft aria-hidden="true" /> Voltar
          </button>
        }
      >
        {editing
          ? 'Altere qualquer informação. As estatísticas são recalculadas assim que você salvar.'
          : 'Plataforma, loja e categorias são criadas automaticamente a partir do que você digitar.'}
      </PageHeader>

      {game?.needsReview && (
        <p role="note" className="mb-5 border border-amber/50 bg-amber-soft px-4 py-3 text-sm">
          Este jogo veio da versão antiga. Informe mídia, preço pago e loja para ele entrar nos cálculos de gastos.
        </p>
      )}

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Section title="Jogo">
          <Field label="Nome do jogo" error={errors.title?.message}>
            {(a11y) => <input {...a11y} {...register('title')} className="input" autoComplete="off" maxLength={160} autoFocus={!editing} />}
          </Field>

          <Field label="Plataforma" error={errors.platform?.message} hint="Digite uma nova ou escolha uma existente (ex.: Xbox 360, Steam, Wii).">
            {(a11y) => (
              <>
                <input {...a11y} {...register('platform')} className="input" list={platformListId} autoComplete="off" maxLength={60} />
                <datalist id={platformListId}>
                  {platforms.data?.items.map((p) => (
                    <option key={p.id} value={p.name} />
                  ))}
                </datalist>
              </>
            )}
          </Field>

          {!editing && (
            <div>
              <span className="field-label">Capa</span>
              <div className="flex gap-4">
                <div className="w-24 shrink-0 sm:w-28">
                  <div className="aspect-[3/4] overflow-hidden border border-line-strong bg-panel-3">
                    {preview || coverUrl ? (
                      <img src={preview ?? coverUrl} alt="Prévia da capa" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full items-center justify-center p-2 text-center text-xs text-faint">Sem capa</div>
                    )}
                  </div>
                </div>
                <div className="min-w-0 flex-1 space-y-2">
                  <input
                    id={coverInputId}
                    type="file"
                    accept={ACCEPT}
                    className="sr-only"
                    onChange={(e) => setCoverFile(e.target.files?.[0] ?? null)}
                  />
                  <div className="flex flex-wrap gap-2">
                    <label htmlFor={coverInputId} className="btn btn-ghost btn-sm">
                      <FiUpload aria-hidden="true" /> {coverFile ? 'Trocar arquivo' : 'Enviar imagem'}
                    </label>
                    {coverFile && (
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => setCoverFile(null)}>
                        <FiX aria-hidden="true" /> Remover
                      </button>
                    )}
                  </div>
                  {coverFile ? (
                    <p className="truncate text-xs text-muted">{coverFile.name}</p>
                  ) : (
                    <Field label="ou endereço da imagem" error={errors.coverUrl?.message}>
                      {(a11y) => <input {...a11y} {...register('coverUrl')} type="url" inputMode="url" className="input" placeholder="https://…" />}
                    </Field>
                  )}
                  <p className="field-hint">JPG, PNG, WebP, GIF ou AVIF. Mais imagens podem ser adicionadas depois.</p>
                </div>
              </div>
            </div>
          )}
        </Section>

        <Section title="Coleção">
          <fieldset className="border-0 p-0">
            <legend className="field-label">Condição</legend>
            <div className="segmented" role="radiogroup" aria-invalid={errors.condition ? 'true' : undefined}>
              {COLLECTION_CONDITIONS.map((c) => (
                <label key={c.value}>
                  <input type="radio" value={c.value} {...register('condition')} />
                  {c.label}
                </label>
              ))}
            </div>
            {errors.condition && <p className="field-error">{errors.condition.message}</p>}
          </fieldset>

          {wishlist ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Preço de referência" error={errors.originalPrice?.message} hint="Opcional. Preço cheio, sem desconto.">
                {(a11y) => <MoneyInput {...a11y} {...register('originalPrice')} />}
              </Field>
              <Field label="Preço atual" error={errors.currentWishPrice?.message} hint="Opcional. O valor que você viu numa loja; não é atualizado automaticamente.">
                {(a11y) => <MoneyInput {...a11y} {...register('currentWishPrice')} />}
              </Field>
            </div>
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Preço original" error={errors.originalPrice?.message} hint="Sem desconto">
                  {(a11y) => <MoneyInput {...a11y} {...register('originalPrice')} />}
                </Field>
                <Field label="Preço pago" error={errors.paidPrice?.message} hint="Use 0 para jogos gratuitos">
                  {(a11y) => <MoneyInput {...a11y} {...register('paidPrice')} />}
                </Field>
              </div>
              {difference && <p className={`-mt-1 text-sm ${difference.tone}`}>{difference.label}</p>}
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Onde comprou" error={errors.store?.message} hint="Loja ou vendedor (ex.: Nuuvem, Steam)">
                  {(a11y) => (
                    <>
                      <input {...a11y} {...register('store')} className="input" list={storeListId} autoComplete="off" maxLength={60} />
                      <datalist id={storeListId}>
                        {stores.data?.items.map((s) => (
                          <option key={s.id} value={s.name} />
                        ))}
                      </datalist>
                    </>
                  )}
                </Field>
                <Field label="Data da compra" error={errors.purchasedAt?.message} hint="Opcional">
                  {(a11y) => <input {...a11y} {...register('purchasedAt')} type="date" className="input" />}
                </Field>
              </div>
            </>
          )}
        </Section>

        <Section title="Jogatina e avaliação" className="lg:col-span-2">
          <div className="grid gap-5 lg:grid-cols-2">
            <div className="space-y-5">
              <fieldset className="border-0 p-0">
                <legend className="field-label">Estado</legend>
                <div className="segmented" role="radiogroup">
                  {Object.entries(PLAY_STATUS_LABELS).map(([value, label]) => (
                    <label key={value}>
                      <input type="radio" value={value} {...register('playStatus')} />
                      {label}
                    </label>
                  ))}
                </div>
              </fieldset>
              <Field label="Horas jogadas" error={errors.hours?.message} hint="Aceita decimais, ex.: 12,5">
                {(a11y) => <input {...a11y} {...register('hours')} inputMode="decimal" className="input num max-w-40" placeholder="0" autoComplete="off" />}
              </Field>
              <Controller
                control={control}
                name="ratingStars"
                render={({ field }) => <StarInput value={field.value} onChange={field.onChange} />}
              />
              {errors.ratingStars && <p className="field-error">{errors.ratingStars.message}</p>}
            </div>
            <div className="space-y-5">
              <Controller
                control={control}
                name="categories"
                render={({ field }) => (
                  <TagInput
                    id="categorias"
                    label="Categorias"
                    value={field.value}
                    onChange={field.onChange}
                    suggestions={categories.data?.items.map((c) => c.name) ?? []}
                    error={errors.categories?.message}
                  />
                )}
              />
              <Field label="Avaliação escrita" error={errors.reviewText?.message} hint="Opcional. O que achou do jogo?">
                {(a11y) => <textarea {...a11y} {...register('reviewText')} className="input" rows={6} maxLength={5000} />}
              </Field>
            </div>
          </div>
        </Section>

        <div className="sticky bottom-0 z-10 -mx-4 flex flex-col-reverse gap-2 border-t border-line bg-void/95 px-4 py-3 backdrop-blur sm:mx-0 sm:flex-row sm:justify-end sm:px-0 lg:col-span-2">
          <Link to={editing ? `/jogos/${game.id}` : '/'} className="btn btn-ghost">
            Cancelar
          </Link>
          <button type="submit" className="btn btn-primary" disabled={busy || (editing && !isDirty)}>
            {busy ? 'Salvando…' : editing ? 'Salvar alterações' : 'Adicionar jogo'}
          </button>
        </div>
      </form>

      {editing && (
        <div className="panel mt-8">
          <div className="panel-body p-4 sm:p-6">
            <ImageManager game={game} />
          </div>
        </div>
      )}
    </div>
  );
}

function Section({ title, children, className = '' }) {
  return (
    <section className={`panel ${className}`} aria-label={title}>
      <div className="panel-body space-y-4 p-4 sm:p-6">
        <h2 className="text-lg">{title}</h2>
        {children}
      </div>
    </section>
  );
}
