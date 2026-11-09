import { useId, useState } from 'react';
import { Link } from 'react-router';
import { FiUpload, FiTrash2, FiEye, FiCopy, FiRefreshCw, FiDownload, FiLock } from 'react-icons/fi';
import { api } from '../services/api.js';
import { useProfile, useLibraryMutation } from '../hooks/queries.js';
import { useToast } from '../hooks/useToast.js';
import PageHeader from '../components/PageHeader.jsx';
import SectionTitle from '../components/SectionTitle.jsx';
import Avatar from '../components/Avatar.jsx';
import Toggle from '../components/Toggle.jsx';
import { Field } from '../components/Field.jsx';
import { LoadingState, ErrorState } from '../components/States.jsx';
import { LIMITS } from '../../shared/domain.js';

const ACCEPT = 'image/jpeg,image/png,image/webp,image/gif,image/avif';

const PRIVACY_GROUPS = [
  {
    title: 'Seções do perfil',
    items: [
      ['showFavorites', 'Jogos favoritos', 'Os favoritos marcados como visíveis no perfil.'],
      ['showAchievements', 'Conquistas', 'Somente as conquistas já desbloqueadas.'],
      ['showActivity', 'Atividades recentes', 'Jogos adicionados, zerados, sessões, conquistas…'],
      ['showPlayStats', 'Estatísticas de jogatina', 'Contagens, horas jogadas e estado de cada jogo.'],
      ['showLibrary', 'Biblioteca completa', 'Lista dos jogos adquiridos (sem preços nem lojas).'],
      ['showWishlist', 'Lista de desejos', 'Títulos desejados (sem preços).'],
    ],
  },
  {
    title: 'Informações financeiras',
    note: 'Privadas por padrão. Valores por jogo, lojas de cada compra e datas nunca são públicos.',
    items: [
      ['showOriginalValue', 'Valor original da biblioteca', 'Soma dos preços de referência (não é valor de mercado).'],
      ['showPaidTotal', 'Total pago', 'Quanto você pagou somando todas as compras.'],
      ['showSavings', 'Economia acumulada', 'Economia líquida e percentual de desconto.'],
      ['showStoreRanking', 'Ranking das lojas', 'Lojas onde você mais compra (economia só se a anterior estiver ligada).'],
    ],
  },
];

export default function SettingsPage() {
  const profile = useProfile();
  if (profile.isPending) return <LoadingState label="Carregando configurações…" />;
  if (profile.isError) return <ErrorState error={profile.error} onRetry={profile.refetch} />;
  return (
    <div className="page-enter space-y-10">
      <PageHeader title="Configurações">Perfil do jogador, privacidade e compartilhamento.</PageHeader>
      <ProfileForm key={profile.data.username} profile={profile.data} />
      <ImagesSection profile={profile.data} />
      <PrivacySection profile={profile.data} />
      <ShareSection profile={profile.data} />
      <MaintenanceSection />
    </div>
  );
}

