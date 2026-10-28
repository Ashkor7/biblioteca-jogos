import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell } from 'recharts';

// Cores validadas para a superfície escura (OKLCH L 0.48–0.67, ΔE CVD > 15):
// barra padrão em ciano-escuro; âmbar só para valores negativos (gasto acima da referência).
const BAR = '#169aa3';
const BAR_NEGATIVE = '#c98320';
const GRID = '#1f2c40';
const TICK = '#8d9db4';

function truncate(text, max = 18) {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function Tick({ x, y, payload }) {
  return (
    <text x={x} y={y} dy={4} textAnchor="end" fill={TICK} fontSize={12}>
      <title>{payload.value}</title>
      {truncate(payload.value)}
    </text>
  );
}

function TooltipBox({ active, payload, format, detail }) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  return (
    <div className="border border-line-strong bg-panel-2 px-3 py-2 text-sm shadow-lg shadow-black/50">
      <p className="font-display font-semibold text-ink">{row.name}</p>
      <p className="num text-ink">{format(payload[0].value)}</p>
      {detail && <p className="text-xs text-muted">{detail(row)}</p>}
    </div>
  );
}

/** Barras horizontais de uma única série (o título da figura nomeia a medida). */
export default function HBarChart({ data, dataKey, format, detail, caption, integer = false }) {
  const height = Math.max(120, data.length * 34 + 36);
  return (
    <figure >
      <figcaption className="sr-only">{caption}</figcaption>
      <div style={{ height }} aria-hidden="true">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, bottom: 4, left: 4 }} barCategoryGap={8}>
            <CartesianGrid horizontal={false} stroke={GRID} strokeDasharray="2 4" />
            <XAxis
              type="number"
              domain={[(min) => Math.min(0, min), 'auto']}
              tickFormatter={format}
              allowDecimals={!integer}
              tick={{ fill: TICK, fontSize: 11 }}
              axisLine={{ stroke: GRID }}
              tickLine={false}
              minTickGap={24}
            />
            <YAxis type="category" dataKey="name" width={128} tick={<Tick />} axisLine={false} tickLine={false} interval={0} />
            <Tooltip
              cursor={{ fill: '#ffffff0a' }}
              content={<TooltipBox format={format} detail={detail} />}
              isAnimationActive={false}
            />
            <Bar dataKey={dataKey} radius={[0, 4, 4, 0]} barSize={14} isAnimationActive={false}>
              {data.map((row) => (
                <Cell key={row.id ?? row.name} fill={Number(row[dataKey]) < 0 ? BAR_NEGATIVE : BAR} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </figure>
  );
}
