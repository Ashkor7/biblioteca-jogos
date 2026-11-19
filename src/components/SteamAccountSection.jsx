import { useState } from 'react';
import { Link } from 'react-router';
import { useMutation } from '@tanstack/react-query';
import { FaSteam } from 'react-icons/fa';
import { FiCheck, FiDownloadCloud, FiExternalLink, FiLink2, FiSearch, FiUserX } from 'react-icons/fi';
import { api } from '../services/api.js';
import { useLibraryMutation, useSteamStatus } from '../hooks/queries.js';
import { useToast } from '../hooks/useToast.js';
import SectionTitle from './SectionTitle.jsx';
import Modal from './Modal.jsx';
import { Field } from './Field.jsx';
import { LoadingState, ErrorState } from './States.jsx';
import { formatDate } from '../utils/format.js';

/** Avatar da Steam (URL https da própria Steam; sem avatar, a inicial). */
function SteamAvatar({ url, name }) {
  return url ? (
    <img src={url} alt="" className="h-14 w-14 shrink-0 rounded-lg border border-line-strong object-cover" />
  ) : (
    <span aria-hidden="true" className="grid h-14 w-14 shrink-0 place-items-center rounded-lg border border-line-strong text-xl">
      {name?.[0] ?? '?'}
    </span>
  );
}

export function SteamDisabledNotice({ reason }) {
  return (
    <div className="border border-amber/50 bg-amber-soft px-4 py-3 text-sm">
      <p className="font-semibold text-amber">Importação da Steam desativada</p>
      <p className="mt-1">{reason}</p>
      <p className="mt-1 text-muted">
        A chave é gerada em <span className="num text-ink">steamcommunity.com/dev/apikey</span> e fica só no servidor (arquivo{' '}
        <span className="num text-ink">.env</span>): nunca é enviada para esta página.
      </p>
    </div>
  );
}

export default function SteamAccountSection() {
  const status = useSteamStatus();
  return (
    <section aria-labelledby="conta-steam" className="panel">
      <div className="panel-body space-y-4 p-4 sm:p-6">
        <SectionTitle id="conta-steam" title="Conta Steam">
          Vincule sua conta para importar a biblioteca. O Steam ID e o nome da conta nunca aparecem no perfil público.
        </SectionTitle>
        {status.isPending ? (
          <LoadingState label="Verificando a integração com a Steam…" />
        ) : status.isError ? (
          <ErrorState error={status.error} onRetry={status.refetch} />
        ) : !status.data.enabled ? (
          <SteamDisabledNotice reason={status.data.disabledReason} />
        ) : status.data.account ? (
          <LinkedAccount status={status.data} />
        ) : (
          <LinkForm />
        )}
      </div>
    </section>
  );
}

