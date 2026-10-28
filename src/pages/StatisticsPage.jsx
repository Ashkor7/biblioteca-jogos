import { useUrlFilters } from '../hooks/useUrlFilters.js';
import { useOverview, useStoreStats, useCategoryStats, usePlatformStats } from '../hooks/queries.js';
import PageHeader from '../components/PageHeader.jsx';
import HBarChart from '../components/HBarChart.jsx';
import { ReadoutStrip } from '../components/Readouts.jsx';
import { LoadingState, ErrorState, EmptyState } from '../components/States.jsx';
import { formatMoney, formatHours, formatPercent } from '../utils/format.js';
import { minutesToHours } from '../../shared/domain.js';

const STORE_SORTS = [
  ['count', 'Quantidade'],
  ['savings', 'Economia (R$)'],
  ['percent', 'Desconto (%)'],
];

export default function StatisticsPage() {
  const overview = useOverview();
  if (overview.isPending) return <LoadingState label="Calculando estatísticas…" />;
  if (overview.isError) return <ErrorState error={overview.error} onRetry={overview.refetch} />;
  const o = overview.data;

  if (o.library.owned === 0 && o.wishlist.count === 0) {
    return (
      <div className="page-enter">
        <PageHeader title="Estatísticas" />
        <EmptyState title="Ainda não há dados">
          As estatísticas são calculadas a partir dos jogos cadastrados. Adicione jogos para ver gastos, horas e lojas.
        </EmptyState>
      </div>
    );
  }

  const savingsValue = Number(o.finance.savings);
  return (
    <div className="page-enter space-y-10">
      <PageHeader title="Estatísticas">
        Calculado no servidor a partir da biblioteca. Itens da lista de desejos não entram em contagens de compra, gastos ou
        horas.
      </PageHeader>

      <section aria-labelledby="colecao" className="space-y-3">
        <h2 id="colecao" className="text-xl">
          Coleção
        </h2>
        <ReadoutStrip
          label="Coleção"
          items={[
            { label: 'Jogos na biblioteca', value: o.library.owned, note: `${o.library.physical} físicos, ${o.library.digital} digitais` },
            { label: 'Zerados', value: o.library.completed, tone: 'text-ok' },
            {
              label: 'Não iniciados',
              value: o.library.notStarted,
              note: `${o.library.abandoned} ${o.library.abandoned === 1 ? 'abandonado' : 'abandonados'}`,
            },
            { label: 'Horas totais', value: formatHours(o.playTime.totalMinutes), note: 'cada jogo contado uma vez' },
          ]}
        />
      </section>

      <section aria-labelledby="dinheiro" className="space-y-3">
        <h2 id="dinheiro" className="text-xl">
          Dinheiro
        </h2>
        <ReadoutStrip
          label="Dinheiro"
          items={[
            { label: 'Valor sem desconto', value: formatMoney(o.finance.originalTotal), note: 'soma dos preços originais' },
            { label: 'Total pago', value: formatMoney(o.finance.paidTotal) },
            {
              label: savingsValue >= 0 ? 'Economia líquida' : 'Gasto acima da referência',
              value: formatMoney(Math.abs(savingsValue)),
              tone: savingsValue >= 0 ? 'text-ok' : 'text-amber',
              note:
                o.finance.discountPercent !== null ? `${formatPercent(o.finance.discountPercent)} de desconto total` : 'sem preços de referência',
            },
            {
              label: 'Valor atual dos desejos',
              value: formatMoney(o.wishlist.currentValue),
              tone: 'text-magenta',
              note: o.wishlist.isPartial
                ? `parcial: ${o.wishlist.withoutPrice} sem preço informado`
                : `${o.wishlist.count} ${o.wishlist.count === 1 ? 'item' : 'itens'}, preços informados por você`,
            },
          ]}
        />
        {(o.finance.pendingPriceReview > 0 || o.finance.overpaidGames > 0) && (
          <ul className="list-none space-y-1 p-0 text-sm text-muted">
            {o.finance.pendingPriceReview > 0 && (
              <li>
                <span className="text-amber">{o.finance.pendingPriceReview}</span> jogo(s) importado(s) sem preço pago ainda
                não entram nos valores acima.
              </li>
            )}
            {o.finance.overpaidGames > 0 && (
              <li>
                <span className="text-amber">{o.finance.overpaidGames}</span> compra(s) custaram mais que o preço de referência e
                reduzem a economia.
              </li>
            )}
          </ul>
        )}
      </section>

      <StoresSection />
      <CategoriesSection />
      <PlatformsSection />
    </div>
  );
}

