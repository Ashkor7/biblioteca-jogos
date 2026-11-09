import { useFinance, usePlatforms, useStores } from '../hooks/queries.js';
import { useUrlFilters } from '../hooks/useUrlFilters.js';
import SectionTitle from './SectionTitle.jsx';
import StatTile, { StatGrid } from './StatTile.jsx';
import TrendChart from './TrendChart.jsx';
import HBarChart from './HBarChart.jsx';
import DataTable from './DataTable.jsx';
import { LoadingState, ErrorState, EmptyState } from './States.jsx';
import { formatMoney, formatPercent, formatMonth, formatDate } from '../utils/format.js';
import { todayIn } from '../../shared/domain.js';

const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const signed = (value) => {
  const n = Number(value);
  return n < 0 ? <span className="text-amber">−{formatMoney(Math.abs(n))}</span> : formatMoney(n);
};

/**
 * Dashboard financeiro 2.0. Usa as MESMAS regras da visão geral (servidor): só compras
 * com preço original e pago; desejos nunca contam; sem data fica em "Sem data".
 */
export default function FinanceDashboard() {
  const { filters, update } = useUrlFilters({});
  const stores = useStores();
  const platforms = usePlatforms();
  const params = { year: filters.fano, month: filters.fano ? filters.fmes : undefined, storeId: filters.floja, platformId: filters.fplat };
  const finance = useFinance(params);
  const currentYear = Number(todayIn().slice(0, 4));
  const years = Array.from({ length: 12 }, (_, i) => currentYear - i);

  return (
    <section id="financeiro" aria-labelledby="financeiro-titulo" className="space-y-6">
      <SectionTitle id="financeiro-titulo" title="Dashboard financeiro" accent="amber">
        Linha do tempo das compras pela data de compra. Valor original é a soma das referências informadas, não o valor de mercado.
      </SectionTitle>
      <form role="search" aria-label="Filtrar finanças" onSubmit={(e) => e.preventDefault()} className="flex flex-wrap gap-2">
        <Select label="Ano" value={filters.fano} onChange={(v) => update({ fano: v, fmes: v ? filters.fmes : '' })}>
          <option value="">Todos os anos</option>
          {years.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </Select>
        <Select label="Mês" value={filters.fmes} onChange={(v) => update({ fmes: v })} disabled={!filters.fano}>
          <option value="">{filters.fano ? 'Todos os meses' : 'Escolha o ano para filtrar o mês'}</option>
          {MONTHS.map((m, i) => (
            <option key={m} value={i + 1}>
              {m}
            </option>
          ))}
        </Select>
        <Select label="Loja" value={filters.floja} onChange={(v) => update({ floja: v })}>
          <option value="">Todas as lojas</option>
          {stores.data?.items.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </Select>
        <Select label="Plataforma" value={filters.fplat} onChange={(v) => update({ fplat: v })}>
          <option value="">Todas as plataformas</option>
          {platforms.data?.items
            .filter((p) => p.ownedCount > 0)
            .map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
        </Select>
      </form>

      {finance.isPending ? (
        <LoadingState label="Calculando finanças…" />
      ) : finance.isError ? (
        <ErrorState error={finance.error} onRetry={finance.refetch} />
      ) : finance.data.totals.purchases === 0 ? (
        <EmptyState title="Nenhuma compra neste filtro">Ajuste os filtros ou registre o preço pago dos jogos.</EmptyState>
      ) : (
        <FinanceBody data={finance.data} />
      )}
    </section>
  );
}

function FinanceBody({ data }) {
  const t = data.totals;
  const savings = Number(t.savings);
  const monthly = data.monthly.map((m) => ({
    ...m,
    paid: Number(m.paidTotal),
    saved: Number(m.savings),
    cumulative: Number(m.cumulativePaid),
  }));
  return (
    <>
      <StatGrid label="Indicadores financeiros" className="grid-cols-2 lg:grid-cols-4">
        <StatTile label="Total pago" value={formatMoney(t.paidTotal)} note={`${t.pricedPurchases} compras com preço completo`} />
        <StatTile label="Valor original (referência)" value={formatMoney(t.originalTotal)} />
        <StatTile
          label={savings >= 0 ? 'Economia líquida' : 'Gasto acima da referência'}
          value={formatMoney(Math.abs(savings))}
          tone={savings >= 0 ? 'text-ok' : 'text-amber'}
          note={t.overpaidGames ? `${t.overpaidGames} compra(s) acima da referência reduzem o total` : undefined}
        />
        <StatTile label="Desconto médio ponderado" value={formatPercent(t.weightedDiscountPercent)} note="economia ÷ valor original" />
        <StatTile label="Média paga por jogo" value={formatMoney(t.averagePaid)} />
        <StatTile label="Compras no período" value={t.purchases} note={t.undatedPurchases ? `${t.undatedPurchases} sem data` : undefined} />
        {t.incompleteGames > 0 && (
          <StatTile label="Sem preço completo" value={t.incompleteGames} tone="text-amber" note="ficam fora das somas" />
        )}
      </StatGrid>

      {monthly.length > 0 && (
        <div className="grid gap-6 xl:grid-cols-2">
          <ChartPanel title="Gastos por mês">
            <TrendChart data={monthly} dataKey="paid" format={formatMoney} labelFormat={formatMonth} caption="Valor pago por mês" detail={(r) => `${r.purchases} compras`} />
          </ChartPanel>
          <ChartPanel title="Investimento acumulado">
            <TrendChart data={monthly} dataKey="cumulative" format={formatMoney} labelFormat={formatMonth} caption="Total pago acumulado ao longo do tempo" />
          </ChartPanel>
          <ChartPanel title="Economia por mês" note="Meses em âmbar: pago acima da referência.">
            <TrendChart kind="bar" data={monthly} dataKey="saved" format={formatMoney} labelFormat={formatMonth} caption="Economia líquida por mês" />
          </ChartPanel>
          <div className="min-w-0">
            <h3 className="mb-2 text-base text-muted">Por mês</h3>
            <DataTable
              caption="Compras por mês"
              columns={['Mês', 'Compras', 'Pago', 'Economia', 'Acumulado']}
              rows={[
                ...data.monthly.map((m) => [formatMonth(m.period), m.purchases, formatMoney(m.paidTotal), signed(m.savings), formatMoney(m.cumulativePaid)]),
                ...(data.undated && data.undated.purchases
                  ? [[<span key="u" className="text-muted">Sem data</span>, data.undated.purchases, formatMoney(data.undated.paidTotal), signed(data.undated.savings), '—']]
                  : []),
              ]}
            />
          </div>
        </div>
      )}

      {data.yearly.length > 0 && (
        <div>
          <h3 className="mb-2 text-base text-muted">Por ano</h3>
          <DataTable
            caption="Compras por ano"
            columns={['Ano', 'Compras', 'Original', 'Pago', 'Economia', 'Desconto']}
            rows={data.yearly.map((y) => [y.period, y.purchases, formatMoney(y.originalTotal), formatMoney(y.paidTotal), signed(y.savings), formatPercent(y.discountPercent)])}
          />
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-2">
        <Comparison title="Comparativo entre lojas" rows={data.stores} caption="Valor pago por loja" />
        <Comparison title="Comparativo entre plataformas" rows={data.platforms} caption="Valor pago por plataforma" />
      </div>

      <div>
        <h3 className="mb-2 text-base text-muted">Maiores economias individuais</h3>
        {data.topSavings.length === 0 ? (
          <p className="text-sm text-faint">Nenhuma compra abaixo da referência neste filtro.</p>
        ) : (
          <DataTable
            caption="Jogos com maior economia"
            columns={['Jogo', 'Loja', 'Original', 'Pago', 'Economia', 'Desconto']}
            rows={data.topSavings.map((g) => [
              <span key="t">
                {g.title} <span className="text-xs text-muted">· {g.platform}{g.purchasedAt ? ` · ${formatDate(g.purchasedAt)}` : ''}</span>
              </span>,
              g.store ?? '—',
              formatMoney(g.originalPrice),
              formatMoney(g.paidPrice),
              <span key="s" className="text-ok">{formatMoney(g.savings)}</span>,
              formatPercent(g.discountPercent),
            ])}
          />
        )}
      </div>
      <ul className="list-none space-y-1 p-0 text-xs text-faint">
        {data.notes.map((n) => (
          <li key={n}>{n}</li>
        ))}
      </ul>
    </>
  );
}

function Comparison({ title, rows, caption }) {
  const chart = rows.map((r) => ({ ...r, paid: Number(r.paidTotal) }));
  return (
    <div className="min-w-0 space-y-3">
      <h3 className="text-base text-muted">{title}</h3>
      {rows.length === 0 ? (
        <p className="text-sm text-faint">Sem dados.</p>
      ) : (
        <>
          <div className="panel">
            <div className="panel-body p-3 sm:p-4">
              <HBarChart data={chart} dataKey="paid" format={formatMoney} caption={caption} detail={(r) => `${r.purchases} compras · economia ${formatMoney(r.savings)}`} />
            </div>
          </div>
          <DataTable
            caption={title}
            columns={['Nome', 'Compras', 'Pago', 'Economia', 'Desconto']}
            rows={rows.map((r) => [r.name, r.purchases, formatMoney(r.paidTotal), signed(r.savings), formatPercent(r.discountPercent)])}
          />
        </>
      )}
    </div>
  );
}

function ChartPanel({ title, note, children }) {
  return (
    <div className="min-w-0">
      <h3 className="mb-2 text-base text-muted">{title}</h3>
      <div className="panel">
        <div className="panel-body p-3 sm:p-4">{children}</div>
      </div>
      {note && <p className="mt-1 text-xs text-faint">{note}</p>}
    </div>
  );
}

function Select({ label, value, onChange, children, disabled = false }) {
  return (
    <label className="block min-w-0 flex-[1_1_10rem]">
      <span className="text-xs text-muted">{label}</span>
      <select className="input" value={value ?? ''} onChange={(e) => onChange(e.target.value)} disabled={disabled}>
        {children}
      </select>
    </label>
  );
}