function LinkForm() {
  const toast = useToast();
  const [input, setInput] = useState('');
  const [error, setError] = useState(null);
  const lookup = useMutation({
    mutationFn: (value) => api.steamLookup(value),
    onMutate: () => setError(null),
    onError: (err) => setError(err.fields?.input ?? err.message),
  });
  const link = useLibraryMutation((steamId64) => api.steamLink(steamId64), {
    onSuccess: (result) => {
      toast.success(`Conta Steam ${result.account.personaName} vinculada.`);
      lookup.reset();
      setInput('');
    },
    onError: (err) => toast.error(err.message),
  });
  const candidate = lookup.data;

  return (
    <div className="space-y-4">
      <form
        className="flex flex-col gap-3 sm:flex-row sm:items-end"
        onSubmit={(e) => {
          e.preventDefault();
          if (input.trim()) lookup.mutate(input.trim());
        }}
      >
        <Field
          label="SteamID64, link do perfil ou apelido"
          error={error}
          hint="Ex.: 76561198000000000, steamcommunity.com/id/seu-apelido ou só o apelido."
          className="min-w-0 flex-1"
        >
          {(props) => (
            <input
              {...props}
              className="input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              maxLength={200}
              autoComplete="off"
              spellCheck={false}
            />
          )}
        </Field>
        <button type="submit" className="btn btn-primary sm:mb-[1.6rem]" disabled={lookup.isPending || !input.trim()}>
          <FiSearch aria-hidden="true" /> {lookup.isPending ? 'Procurando…' : 'Procurar perfil'}
        </button>
      </form>

      {candidate && (
        <div role="status" className="flex flex-col gap-4 border border-cyan/50 bg-cyan-soft p-4 sm:flex-row sm:items-center">
          <SteamAvatar url={candidate.avatarUrl} name={candidate.personaName} />
          <div className="min-w-0 flex-1">
            <p className="font-display text-lg font-semibold break-words">{candidate.personaName}</p>
            <p className="num text-xs text-muted break-all">{candidate.steamId64}</p>
            {candidate.visibility !== 'public' && (
              <p className="mt-1 text-sm text-amber">
                Este perfil não é público. Para importar, deixe “Detalhes de jogos” como Público na privacidade da Steam.
              </p>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn btn-ghost" onClick={() => lookup.reset()} disabled={link.isPending}>
              Não sou eu
            </button>
            <button type="button" className="btn btn-primary" onClick={() => link.mutate(candidate.steamId64)} disabled={link.isPending}>
              <FiCheck aria-hidden="true" /> {link.isPending ? 'Vinculando…' : 'Confirmar vínculo'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function LinkedAccount({ status }) {
  const { account } = status;
  const [unlinking, setUnlinking] = useState(false);
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <SteamAvatar url={account.avatarUrl} name={account.personaName} />
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-2 font-display text-lg font-semibold">
            <FaSteam aria-hidden="true" /> <span className="break-words">{account.personaName}</span>
          </p>
          <p className="num text-xs text-muted break-all">{account.steamId64}</p>
          <p className="mt-1 text-sm text-muted">
            Vinculada em {formatDate(account.linkedAt)} · última leitura {account.lastSyncAt ? formatDate(account.lastSyncAt) : 'nunca'} ·{' '}
            {status.linkedGames} jogo(s) ligados à Steam
          </p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Link to="/importar?origem=steam" className="btn btn-primary">
          <FiDownloadCloud aria-hidden="true" /> Importar ou ressincronizar
        </Link>
        {account.profileUrl && (
          <a href={account.profileUrl} target="_blank" rel="noopener noreferrer" className="btn btn-ghost">
            <FiExternalLink aria-hidden="true" /> Perfil na Steam <span className="sr-only">(abre em nova aba)</span>
          </a>
        )}
        <button type="button" className="btn btn-danger" onClick={() => setUnlinking(true)}>
          <FiUserX aria-hidden="true" /> Desvincular
        </button>
      </div>
      {unlinking && <UnlinkDialog account={account} onClose={() => setUnlinking(false)} />}
    </div>
  );
}

function UnlinkDialog({ account, onClose }) {
  const toast = useToast();
  const [keep, setKeep] = useState('keep');
  const unlink = useLibraryMutation(() => api.steamUnlink(keep === 'keep'), {
    onSuccess: (result) => {
      toast.success(
        result.unlinkedGames
          ? `Conta desvinculada. ${result.unlinkedGames} jogo(s) perderam o vínculo com a Steam e continuam na biblioteca.`
          : 'Conta desvinculada. Os jogos continuam na biblioteca.',
      );
      onClose();
    },
    onError: (err) => toast.error(err.message),
  });
  return (
    <Modal
      title={`Desvincular ${account.personaName}?`}
      icon={FiLink2}
      onClose={onClose}
      busy={unlink.isPending}
      description="Os jogos importados continuam na biblioteca, com tudo que você editou."
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          unlink.mutate();
        }}
      >
        <fieldset className="space-y-3">
          <legend className="field-label">E o vínculo de cada jogo com o app da Steam?</legend>
          {[
            ['keep', 'Manter o vínculo', 'Mantém o selo Steam, o link da loja e as horas lidas. Vincular a conta de novo reconhece os jogos.'],
            ['drop', 'Remover o vínculo', 'Os jogos viram registros sem ligação com a Steam (sem selo, link nem horas da Steam).'],
          ].map(([value, label, hint]) => (
            <label key={value} className="flex cursor-pointer items-start gap-2 border border-line p-3 has-[:checked]:border-cyan">
              <input type="radio" name="keep" value={value} checked={keep === value} onChange={() => setKeep(value)} className="mt-1" />
              <span>
                <span className="font-semibold">{label}</span>
                <span className="block text-sm text-muted">{hint}</span>
              </span>
            </label>
          ))}
        </fieldset>
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={unlink.isPending}>
            Cancelar
          </button>
          <button type="submit" className="btn btn-danger" disabled={unlink.isPending}>
            {unlink.isPending ? 'Desvinculando…' : 'Desvincular conta'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
