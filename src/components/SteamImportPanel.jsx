import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router';
import { useMutation } from '@tanstack/react-query';
import { FaSteam } from 'react-icons/fa';
import { FiDownloadCloud, FiExternalLink, FiRefreshCw, FiRotateCcw, FiSearch, FiShoppingCart } from 'react-icons/fi';
import { api } from '../services/api.js';
import {
  useInvalidateLibrary,
  useLibraryMutation,
  usePlatforms,
  useSteamIgnored,
  useSteamJob,
  useSteamStatus,
  useStores,
} from '../hooks/queries.js';
import { useToast } from '../hooks/useToast.js';
import SectionTitle from './SectionTitle.jsx';
import Toggle from './Toggle.jsx';
import PurchaseDialog from './PurchaseDialog.jsx';
import { Field } from './Field.jsx';
import { EmptyState, ErrorState, LoadingState } from './States.jsx';
import { SteamDisabledNotice } from './SteamAccountSection.jsx';
import { formatDate, formatHours } from '../utils/format.js';
import { LIMITS, normalizeKey } from '../../shared/domain.js';
import { STEAM_APP_TYPE_LABELS, STEAM_PREVIEW_LABELS, STEAM_PREVIEW_STATUS as S } from '../../shared/steam.js';

const STATUS_TONE = {
  NEW: 'text-cyan',
  EXISTING: 'text-ok',
  DUPLICATE: 'text-amber',
  WISHLIST: 'text-magenta',
  IGNORED: 'text-faint',
  NOT_GAME: 'text-faint',
};

const DEFAULT_OPTIONS = {
  platform: 'Steam',
  store: 'Steam',
  includeFreeGames: false,
  screenshots: 0,
  importAchievements: true,
  genresAsCategories: true,
};

/** Tela Importar → Steam: estados de configuração antes da prévia. */
export default function SteamImportPanel() {
  const status = useSteamStatus();
  if (status.isPending) return <LoadingState label="Verificando a integração com a Steam…" />;
  if (status.isError) return <ErrorState error={status.error} onRetry={status.refetch} />;
  if (!status.data.enabled) return <SteamDisabledNotice reason={status.data.disabledReason} />;
  if (!status.data.account) {
    return (
      <EmptyState
        title="Vincule sua conta Steam"
        action={
          <Link to="/configuracoes#conta-steam" className="btn btn-primary">
            Ir para Configurações → Conta Steam
          </Link>
        }
      >
        Informe o SteamID64, o link do perfil ou o apelido. Depois volte aqui para ver a prévia da importação.
      </EmptyState>
    );
  }
  return <SteamImporter account={status.data.account} />;
}

