import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from 'recharts';

// Mesmas cores validadas do HBarChart: série única em ciano-escuro, âmbar para negativos.
const SERIES = '#169aa3';
const NEGATIVE = '#c98320';
const GRID = '#1c2a42';
const TICK = '#8f9fba';

function TooltipBox({ active, payload, label, format, labelFormat, detail }) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  return (
    <div className="border border-line-strong bg-panel-2 px-3 py-2 text-sm shadow-lg shadow-black/50">
      <p className="font-display font-semibold text-ink">{labelFormat ? labelFormat(label) : label}</p>
      <p className="num text-ink">{format(payload[0].value)}</p>
      {detail && <p className="text-xs text-muted">{detail(row)}</p>}
    </div>
  );
}

const axisProps = { tick: { fill: TICK, fontSize: 11 }, axisLine: { stroke: GRID }, tickLine: false };

/**
 * Série única no tempo: linha (`kind="line"`) ou colunas (`kind="bar"`).
 * Sempre acompanhada de tabela na página — o gráfico é aria-hidden.
 */
export default function TrendChart({ data, dataKey, xKey = 'period', format, labelFormat, detail, caption, kind = 'line', height = 220 }) {
  const common = {
    data,
    margin: { top: 8, right: 12, bottom: 4, left: 4 },
  };
  const x = <XAxis dataKey={xKey} tickFormatter={labelFormat} minTickGap={16} {...axisProps} />;
  const y = <YAxis tickFormatter={format} width={72} allowDecimals={false} {...axisProps} />;
  const tip = (
    <Tooltip
      cursor={{ stroke: '#ffffff22', fill: '#ffffff0a' }}
      content={<TooltipBox format={format} labelFormat={labelFormat} detail={detail} />}
      isAnimationActive={false}
    />
  );
  return (
    <figure>
      <figcaption className="sr-only">{caption}</figcaption>
      <div style={{ height }} aria-hidden="true">
        <ResponsiveContainer width="100%" height="100%">
          {kind === 'bar' ? (
            <BarChart {...common} barCategoryGap="22%">
              <CartesianGrid vertical={false} stroke={GRID} strokeDasharray="2 4" />
              {x}
              {y}
              {tip}
              <ReferenceLine y={0} stroke={GRID} />
              <Bar dataKey={dataKey} radius={[3, 3, 0, 0]} isAnimationActive={false}>
                {data.map((row, i) => (
                  <Cell key={i} fill={Number(row[dataKey]) < 0 ? NEGATIVE : SERIES} />
                ))}
              </Bar>
            </BarChart>
          ) : (
            <LineChart {...common}>
              <CartesianGrid vertical={false} stroke={GRID} strokeDasharray="2 4" />
              {x}
              {y}
              {tip}
              <Line
                type="monotone"
                dataKey={dataKey}
                stroke={SERIES}
                strokeWidth={2}
                dot={{ r: 3, fill: SERIES, strokeWidth: 0 }}
                activeDot={{ r: 5 }}
                isAnimationActive={false}
              />
            </LineChart>
          )}
        </ResponsiveContainer>
      </div>
    </figure>
  );
}
