import { useState } from 'react';
import { Link } from 'react-router';
import { FiTarget, FiLock } from 'react-icons/fi';
import { useAchievements, useProfile, useXpHistory } from '../hooks/queries.js';
import PageHeader from '../components/PageHeader.jsx';
import SectionTitle from '../components/SectionTitle.jsx';
import XpBar from '../components/XpBar.jsx';
import AchievementCard from '../components/AchievementCard.jsx';
import DataTable from '../components/DataTable.jsx';
import { LoadingState, ErrorState } from '../components/States.jsx';
import { XP_RULES } from '../../shared/progression.js';
import { formatDate } from '../utils/format.js';

const STATES = [
  ['all', 'Todas'],
  ['unlocked', 'Desbloqueadas'],
  ['locked', 'Bloqueadas'],
];

export default function AchievementsPage() {
  const achievements = useAchievements();
  const profile = useProfile();
  const [state, setState] = useState('all');
  const [category, setCategory] = useState('');

  return (
    <div className="page-enter space-y-10">
      <PageHeader
        title="Metas e conquistas"
        actions={
          <Link to="/metas" className="btn btn-primary">
            <FiTarget aria-hidden="true" /> Minhas metas
          </Link>
        }
      >
        Conquistas são verificadas no servidor a partir dos dados reais da biblioteca. Depois de desbloqueada, a conquista é
        permanente.
      </PageHeader>

      {profile.data && (
        <section aria-label="Nível" className="panel panel-accent">
          <div className="panel-body grid gap-4 p-4 sm:grid-cols-[1fr_auto] sm:items-center sm:p-6">
            <XpBar progress={profile.data.progress} />
            <p className="text-sm text-muted sm:text-right">
              Título atual: <span className="font-display font-semibold text-amber">{profile.data.title.name}</span>
              <br />
              <span className="num text-ink">{profile.data.achievementsUnlocked}</span> de {profile.data.achievementsTotal} conquistas
            </p>
          </div>
        </section>
      )}

      <section aria-labelledby="lista-conquistas">
        <SectionTitle id="lista-conquistas" title="Conquistas" accent="amber" />
        {achievements.isPending ? (
          <LoadingState label="Verificando conquistas…" />
        ) : achievements.isError ? (
          <ErrorState error={achievements.error} onRetry={achievements.refetch} />
        ) : (
          <AchievementList items={achievements.data.items} state={state} setState={setState} category={category} setCategory={setCategory} />
        )}
      </section>

      <div className="grid gap-10 xl:grid-cols-2">
        <TitlesSection profile={profile.data} />
        <XpRules />
      </div>
      <XpHistory />
    </div>
  );
}

function AchievementList({ items, state, setState, category, setCategory }) {
  const categories = [...new Set(items.map((a) => a.category))];
  const shown = items
    .filter((a) => (state === 'all' ? true : state === 'unlocked' ? a.unlocked : !a.unlocked))
    .filter((a) => !category || a.category === category)
    .sort((a, b) => Number(b.unlocked) - Number(a.unlocked) || b.percent - a.percent);
  return (
    <>
      <div className="mb-4 flex flex-wrap gap-2">
        <div className="segmented min-w-[18rem] flex-1 sm:flex-none" role="radiogroup" aria-label="Filtrar por estado">
          {STATES.map(([value, label]) => (
            <label key={value}>
              <input type="radio" name="estado-conquista" checked={state === value} onChange={() => setState(value)} />
              {label}
            </label>
          ))}
        </div>
        <label className="block min-w-0 flex-[1_1_12rem] sm:max-w-xs">
          <span className="sr-only">Categoria</span>
          <select className="input" value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Categoria">
            <option value="">Todas as categorias</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
      </div>
      {shown.length === 0 ? (
        <p className="text-sm text-faint">Nenhuma conquista neste filtro.</p>
      ) : (
        <ul className="grid list-none gap-3 p-0 sm:grid-cols-2 xl:grid-cols-3">
          {shown.map((a) => (
            <li key={a.code}>
              <AchievementCard achievement={a} />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function TitlesSection({ profile }) {
  if (!profile) return null;
  return (
    <section aria-labelledby="titulos">
      <SectionTitle id="titulos" title="Títulos" accent="amber" action={<Link to="/configuracoes" className="text-sm">Escolher título</Link>} />
      <ul className="list-none space-y-2 p-0">
        {profile.titles.map((t) => (
          <li key={t.code} className={`flex items-center justify-between gap-3 border px-3 py-2 ${t.selected ? 'border-amber/60 bg-amber-soft' : 'border-line'}`}>
            <span className="min-w-0">
              <span className={`flex items-center gap-1.5 font-display font-semibold ${t.unlocked ? 'text-ink' : 'text-faint'}`}>
                {!t.unlocked && <FiLock aria-label="Bloqueado" />} {t.name}
              </span>
              <span className="block text-xs text-muted">{t.hint}</span>
            </span>
            <span className={`shrink-0 text-xs ${t.selected ? 'text-amber' : t.unlocked ? 'text-ok' : 'text-faint'}`}>
              {t.selected ? 'Em uso' : t.unlocked ? 'Desbloqueado' : 'Bloqueado'}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function XpRules() {
  return (
    <section aria-labelledby="regras-xp">
      <SectionTitle id="regras-xp" title="Como ganhar XP" accent="violet" />
      <div className="panel">
        <div className="panel-body space-y-2 p-4 text-sm">
          <ul className="list-none space-y-1 p-0">
            {Object.entries(XP_RULES).map(([key, rule]) => (
              <li key={key} className="readout">
                <span>{rule.label}</span>
                <span className="num text-violet">
                  +{rule.amount} XP{' '}
                  <span className="text-xs text-faint">
                    (até {rule.cap} {rule.windowHours >= 24 * 365 ? 'por ano' : 'por dia'})
                  </span>
                </span>
              </li>
            ))}
            <li className="readout">
              <span>Desbloquear uma conquista</span>
              <span className="num text-violet">XP indicado no cartão</span>
            </li>
          </ul>
          <p className="text-xs text-faint">
            Cada evento paga uma única vez: editar o mesmo jogo, zerar de novo ou recriar registros não gera XP repetido. Criar ou
            editar metas não dá XP. Sessões só pagam a partir de {XP_RULES.SESSION_LOGGED.minMinutes} minutos.
          </p>
        </div>
      </div>
    </section>
  );
}

function XpHistory() {
  const xp = useXpHistory();
  return (
    <section aria-labelledby="historico-xp">
      <SectionTitle id="historico-xp" title="Histórico de XP" accent="violet">
        Os 50 registros mais recentes do livro-razão.
      </SectionTitle>
      {xp.isPending ? (
        <LoadingState />
      ) : xp.isError ? (
        <ErrorState error={xp.error} onRetry={xp.refetch} />
      ) : xp.data.items.length === 0 ? (
        <p className="text-sm text-faint">Nenhum XP ainda.</p>
      ) : (
        <DataTable
          caption="Histórico de XP"
          columns={['Motivo', 'Data', 'XP']}
          rows={xp.data.items.map((x) => [
            <span key="d">
              {x.description}
              {x.retroactive && <span className="ml-2 text-xs text-faint">(retroativo)</span>}
            </span>,
            formatDate(x.createdAt),
            <span key="a" className="text-violet">+{x.amount}</span>,
          ])}
        />
      )}
    </section>
  );
}