export function SteamImporter({ account }) {
  const toast = useToast();
  const [options, setOptions] = useState(DEFAULT_OPTIONS);
  const [choices, setChoices] = useState(() => new Map());
  const [job, setJob] = useState(null);
  const [buying, setBuying] = useState(null);

  const preview = useMutation({ mutationFn: (includeFreeGames) => api.steamPreview({ includeFreeGames }) });
  const runPreview = preview.mutate;
  // Lê a conta ao abrir e quando "incluir jogos grátis" muda (a lista muda junto).
  useEffect(() => {
    runPreview(options.includeFreeGames);
  }, [runPreview, options.includeFreeGames]);

  const refresh = () => {
    setChoices(new Map());
    preview.mutate(options.includeFreeGames);
  };

  const importer = useLibraryMutation((payload) => api.steamImport(payload), {
    onSuccess: (result) => {
      setJob({ id: result.jobId, report: result, kind: 'import' });
      toast.success(`${result.created} jogo(s) criado(s), ${result.linked} vinculado(s), ${result.ignored} ignorado(s).`);
      refresh();
    },
    onError: (error) => toast.error(error.message),
  });

  const items = preview.data?.items ?? [];
  const selected = [...choices.entries()];

  function submit() {
    importer.mutate({
      items: selected.map(([appId, choice]) => ({ appId, action: choice.action, ...(choice.gameId ? { gameId: choice.gameId } : {}) })),
      options: { ...options, screenshots: Number(options.screenshots) || 0 },
    });
  }

  async function startPurchase(item) {
    try {
      setBuying({ item, game: await api.getGame(item.match.gameId) });
    } catch (error) {
      toast.error(error.message);
    }
  }

  return (
    <div className="space-y-6">
      <section aria-labelledby="previa-steam" className="panel">
        <div className="panel-body space-y-4 p-4 sm:p-6">
          <SectionTitle
            id="previa-steam"
            title="Prévia da importação"
            action={
              <button type="button" className="btn btn-ghost btn-sm" onClick={refresh} disabled={preview.isPending}>
                <FiRefreshCw aria-hidden="true" /> Ler de novo
              </button>
            }
          >
            Conta <span className="text-ink">{account.personaName}</span>. Nada é criado até você clicar em importar.
          </SectionTitle>

          {preview.isPending && !preview.data ? (
            <LoadingState label="Lendo os jogos da sua conta Steam…" />
          ) : preview.isError ? (
            <ErrorState error={preview.error} onRetry={refresh} title="Não foi possível ler a conta Steam" />
          ) : preview.data?.notice ? (
            <p role="alert" className="border border-amber/50 bg-amber-soft px-4 py-3 text-sm">
              {preview.data.notice}
            </p>
          ) : (
            <PreviewTable
              items={items}
              counts={preview.data?.counts ?? {}}
              choices={choices}
              onChange={setChoices}
              onPurchase={startPurchase}
              busy={preview.isPending}
            />
          )}
        </div>
      </section>

      <OptionsPanel options={options} onChange={setOptions} />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted" aria-live="polite">
          {selected.length ? `${selected.length} jogo(s) selecionado(s).` : 'Nenhum jogo selecionado.'}
        </p>
        <button type="button" className="btn btn-primary" disabled={!selected.length || importer.isPending} onClick={submit}>
          <FiDownloadCloud aria-hidden="true" />{' '}
          {importer.isPending ? 'Importando…' : selected.length ? `Importar ${selected.length} jogo(s)` : 'Importar'}
        </button>
      </div>

      {job && <JobProgress key={job.id ?? job.kind} job={job} />}

      <ResyncPanel options={options} onJob={setJob} />
      <IgnoredPanel onChange={refresh} />

      {buying && (
        <PurchaseDialog
          game={buying.game}
          open
          onClose={() => setBuying(null)}
          onDone={(updated) => {
            const appId = buying.item.appId;
            setBuying(null);
            importer.mutate({ items: [{ appId, action: 'LINK', gameId: updated.id }], options });
          }}
        />
      )}
    </div>
  );
}