function ProfileForm({ profile }) {
  const toast = useToast();
  const [form, setForm] = useState({
    displayName: profile.displayName,
    username: profile.username,
    bio: profile.bio ?? '',
    titleCode: profile.title.code,
  });
  const [errors, setErrors] = useState({});
  const titleId = useId();
  const save = useLibraryMutation(() => api.updateProfile({ ...form, bio: form.bio || null }), {
    onSuccess: () => {
      setErrors({});
      toast.success('Perfil salvo.');
    },
    onError: (error) => {
      setErrors(error.fields ?? {});
      toast.error(error.fields && Object.keys(error.fields).length ? 'Confira os campos destacados.' : error.message);
    },
  });
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const dirty =
    form.displayName !== profile.displayName ||
    form.username !== profile.username ||
    form.bio !== (profile.bio ?? '') ||
    form.titleCode !== profile.title.code;

  return (
    <section aria-labelledby="perfil-form" className="panel">
      <form
        className="panel-body space-y-5 p-4 sm:p-6"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate();
        }}
      >
        <SectionTitle id="perfil-form" title="Identidade do jogador" />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nome de exibição" error={errors.displayName}>
            {(a11y) => <input {...a11y} className="input" value={form.displayName} onChange={set('displayName')} maxLength={LIMITS.displayNameMax} />}
          </Field>
          <Field label="Nome de usuário" error={errors.username} hint={`Endereço do perfil público: /u/${form.username || '…'}`}>
            {(a11y) => (
              <div className="relative">
                <span className="num pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint">@</span>
                <input
                  {...a11y}
                  className="input num pl-7"
                  value={form.username}
                  onChange={(e) => setForm((f) => ({ ...f, username: e.target.value.toLowerCase() }))}
                  maxLength={LIMITS.usernameMax}
                  autoComplete="off"
                  spellCheck={false}
                />
              </div>
            )}
          </Field>
        </div>
        <Field label="Biografia" error={errors.bio} hint={`${form.bio.length}/${LIMITS.bioMax} caracteres`}>
          {(a11y) => <textarea {...a11y} className="input" rows={4} value={form.bio} onChange={set('bio')} maxLength={LIMITS.bioMax} />}
        </Field>
        <fieldset className="border-0 p-0">
          <legend id={titleId} className="field-label">
            Título exibido
          </legend>
          <ul className="grid list-none gap-2 p-0 sm:grid-cols-2 lg:grid-cols-3" aria-labelledby={titleId}>
            {profile.titles.map((t) => (
              <li key={t.code}>
                <label
                  className={`flex h-full items-start gap-3 border px-3 py-2 ${
                    form.titleCode === t.code ? 'border-amber bg-amber-soft' : 'border-line'
                  } ${t.unlocked ? 'cursor-pointer hover:border-amber/70' : 'opacity-60'}`}
                >
                  <input
                    type="radio"
                    name="titleCode"
                    className="mt-1 accent-amber"
                    value={t.code}
                    checked={form.titleCode === t.code}
                    disabled={!t.unlocked}
                    onChange={() => setForm((f) => ({ ...f, titleCode: t.code }))}
                  />
                  <span className="min-w-0">
                    <span className="flex items-center gap-1.5 font-display font-semibold">
                      {!t.unlocked && <FiLock aria-label="Bloqueado" />} {t.name}
                    </span>
                    <span className="block text-xs text-muted">{t.hint}</span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
          {errors.titleCode && <p className="field-error">{errors.titleCode}</p>}
        </fieldset>
        <div className="flex justify-end">
          <button type="submit" className="btn btn-primary" disabled={!dirty || save.isPending}>
            {save.isPending ? 'Salvando…' : 'Salvar perfil'}
          </button>
        </div>
      </form>
    </section>
  );
}

function ImagesSection({ profile }) {
  return (
    <section aria-labelledby="imagens" className="panel">
      <div className="panel-body space-y-5 p-4 sm:p-6">
        <SectionTitle id="imagens" title="Foto e banner">
          JPG, PNG, WebP, GIF ou AVIF. O tipo é conferido pelo conteúdo do arquivo no servidor.
        </SectionTitle>
        <div className="grid gap-6 md:grid-cols-2">
          <ImagePicker kind="avatar" label="Foto de perfil" current={profile.avatarUrl}>
            <Avatar src={profile.avatarUrl} name={profile.displayName} size="md" />
          </ImagePicker>
          <ImagePicker kind="banner" label="Banner de capa" current={profile.bannerUrl}>
            <div className="h-16 w-full max-w-[14rem] overflow-hidden border border-line bg-panel-3">
              {profile.bannerUrl && <img src={profile.bannerUrl} alt="Banner atual" className="h-full w-full object-cover" />}
            </div>
          </ImagePicker>
        </div>
      </div>
    </section>
  );
}

function ImagePicker({ kind, label, current, children }) {
  const toast = useToast();
  const inputId = useId();
  const upload = useLibraryMutation((file) => api.setProfileImage(kind, file), {
    onSuccess: () => toast.success(`${label} atualizada.`),
    onError: (error) => toast.error(error.message),
  });
  const remove = useLibraryMutation(() => api.removeProfileImage(kind), {
    onSuccess: () => toast.success(`${label} removida.`),
    onError: (error) => toast.error(error.message),
  });
  const busy = upload.isPending || remove.isPending;
  return (
    <div className="flex items-center gap-4">
      {children}
      <div className="min-w-0 space-y-2">
        <p className="font-display font-semibold">{label}</p>
        <input
          id={inputId}
          type="file"
          accept={ACCEPT}
          className="sr-only"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            if (file) upload.mutate(file);
          }}
        />
        <div className="flex flex-wrap gap-2">
          <label htmlFor={inputId} className={`btn btn-ghost btn-sm ${busy ? 'pointer-events-none opacity-60' : ''}`}>
            <FiUpload aria-hidden="true" /> {upload.isPending ? 'Enviando…' : current ? 'Trocar' : 'Enviar'}
          </label>
          {current && (
            <button type="button" className="btn btn-danger btn-sm" disabled={busy} onClick={() => remove.mutate()}>
              <FiTrash2 aria-hidden="true" /> Remover
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function PrivacySection({ profile }) {
  const toast = useToast();
  const update = useLibraryMutation((patch) => api.updatePrivacy(patch), {
    onError: (error) => toast.error(error.message),
  });
  const p = profile.privacy;
  const set = (key) => (value) => update.mutate({ [key]: value });
  return (
    <section id="privacidade" aria-labelledby="privacidade-titulo" className="panel">
      <div className="panel-body p-4 sm:p-6">
        <SectionTitle id="privacidade-titulo" title="Privacidade do perfil" accent="violet">
          Aplicado no servidor: o que estiver desligado nem sai da API pública. Você sempre vê tudo no seu perfil privado.
        </SectionTitle>
        <div className={`border p-4 ${p.isPublic ? 'border-ok/50 bg-ok/5' : 'border-line'}`}>
          <Toggle
            label="Perfil público"
            description={
              p.isPublic
                ? `Visitantes podem ver /u/${profile.username} com as seções abaixo.`
                : 'Privado: o endereço público responde como se o perfil não existisse.'
            }
            checked={p.isPublic}
            disabled={update.isPending}
            onChange={set('isPublic')}
          />
        </div>
        <div className="mt-4 grid gap-6 lg:grid-cols-2">
          {PRIVACY_GROUPS.map((group) => (
            <fieldset key={group.title} className="border-0 p-0">
              <legend className="font-display text-base font-semibold text-muted">{group.title}</legend>
              {group.note && <p className="mt-1 text-xs text-faint">{group.note}</p>}
              <div className="divide-y divide-line">
                {group.items.map(([key, label, description]) => (
                  <Toggle key={key} label={label} description={description} checked={p[key]} disabled={update.isPending} onChange={set(key)} />
                ))}
              </div>
            </fieldset>
          ))}
        </div>
        <p className="mt-4 text-sm text-muted">
          Coleções têm visibilidade própria: escolha quais compartilhar em <Link to="/colecoes">Coleções</Link>.
        </p>
      </div>
    </section>
  );
}

function ShareSection({ profile }) {
  const toast = useToast();
  async function copy() {
    try {
      await navigator.clipboard.writeText(profile.publicUrl);
      toast.success('Link copiado.');
    } catch {
      toast.error('Não foi possível copiar. Selecione o endereço e copie manualmente.');
    }
  }
  return (
    <section aria-labelledby="compartilhar" className="panel">
      <div className="panel-body space-y-4 p-4 sm:p-6">
        <SectionTitle id="compartilhar" title="Compartilhamento" />
        <div className="flex flex-wrap gap-2">
          <Link to="/configuracoes/previa" className="btn btn-ghost">
            <FiEye aria-hidden="true" /> Ver prévia como visitante
          </Link>
          {profile.publicUrl && profile.privacy.isPublic && (
            <button type="button" className="btn btn-primary" onClick={copy}>
              <FiCopy aria-hidden="true" /> Copiar link do perfil
            </button>
          )}
        </div>
        {profile.publicUrl ? (
          <p className="text-sm">
            Endereço público: <span className="num break-all text-cyan">{profile.publicUrl}</span>
            {!profile.privacy.isPublic && <span className="text-amber"> (ative “Perfil público” para funcionar)</span>}
          </p>
        ) : (
          <p className="border border-line bg-panel-2 px-4 py-3 text-sm text-muted">
            A aplicação está rodando só neste computador, então ainda não existe um link que outras pessoas consigam abrir. A
            prévia funciona normalmente. Quando hospedar o app, defina <span className="num text-ink">PUBLIC_APP_URL</span> no
            .env para liberar o botão de copiar o link.
          </p>
        )}
      </div>
    </section>
  );
}

function MaintenanceSection() {
  const toast = useToast();
  const rebuild = useLibraryMutation(() => api.rebuildProgress(), {
    onSuccess: (r) => toast.success(`Progressão recalculada: nível ${r.level}, ${r.totalXp} XP.`),
    onError: (error) => toast.error(error.message),
  });
  return (
    <section aria-labelledby="manutencao" className="panel">
      <div className="panel-body space-y-3 p-4 sm:p-6">
        <SectionTitle id="manutencao" title="Manutenção" />
        <p className="text-sm text-muted">
          Recalcular a progressão soma de novo o histórico de XP e reavalia conquistas e metas. Nada é duplicado.
        </p>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn btn-ghost" disabled={rebuild.isPending} onClick={() => rebuild.mutate()}>
            <FiRefreshCw aria-hidden="true" /> {rebuild.isPending ? 'Recalculando…' : 'Recalcular nível e XP'}
          </button>
          <Link to="/importar" className="btn btn-ghost">
            <FiDownload aria-hidden="true" /> Importar dados da versão antiga
          </Link>
        </div>
      </div>
    </section>
  );
}