function StoresSection() {
  const { filters, update } = useUrlFilters({ lojas: 'count' });
  const sort = filters.lojas;
  const stores = useStoreStats(sort);
  const metric = {
    count: { key: 'games', format: (v) => `${v}`, label: 'compras' },
    savings: { key: 'savingsNumber', format: (v) => formatMoney(v), label: 'economia' },
    percent: { key: 'discountPercent', format: (v) => formatPercent(v), label: 'desconto' },
  }[sort];

  const rows = (stores.data?.items ?? []).map((s) => ({ ...s, savingsNumber: Number(s.savings) }));
  const chartRows = sort === 'percent' ? rows.filter((r) => r.discountPercent !== null) : rows;

  return (
    <section aria-labelledby="lojas" className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 id="lojas" className="text-xl">
            Onde você compra
          </h2>
          <p className="text-sm text-muted">Agrupado pela loja (vendedor), não pela plataforma.</p>
        </div>
        <div className="segmented sm:min-w-[22rem]" role="radiogroup" aria-label="Classificar lojas por">
          {STORE_SORTS.map(([value, label]) => (
            <label key={value}>
              <input type="radio" name="lojas-ordem" checked={sort === value} onChange={() => update({ lojas: value })} />
              {label}
            </label>
          ))}
        </div>
      </div>
      {stores.isPending ? (
        <LoadingState />
      ) : stores.isError ? (
        <ErrorState error={stores.error} onRetry={stores.refetch} />
      ) : rows.length === 0 ? (
        <EmptyState title="Nenhuma compra com loja informada" />
      ) : (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)]">
          <div className="panel">
            <div className="panel-body p-3 sm:p-4">
              <HBarChart
                data={chartRows}
                dataKey={metric.key}
                integer={sort === 'count'}
                format={metric.format}
                caption={`Lojas por ${metric.label}`}
                detail={(r) => `${r.games} ${r.games === 1 ? 'compra' : 'compras'} · pago ${formatMoney(r.paidTotal)}`}
              />
            </div>
          </div>
          <DataTable
            caption="Resumo por loja"
            columns={['Loja', 'Compras', 'Referência', 'Pago', 'Economia', 'Desconto']}
            rows={rows.map((r) => [
              r.name,
              r.games,
              formatMoney(r.originalTotal),
              formatMoney(r.paidTotal),
              <span key="s" className={r.savingsNumber < 0 ? 'text-amber' : ''}>
                {r.savingsNumber < 0 ? `−${formatMoney(Math.abs(r.savingsNumber))}` : formatMoney(r.savingsNumber)}
              </span>,
              formatPercent(r.discountPercent),
            ])}
          />
        </div>
      )}
      {stores.data?.gamesWithoutStore > 0 && (
        <p className="text-sm text-muted">{stores.data.gamesWithoutStore} jogo(s) sem loja informada ficam fora deste ranking.</p>
      )}
    </section>
  );
}

function CategoriesSection() {
  const categories = useCategoryStats();
  const data = categories.data;
  return (
    <section aria-labelledby="categorias" className="space-y-4">
      <div>
        <h2 id="categorias" className="text-xl">
          Horas por categoria
        </h2>
        {data && <p className="max-w-2xl text-sm text-muted">{data.note}</p>}
      </div>
      {categories.isPending ? (
        <LoadingState />
      ) : categories.isError ? (
        <ErrorState error={categories.error} onRetry={categories.refetch} />
      ) : data.items.length === 0 ? (
        <EmptyState title="Nenhuma categoria nos jogos adquiridos" />
      ) : (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div className="panel">
            <div className="panel-body p-3 sm:p-4">
              <HBarChart
                data={data.items.map((c) => ({ ...c, hours: minutesToHours(c.minutes) }))}
                dataKey="hours"
                format={(v) => formatHours(v * 60)}
                caption="Horas jogadas por categoria"
                detail={(r) => `${r.games} ${r.games === 1 ? 'jogo' : 'jogos'}`}
              />
            </div>
          </div>
          <DataTable
            caption="Horas por categoria"
            columns={['Categoria', 'Jogos', 'Horas']}
            rows={[
              ...data.items.map((c) => [c.name, c.games, formatHours(c.minutes)]),
              ...(data.uncategorized.games
                ? [[<span key="u" className="text-muted">Sem categoria</span>, data.uncategorized.games, formatHours(data.uncategorized.minutes)]]
                : []),
            ]}
            footer={['Total geral (sem repetição)', '', formatHours(data.totalMinutes)]}
          />
        </div>
      )}
    </section>
  );
}

function PlatformsSection() {
  const platforms = usePlatformStats();
  return (
    <section aria-labelledby="plataformas" className="space-y-4">
      <h2 id="plataformas" className="text-xl">
        Jogos por plataforma
      </h2>
      {platforms.isPending ? (
        <LoadingState />
      ) : platforms.isError ? (
        <ErrorState error={platforms.error} onRetry={platforms.refetch} />
      ) : platforms.data.items.length === 0 ? (
        <EmptyState title="Nenhum jogo adquirido" />
      ) : (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)]">
          <div className="panel">
            <div className="panel-body p-3 sm:p-4">
              <HBarChart
                data={platforms.data.items}
                dataKey="games"
                integer
                format={(v) => `${v}`}
                caption="Jogos adquiridos por plataforma"
                detail={(r) => `${r.completed} zerados · ${formatHours(r.minutes)}`}
              />
            </div>
          </div>
          <DataTable
            caption="Resumo por plataforma"
            columns={['Plataforma', 'Jogos', 'Zerados', 'Horas', 'Pago']}
            rows={platforms.data.items.map((p) => [p.name, p.games, p.completed, formatHours(p.minutes), formatMoney(p.paidTotal)])}
          />
        </div>
      )}
    </section>
  );
}

function DataTable({ caption, columns, rows, footer }) {
  return (
    <div className="overflow-x-auto border border-line">
      <table className="w-full min-w-[28rem] border-collapse text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="bg-panel-2">
            {columns.map((c, i) => (
              <th key={c} scope="col" className={`px-3 py-2 font-display font-semibold text-muted ${i === 0 ? 'text-left' : 'text-right'}`}>
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, r) => (
            <tr key={r} className="border-t border-line">
              {row.map((cell, i) =>
                i === 0 ? (
                  <th key={i} scope="row" className="px-3 py-2 text-left font-normal text-ink">
                    {cell}
                  </th>
                ) : (
                  <td key={i} className="num px-3 py-2 text-right">
                    {cell}
                  </td>
                ),
              )}
            </tr>
          ))}
        </tbody>
        {footer && (
          <tfoot>
            <tr className="border-t border-line-strong bg-panel-2">
              {footer.map((cell, i) => (
                <td key={i} className={`px-3 py-2 ${i === 0 ? 'text-left font-display font-semibold' : 'num text-right'}`}>
                  {cell}
                </td>
              ))}
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}