/** Tabela da prévia com filtros, busca e seleção (vira cartões no celular). */
export function PreviewTable({ items, counts, choices, onChange, onPurchase, busy = false }) {
  const searchId = useId();
  const filterId = useId();
  const [filter, setFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const visible = useMemo(() => {
    const key = normalizeKey(search);
    return items.filter((i) => (filter === 'ALL' || i.status === filter) && (!key || normalizeKey(i.name).includes(key)));
  }, [items, filter, search]);

  const set = (appId, choice) => {
    const next = new Map(choices);
    if (choice) next.set(appId, choice);
    else next.delete(appId);
    onChange(next);
  };
  const selectAllNew = () => {
    const next = new Map(choices);
    for (const i of items) if (i.status === S.NEW) next.set(i.appId, { action: 'IMPORT' });
    onChange(next);
  };

  if (!items.length) {
    return <EmptyState title="Nenhum jogo na conta">A Steam não listou jogos para esta conta.</EmptyState>;
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,14rem)]">
        <div>
          <label htmlFor={searchId} className="field-label">
            Buscar na prévia
          </label>
          <div className="relative">
            <FiSearch aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
            <input id={searchId} type="search" className="input pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </div>
        <div>
          <label htmlFor={filterId} className="field-label">
            Situação
          </label>
          <select id={filterId} className="input" value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="ALL">Todos ({items.length})</option>
            {Object.values(S).map((s) => (
              <option key={s} value={s}>
                {STEAM_PREVIEW_LABELS[s]} ({counts[s] ?? 0})
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn btn-ghost btn-sm" onClick={selectAllNew} disabled={!counts.NEW}>
          Selecionar todos os novos ({counts.NEW ?? 0})
        </button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => onChange(new Map())} disabled={!choices.size}>
          Limpar seleção
        </button>
      </div>

      {visible.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted">Nenhum jogo com esses filtros.</p>
      ) : (
        <table className="steam-table" aria-busy={busy}>
          <caption className="sr-only">Jogos da conta Steam e o que fazer com cada um</caption>
          <thead>
            <tr>
              <th scope="col">
                <span className="sr-only">Selecionar</span>
              </th>
              <th scope="col">Jogo</th>
              <th scope="col">Horas</th>
              <th scope="col">Último acesso</th>
              <th scope="col">Situação</th>
              <th scope="col">Ação</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((item) => (
              <PreviewRow key={item.appId} item={item} choice={choices.get(item.appId)} onSet={set} onPurchase={onPurchase} />
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function PreviewRow({ item, choice, onSet, onPurchase }) {
  const selectId = useId();
  const selectable = item.status !== S.EXISTING && item.status !== S.WISHLIST;
  const defaultAction = item.status === S.DUPLICATE ? { action: 'LINK', gameId: item.match.gameId } : { action: 'IMPORT' };
  return (
    <tr className={choice ? 'is-selected' : ''}>
      <td>
        <input
          type="checkbox"
          className="h-4 w-4 accent-[var(--color-cyan)]"
          aria-label={`Selecionar ${item.name}`}
          checked={Boolean(choice)}
          disabled={!selectable}
          onChange={(e) => onSet(item.appId, e.target.checked ? defaultAction : null)}
        />
      </td>
      <td className="min-w-0">
        <span className="font-semibold break-words">{item.name}</span>
        {item.appType && item.appType !== 'game' && (
          <span className="tag ml-2 text-xs">{STEAM_APP_TYPE_LABELS[item.appType] ?? item.appType}</span>
        )}
        {item.storeUrl && (
          <a href={item.storeUrl} target="_blank" rel="noopener noreferrer" className="ml-2 inline-flex items-center text-xs" aria-label={`${item.name} na loja Steam (abre em nova aba)`}>
            <FiExternalLink aria-hidden="true" />
          </a>
        )}
      </td>
      <td data-label="Horas" className="num whitespace-nowrap text-sm">
        {formatHours(item.playtimeMinutes)}
      </td>
      <td data-label="Último acesso" className="whitespace-nowrap text-sm text-muted">
        {item.lastPlayedAt ? formatDate(item.lastPlayedAt) : '—'}
      </td>
      <td data-label="Situação" className="text-sm">
        <span className={`font-semibold ${STATUS_TONE[item.status]}`}>{STEAM_PREVIEW_LABELS[item.status]}</span>
        {item.match && (
          <span className="block text-xs text-muted">
            <Link to={`/jogos/${item.match.gameId}`}>{item.match.title}</Link> · {item.match.platform}
          </span>
        )}
      </td>
      <td data-label="Ação" className="text-sm">
        {item.status === S.DUPLICATE ? (
          <>
            <label htmlFor={selectId} className="sr-only">
              O que fazer com {item.name}
            </label>
            <select
              id={selectId}
              className="input py-1 text-sm"
              value={choice ? (choice.action === 'LINK' ? 'LINK' : choice.action) : ''}
              onChange={(e) => {
                const v = e.target.value;
                onSet(item.appId, v === '' ? null : v === 'LINK' ? { action: 'LINK', gameId: item.match.gameId } : { action: v });
              }}
            >
              <option value="">Não fazer nada</option>
              <option value="LINK">Vincular ao jogo existente</option>
              <option value="IMPORT">Importar como novo</option>
              <option value="IGNORE">Ignorar</option>
            </select>
          </>
        ) : item.status === S.WISHLIST ? (
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => onPurchase(item)}>
            <FiShoppingCart aria-hidden="true" /> Marcar como comprado
          </button>
        ) : item.status === S.EXISTING ? (
          <span className="text-faint">Nada a fazer</span>
        ) : choice ? (
          <span className="text-cyan">Importar</span>
        ) : (
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => onSet(item.appId, { action: 'IGNORE' })} disabled={item.status === S.IGNORED}>
            Ignorar
          </button>
        )}
        {choice?.action === 'IGNORE' && item.status !== S.DUPLICATE && <span className="ml-2 text-faint">Será ignorado</span>}
      </td>
    </tr>
  );
}

function OptionsPanel({ options, onChange }) {
  const platforms = usePlatforms();
  const stores = useStores();
  const platformsId = useId();
  const storesId = useId();
  const set = (key, value) => onChange((o) => ({ ...o, [key]: value }));
  return (
    <section aria-labelledby="opcoes-steam" className="panel">
      <div className="panel-body p-4 sm:p-6">
        <SectionTitle id="opcoes-steam" title="Opções da importação" />
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <Field label="Plataforma de destino" hint="Digite uma nova ou escolha uma existente.">
            {(props) => (
              <input {...props} className="input" list={platformsId} maxLength={LIMITS.lookupNameMax} value={options.platform} onChange={(e) => set('platform', e.target.value)} />
            )}
          </Field>
          <datalist id={platformsId}>
            {(platforms.data?.items ?? []).map((p) => (
              <option key={p.id} value={p.name} />
            ))}
          </datalist>
          <Field label="Loja" hint="Onde os jogos foram comprados (a Steam não informa preço nem data).">
            {(props) => (
              <input {...props} className="input" list={storesId} maxLength={LIMITS.lookupNameMax} value={options.store} onChange={(e) => set('store', e.target.value)} />
            )}
          </Field>
          <datalist id={storesId}>
            {(stores.data?.items ?? []).map((s) => (
              <option key={s.id} value={s.name} />
            ))}
          </datalist>
          <Field label="Screenshots por jogo" hint={`De 0 a ${LIMITS.steamScreenshotsMax}; viram imagens extras do jogo.`}>
            {(props) => (
              <input
                {...props}
                type="number"
                min={0}
                max={LIMITS.steamScreenshotsMax}
                className="input num"
                value={options.screenshots}
                onChange={(e) => set('screenshots', Math.max(0, Math.min(LIMITS.steamScreenshotsMax, Number(e.target.value) || 0)))}
              />
            )}
          </Field>
        </div>
        <div className="mt-2 divide-y divide-line">
          <Toggle
            label="Incluir jogos grátis já jogados"
            description="Jogos gratuitos aparecem na prévia só se você já jogou."
            checked={options.includeFreeGames}
            onChange={(v) => set('includeFreeGames', v)}
          />
          <Toggle
            label="Importar conquistas"
            description="Quantas conquistas você desbloqueou em cada jogo."
            checked={options.importAchievements}
            onChange={(v) => set('importAchievements', v)}
          />
          <Toggle
            label="Categorias a partir dos gêneros"
            description="Só para jogos sem categorias. Os gêneros vêm em português."
            checked={options.genresAsCategories}
            onChange={(v) => set('genresAsCategories', v)}
          />
        </div>
      </div>
    </section>
  );
}

/** Progresso real do job (processados/total/erros) e resumo no fim. */
export function JobProgress({ job }) {
  const progress = useSteamJob(job.id);
  const invalidate = useInvalidateLibrary();
  const notified = useRef(false);
  const data = progress.data;
  const finished = data && !['PENDING', 'RUNNING'].includes(data.status);
  useEffect(() => {
    if (finished && !notified.current) {
      notified.current = true;
      invalidate();
    }
  }, [finished, invalidate]);
  const report = job.report ?? {};

  return (
    <section aria-labelledby="progresso-steam" className="panel">
      <div className="panel-body space-y-3 p-4 sm:p-6">
        <SectionTitle id="progresso-steam" title={job.kind === 'resync' ? 'Ressincronização' : 'Importação'} />
        <dl className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
          {job.kind === 'resync' ? (
            <>
              <Stat label="Criados" value={report.created ?? 0} />
              <Stat label="Horas atualizadas" value={report.updated ?? 0} />
            </>
          ) : (
            <>
              <Stat label="Criados" value={report.created ?? 0} />
              <Stat label="Vinculados" value={report.linked ?? 0} />
              <Stat label="Ignorados" value={report.ignored ?? 0} />
              <Stat label="Pulados" value={report.skipped?.length ?? 0} />
            </>
          )}
        </dl>
        {!job.id ? (
          <p className="text-sm text-muted">Nada para completar em segundo plano.</p>
        ) : progress.isError ? (
          <ErrorState error={progress.error} onRetry={progress.refetch} />
        ) : (
          <>
            <div
              className="progress-track"
              role="progressbar"
              aria-label="Dados da Steam completados"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={data?.percent ?? 0}
            >
              <span style={{ width: `${data?.percent ?? 0}%` }} />
            </div>
            <p aria-live="polite" className="text-sm">
              {!data
                ? 'Preparando…'
                : finished
                  ? `Concluído: ${data.processed} de ${data.total} jogo(s) completados${data.failed ? `, ${data.failed} com erro` : ''}.`
                  : `Completando dados (descrição, imagens, conquistas): ${data.processed} de ${data.total}${data.failed ? ` · ${data.failed} erro(s)` : ''}. Pode sair desta página; continua no servidor.`}
            </p>
            {finished && data.summary.errors.length > 0 && (
              <ul className="list-disc space-y-1 pl-5 text-sm text-muted">
                {data.summary.errors.map((e) => (
                  <li key={e.appId}>
                    {e.title ?? `App ${e.appId}`}: {e.message}
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
        {report.skipped?.length > 0 && (
          <details className="text-sm">
            <summary className="cursor-pointer text-muted">Ver jogos pulados</summary>
            <ul className="mt-2 list-disc pl-5 text-muted">
              {report.skipped.map((s) => (
                <li key={s.appId}>
                  App {s.appId}: {s.reason}
                </li>
              ))}
            </ul>
          </details>
        )}
        {finished && (
          <p className="text-sm">
            Os jogos importados ficam marcados para revisão até você informar preço e data da compra.{' '}
            <Link to="/biblioteca?needsReview=true">Ver jogos para revisar</Link>
          </p>
        )}
      </div>
    </section>
  );
}

function Stat({ label, value }) {
  return (
    <div className="border border-line px-3 py-2">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="num text-lg text-ink">{value}</dd>
    </div>
  );
}

function ResyncPanel({ options, onJob }) {
  const toast = useToast();
  const [updatePlaytime, setUpdatePlaytime] = useState(false);
  const resync = useLibraryMutation(() => api.steamResync({ updatePlaytime, options: { ...options, screenshots: Number(options.screenshots) || 0 } }), {
    onSuccess: (result) => {
      onJob({ id: result.jobId, report: result, kind: 'resync' });
      const pending = result.pendingReview.duplicates + result.pendingReview.wishlist;
      toast.success(
        `${result.created} jogo(s) novo(s)${updatePlaytime ? `, ${result.updated} com horas atualizadas` : ''}.${pending ? ` ${pending} possível(is) duplicado(s) ou desejo(s) esperam sua decisão na prévia.` : ''}`,
      );
    },
    onError: (error) => toast.error(error.message),
  });
  return (
    <section aria-labelledby="ressincronizar" className="panel">
      <div className="panel-body space-y-3 p-4 sm:p-6">
        <SectionTitle id="ressincronizar" title="Ressincronizar">
          Cria só os jogos novos da conta. Nada do que você editou é sobrescrito.
        </SectionTitle>
        <Toggle
          label="Atualizar horas e último acesso"
          description="O total de horas só aumenta (nunca diminui) e as sessões do diário são preservadas. O estado do jogo não muda."
          checked={updatePlaytime}
          onChange={setUpdatePlaytime}
        />
        <button type="button" className="btn btn-ghost" onClick={() => resync.mutate()} disabled={resync.isPending}>
          <FaSteam aria-hidden="true" /> {resync.isPending ? 'Ressincronizando…' : 'Ressincronizar agora'}
        </button>
      </div>
    </section>
  );
}

function IgnoredPanel({ onChange }) {
  const toast = useToast();
  const ignored = useSteamIgnored();
  const undo = useLibraryMutation((appId) => api.steamUnignore(appId), {
    onSuccess: () => {
      toast.success('O jogo voltou a aparecer na importação.');
      onChange();
    },
    onError: (error) => toast.error(error.message),
  });
  const items = ignored.data?.items ?? [];
  return (
    <section aria-labelledby="ignorados-steam" className="panel">
      <div className="panel-body space-y-3 p-4 sm:p-6">
        <SectionTitle id="ignorados-steam" title={`Ignorados (${items.length})`}>
          Jogos que você pediu para não importar ou excluiu com “Não importar de novo”.
        </SectionTitle>
        {ignored.isPending ? (
          <LoadingState />
        ) : ignored.isError ? (
          <ErrorState error={ignored.error} onRetry={ignored.refetch} />
        ) : items.length === 0 ? (
          <p className="text-sm text-faint">Nenhum jogo ignorado.</p>
        ) : (
          <ul className="divide-y divide-line">
            {items.map((item) => (
              <li key={item.appId} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span className="min-w-0 break-words">{item.title}</span>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => undo.mutate(item.appId)} disabled={undo.isPending}>
                  <FiRotateCcw aria-hidden="true" /> Desfazer
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
