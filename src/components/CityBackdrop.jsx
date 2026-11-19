// Cidade neon do fundo, gerada uma vez de forma determinística (sem Math.random:
// o desenho é sempre igual). SVG estático: sem imagens remotas e sem animação.

function rng(seed) {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

const LIGHTS = ['#d946ef', '#a88bff', '#39e1ea', '#ff5aa5', '#5b95ff'];

/** Prédios + janelas acesas. `tallSide` concentra os mais altos perto da borda da tela. */
function buildCity(seed, width, height, { count, minH, maxH, tallSide }) {
  const next = rng(seed);
  const buildings = [];
  const windows = [];
  let x = 0;
  for (let i = 0; i < count && x < width; i++) {
    const w = 22 + Math.round(next() * 40);
    const edge = tallSide === 'left' ? 1 - x / width : tallSide === 'right' ? x / width : 0.6;
    const h = Math.round(minH + (maxH - minH) * (0.35 + 0.65 * edge) * (0.55 + next() * 0.45));
    const y = height - h;
    const color = LIGHTS[Math.floor(next() * LIGHTS.length)];
    buildings.push({ x, y, w, h, color, spire: next() > 0.75 });
    // Janelas em grade; só parte delas acesa
    for (let wy = y + 10; wy < height - 8; wy += 9) {
      for (let wx = x + 4; wx < x + w - 5; wx += 7) {
        if (next() > 0.8) windows.push({ x: wx, y: wy, color, o: 0.35 + next() * 0.6 });
      }
    }
    x += w + Math.round(next() * 3);
  }
  return { buildings, windows };
}

function City({ width, height, city, glowId, className, preserve }) {
  return (
    <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio={preserve} className={className}>
      <defs>
        <linearGradient id={`${glowId}-b`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1c1247" />
          <stop offset="1" stopColor="#070a1c" />
        </linearGradient>
        <filter id={`${glowId}-f`} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="2.2" />
        </filter>
      </defs>
      {city.buildings.map((b) => (
        <g key={b.x}>
          <rect x={b.x} y={b.y} width={b.w} height={b.h} fill={`url(#${glowId}-b)`} stroke={b.color} strokeOpacity="0.55" />
          {b.spire && <line x1={b.x + b.w / 2} y1={b.y} x2={b.x + b.w / 2} y2={b.y - 26} stroke={b.color} strokeOpacity="0.8" />}
        </g>
      ))}
      {/* Brilho difuso das janelas (um único filtro para o grupo) */}
      <g filter={`url(#${glowId}-f)`} opacity="0.9">
        {city.windows.map((w, i) => (
          <rect key={i} x={w.x} y={w.y} width="3" height="4" fill={w.color} opacity={w.o} />
        ))}
      </g>
      <g>
        {city.windows.map((w, i) => (
          <rect key={i} x={w.x} y={w.y} width="3" height="4" fill={w.color} opacity={w.o * 0.9} />
        ))}
      </g>
    </svg>
  );
}

const SIDE_W = 420;
const SIDE_H = 900;
const LEFT = buildCity(11, SIDE_W, SIDE_H, { count: 30, minH: 180, maxH: 820, tallSide: 'left' });
const RIGHT = buildCity(29, SIDE_W, SIDE_H, { count: 30, minH: 180, maxH: 820, tallSide: 'right' });
const TOP_W = 900;
const TOP_H = 120;
const TOP = buildCity(47, TOP_W, TOP_H, { count: 40, minH: 30, maxH: 115 });

/** Fundo da tela: cidade neon nas laterais e no alto, atrás da moldura do aplicativo. */
export default function CityBackdrop() {
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <City
        width={SIDE_W}
        height={SIDE_H}
        city={LEFT}
        glowId="city-l"
        preserve="xMinYMax slice"
        className="absolute bottom-0 left-0 h-full w-[34vw] max-w-[30rem] opacity-70"
      />
      <City
        width={SIDE_W}
        height={SIDE_H}
        city={RIGHT}
        glowId="city-r"
        preserve="xMaxYMax slice"
        className="absolute bottom-0 right-0 h-full w-[34vw] max-w-[30rem] opacity-70"
      />
      <City
        width={TOP_W}
        height={TOP_H}
        city={TOP}
        glowId="city-t"
        preserve="xMidYMax slice"
        className="absolute left-[52%] top-0 hidden h-[5.5rem] w-[30vw] opacity-60 lg:block"
      />
      {/* Reflexo no chão */}
      <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-[#d946ef1a] to-transparent" />
    </div>
  );
}
