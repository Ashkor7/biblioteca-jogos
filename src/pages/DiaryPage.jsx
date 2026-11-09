import { useState } from 'react';
import { Link } from 'react-router';
import { FiPlus, FiChevronLeft, FiChevronRight, FiCalendar, FiClock, FiActivity, FiBookOpen } from 'react-icons/fi';
import { useDiary, useSessions, useGames } from '../hooks/queries.js';
import { useUrlFilters } from '../hooks/useUrlFilters.js';
import PageHeader from '../components/PageHeader.jsx';
import SectionTitle from '../components/SectionTitle.jsx';
import StatTile, { StatGrid } from '../components/StatTile.jsx';
import TrendChart from '../components/TrendChart.jsx';
import DataTable from '../components/DataTable.jsx';
import SessionDialog from '../components/SessionDialog.jsx';
import SessionList from '../components/SessionList.jsx';
import Pagination from '../components/Pagination.jsx';
import { LoadingState, ErrorState, EmptyState } from '../components/States.jsx';
import { formatDuration, minutesToHours } from '../../shared/domain.js';
import { formatDay } from '../utils/format.js';

const WEEKDAYS = ['seg', 'ter', 'qua', 'qui', 'sex', 'sáb', 'dom'];
const monthName = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric', timeZone: 'UTC' });
const capitalize = (text) => text.charAt(0).toUpperCase() + text.slice(1);

