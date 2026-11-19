import { useState } from 'react';
import { FaSteam } from 'react-icons/fa';
import { FiDownloadCloud, FiExternalLink } from 'react-icons/fi';
import { api } from '../services/api.js';
import { useLibraryMutation, useSteamStatus } from '../hooks/queries.js';
import { useToast } from '../hooks/useToast.js';
import ConfirmDialog from './ConfirmDialog.jsx';
import { formatDate, formatDay, formatHours } from '../utils/format.js';

const FIELD_LABELS = {
  description: 'descrição',
  developer: 'desenvolvedora',
  publisher: 'distribuidora',
  metacriticScore: 'Metacritic',
  releaseDate: 'lançamento',
  categories: 'categorias',
  achievements: 'conquistas',
  images: 'imagens',
};

function Readout({ label, value }) {
  return (
    <div className="readout">
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="text-right text-sm">{value}</dd>
    </div>
  );
}

/** Metadados opcionais (vindos da Steam ou digitados): descrição, empresas, lançamento, Metacritic. */
export function GameMetadata({ game }) {
  const release = game.releaseDate ? formatDay(game.releaseDate) : game.releaseDateText;
  const has = game.description || game.developer || game.publisher || release || game.metacriticScore !== null;
  if (!has) return null;
  return (
    <section aria-labelledby="sobre-jogo" className="mt-7">
      <h2 id="sobre-jogo" className="mb-2 text-base text-muted">
        Sobre o jogo
      </h2>
      {game.description && <p className="max-w-[68ch] text-[1.02rem] leading-relaxed">{game.description}</p>}
      <dl className="mt-3 max-w-xl">
        {game.developer && <Readout label="Desenvolvedora" value={game.developer} />}
        {game.publisher && <Readout label="Distribuidora" value={game.publisher} />}
        {release && <Readout label="Lançamento" value={release} />}
        {game.metacriticScore !== null && game.metacriticScore !== undefined && (
          <Readout label="Metacritic" value={<span className="num text-ink">{game.metacriticScore}</span>} />
        )}
      </dl>
    </section>
  );
}

/** Dados lidos da Steam e o botão "Completar com dados da Steam" (só campos vazios). */
export default function GameSteamPanel({ game }) {
  const toast = useToast();
  const status = useSteamStatus();
  const [confirmOverwrite, setConfirmOverwrite] = useState(false);
  const steam = game.steam;
  const fill = useLibraryMutation((overwrite) => api.steamFill(game.id, overwrite), {
    onSuccess: (result) => {
      setConfirmOverwrite(false);
      const names = result.filled.filter((f) => FIELD_LABELS[f]).map((f) => FIELD_LABELS[f]);
      toast.success(names.length ? `Preenchido com a Steam: ${names.join(', ')}.` : 'Nada a completar: os campos já estavam preenchidos.');
    },
    onError: (error) => {
      setConfirmOverwrite(false);
      toast.error(error.message);
    },
  });
  const enabled = status.data?.enabled;
  const achievements =
    steam.achievementsTotal !== null && steam.achievementsTotal !== undefined
      ? `${steam.achievementsUnlocked ?? 0} de ${steam.achievementsTotal}`
      : '—';

  return (
    <section aria-labelledby="dados-steam" className="panel mt-7">
      <div className="panel-body p-4 sm:p-5">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h2 id="dados-steam" className="flex items-center gap-2 text-base text-muted">
            <FaSteam aria-hidden="true" /> Dados da Steam
          </h2>
          {steam.storeUrl && (
            <a href={steam.storeUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm">
              Página na loja <FiExternalLink aria-hidden="true" />
              <span className="sr-only">(abre em nova aba)</span>
            </a>
          )}
        </div>
        <dl>
          <Readout label="Horas na Steam" value={<span className="num">{steam.playtimeMinutes !== null ? formatHours(steam.playtimeMinutes) : '—'}</span>} />
          <Readout label="Último acesso" value={steam.lastPlayedAt ? formatDate(steam.lastPlayedAt) : 'Nunca jogado'} />
          <Readout label="Conquistas" value={<span className="num">{achievements}</span>} />
          <Readout label="Última leitura" value={formatDate(steam.syncedAt)} />
        </dl>
        <p className="mt-3 text-xs text-faint">
          As horas exibidas no jogo somam o saldo anterior e o diário; a Steam só aumenta esse total, nunca diminui.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" className="btn btn-ghost btn-sm" disabled={!enabled || fill.isPending} onClick={() => fill.mutate(false)}>
            <FiDownloadCloud aria-hidden="true" /> {fill.isPending ? 'Consultando a Steam…' : 'Completar com dados da Steam'}
          </button>
          <button type="button" className="btn btn-ghost btn-sm" disabled={!enabled || fill.isPending} onClick={() => setConfirmOverwrite(true)}>
            Sobrescrever com dados da Steam…
          </button>
        </div>
        {status.data && !enabled && <p className="mt-2 text-xs text-amber">{status.data.disabledReason}</p>}
      </div>
      <ConfirmDialog
        open={confirmOverwrite}
        title="Sobrescrever com dados da Steam?"
        confirmLabel="Sobrescrever"
        tone="primary"
        busy={fill.isPending}
        onCancel={() => setConfirmOverwrite(false)}
        onConfirm={() => fill.mutate(true)}
      >
        Descrição, desenvolvedora, distribuidora, lançamento e Metacritic serão trocados pelos da loja, e a capa da Steam vira a
        capa do jogo. Os gêneros são somados às suas categorias. Título, preços, nota, avaliação e estado não mudam.
      </ConfirmDialog>
    </section>
  );
}