function shiftMonth(month, delta) {
  const d = new Date(`${month}-01T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + delta);
  return d.toISOString().slice(0, 7);
}

export default function DiaryPage() {
  const [creating, setCreating] = useState(false);
  const [month, setMonth] = useState(null);
  const diary = useDiary(month ? { month } : {});
  const addButton = (
    <button type="button" className="btn btn-primary" onClick={() => setCreating(true)}>
      <FiPlus aria-hidden="true" /> Registrar sessão
    </button>
  );

  return (
    <div className="page-enter space-y-10">
      <PageHeader title="Diário de jogatina" actions={addButton}>
        Cada sessão soma no tempo do jogo. As horas que você já tinha antes do diário continuam como saldo inicial, sem data, e
        nunca são somadas de novo.
      </PageHeader>

      {diary.isPending ? (
        <LoadingState label="Carregando diário…" />
      ) : diary.isError ? (
        <ErrorState error={diary.error} onRetry={diary.refetch} />
      ) : diary.data.allTime.sessions === 0 ? (
        <EmptyState title="O diário ainda está vazio" action={addButton}>
          Registre quanto tempo jogou e, se quiser, o que aconteceu na sessão. Sessões alimentam metas, conquistas e o seu perfil.
        </EmptyState>
      ) : (
        <Summary data={diary.data} onMonth={setMonth} />
      )}

      <SessionsSection />
      {creating && <SessionDialog onClose={() => setCreating(false)} />}
    </div>
  );
}

function Summary({ data, onMonth }) {
  const weekRows = data.week.days.map((d, i) => ({ ...d, label: WEEKDAYS[i], hours: minutesToHours(d.minutes) }));
  return (
    <>
      <StatGrid label="Resumo do diário" className="grid-cols-2 lg:grid-cols-4">
        <StatTile icon={FiClock} label="Nesta semana" value={formatDuration(data.week.minutes)} tone="text-violet" note={`${formatDay(data.week.from)} a ${formatDay(data.week.to)}`} />
        <StatTile icon={FiCalendar} label={`Em ${monthName.format(new Date(`${data.month.from}T00:00:00Z`))}`} value={formatDuration(data.month.minutes)} note={`${data.month.sessions} sessões`} />
        <StatTile icon={FiActivity} label="Dias ativos no mês" value={data.month.activeDays} tone="text-blue" />
        <StatTile icon={FiBookOpen} label="Total no diário" value={formatDuration(data.allTime.minutes)} note={`${data.allTime.activeDays} dias ativos`} />
      </StatGrid>

      <div className="grid gap-8 xl:grid-cols-2">
        <section aria-labelledby="semana">
          <SectionTitle id="semana" title="Horas nesta semana" accent="violet" />
          <div className="panel">
            <div className="panel-body p-3 sm:p-4">
              <TrendChart
                kind="bar"
                data={weekRows}
                xKey="label"
                dataKey="hours"
                format={(v) => `${v} h`}
                caption="Horas jogadas por dia nesta semana"
                height={200}
              />
            </div>
          </div>
          <div className="mt-3" style={{ '--table-min': '18rem' }}>
            <DataTable caption="Horas por dia da semana" columns={['Dia', 'Tempo']} rows={weekRows.map((d) => [`${d.label} · ${formatDay(d.day)}`, formatDuration(d.minutes)])} />
          </div>
        </section>
        <CalendarSection month={data.month} today={data.today} onMonth={onMonth} />
      </div>

      <section aria-labelledby="mais-jogados">
        <SectionTitle id="mais-jogados" title="Mais jogados no diário" accent="blue" />
        {data.topGames.length === 0 ? (
          <p className="text-sm text-faint">Nenhuma sessão ainda.</p>
        ) : (
          <div style={{ '--table-min': '22rem' }}>
            <DataTable
              caption="Jogos com mais tempo registrado no diário"
              columns={['Jogo', 'Sessões', 'Tempo', 'Última vez']}
              rows={data.topGames.map((g) => [
                <Link key="t" to={`/jogos/${g.id}`}>
                  {g.title} <span className="text-xs text-muted">· {g.platform}</span>
                </Link>,
                g.sessions,
                formatDuration(g.minutes),
                formatDay(g.lastPlayed),
              ])}
            />
          </div>
        )}
      </section>
    </>
  );
}

/** Calendário do mês: intensidade pela quantidade de horas (com o valor em texto também). */
function CalendarSection({ month, today, onMonth }) {
  const byDay = new Map(month.days.map((d) => [d.day, d]));
  const first = new Date(`${month.from}T00:00:00Z`);
  const offset = (first.getUTCDay() + 6) % 7; // segunda = 0
  const total = Number(month.to.slice(8, 10));
  const cells = [...Array(offset).fill(null), ...Array.from({ length: total }, (_, i) => `${month.month}-${String(i + 1).padStart(2, '0')}`)];
  const level = (min) => (!min ? 0 : min < 60 ? 1 : min < 150 ? 2 : min < 300 ? 3 : 4);
  const isCurrent = month.month === today.slice(0, 7);
  return (
    <section aria-labelledby="calendario">
      <SectionTitle
        id="calendario"
        title="Calendário de atividade"
        accent="violet"
        action={
          <div className="flex items-center gap-1">
            <button type="button" className="btn btn-ghost btn-sm btn-icon" onClick={() => onMonth(shiftMonth(month.month, -1))} aria-label="Mês anterior">
              <FiChevronLeft aria-hidden="true" />
            </button>
            <span className="min-w-[9rem] text-center text-sm">{capitalize(monthName.format(first))}</span>
            <button
              type="button"
              className="btn btn-ghost btn-sm btn-icon"
              onClick={() => onMonth(shiftMonth(month.month, 1))}
              disabled={isCurrent}
              aria-label="Próximo mês"
            >
              <FiChevronRight aria-hidden="true" />
            </button>
          </div>
        }
      />
      <div className="panel">
        <div className="panel-body p-3 sm:p-4">
          <div className="grid grid-cols-7 gap-1 text-center text-xs text-faint" aria-hidden="true">
            {WEEKDAYS.map((d) => (
              <span key={d}>{d}</span>
            ))}
          </div>
          <ol className="mt-1 grid list-none grid-cols-7 gap-1 p-0" aria-label={`Dias jogados em ${monthName.format(first)}`}>
            {cells.map((day, i) =>
              day ? (
                <li
                  key={day}
                  className={`heat-${level(byDay.get(day)?.minutes)} flex aspect-square flex-col items-center justify-center text-xs ${day === today ? 'ring-1 ring-cyan' : ''}`}
                  title={byDay.get(day) ? `${formatDay(day)}: ${formatDuration(byDay.get(day).minutes)}` : formatDay(day)}
                >
                  <span className="num">{Number(day.slice(8))}</span>
                  <span className="sr-only">{byDay.get(day) ? `: ${formatDuration(byDay.get(day).minutes)}` : ': sem sessões'}</span>
                </li>
              ) : (
                <li key={`vazio-${i}`} aria-hidden="true" />
              ),
            )}
          </ol>
          <p className="mt-3 flex items-center gap-2 text-xs text-faint">
            Menos <span className="heat-1 inline-block h-3 w-3" /> <span className="heat-2 inline-block h-3 w-3" />
            <span className="heat-3 inline-block h-3 w-3" /> <span className="heat-4 inline-block h-3 w-3" /> Mais
            <span className="ml-auto num">{month.activeDays} dias ativos</span>
          </p>
        </div>
      </div>
    </section>
  );
}

function SessionsSection() {
  const { filters, update } = useUrlFilters({ page: '1' });
  const games = useGames({ ownership: 'OWNED', sort: 'title', pageSize: 200 });
  const sessions = useSessions({ gameId: filters.jogo, from: filters.de, to: filters.ate, page: filters.page, pageSize: 20 });
  return (
    <section aria-labelledby="sessoes">
      <SectionTitle id="sessoes" title="Sessões" accent="cyan">
        {sessions.data && (
          <>
            <span className="num">{sessions.data.total}</span> sessões · <span className="num">{formatDuration(sessions.data.totalMinutes)}</span> no filtro
          </>
        )}
      </SectionTitle>
      <form role="search" aria-label="Filtrar sessões" onSubmit={(e) => e.preventDefault()} className="mb-4 flex flex-wrap gap-2">
        <label className="block min-w-0 flex-[2_1_14rem]">
          <span className="text-xs text-muted">Jogo</span>
          <select className="input" value={filters.jogo ?? ''} onChange={(e) => update({ jogo: e.target.value, page: '1' })} aria-label="Jogo">
            <option value="">Todos os jogos</option>
            {games.data?.items.map((g) => (
              <option key={g.id} value={g.id}>
                {g.title}
              </option>
            ))}
          </select>
        </label>
        <label className="block min-w-0 flex-[1_1_9rem]">
          <span className="text-xs text-muted">De</span>
          <input type="date" className="input" value={filters.de ?? ''} onChange={(e) => update({ de: e.target.value, page: '1' })} />
        </label>
        <label className="block min-w-0 flex-[1_1_9rem]">
          <span className="text-xs text-muted">Até</span>
          <input type="date" className="input" value={filters.ate ?? ''} onChange={(e) => update({ ate: e.target.value, page: '1' })} />
        </label>
      </form>
      {sessions.isPending ? (
        <LoadingState />
      ) : sessions.isError ? (
        <ErrorState error={sessions.error} onRetry={sessions.refetch} />
      ) : sessions.data.items.length === 0 ? (
        <EmptyState title="Nenhuma sessão encontrada">Ajuste os filtros ou registre uma sessão.</EmptyState>
      ) : (
        <>
          <SessionList sessions={sessions.data.items} />
          <Pagination
            page={sessions.data.page}
            totalPages={sessions.data.totalPages}
            total={sessions.data.total}
            noun="sessões"
            onPage={(page) => update({ page: String(page) })}
          />
        </>
      )}
    </section>
  );
}
