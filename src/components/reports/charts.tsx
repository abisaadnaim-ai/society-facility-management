import { Empty } from "@/components/reports/ui";

export type LineSeries = {
  name: string;
  color: string;
  points: (number | null)[];
};

/**
 * Minimal, dependency-free multi-series line chart rendered as static SVG.
 * Accurate linear scale, clear axis labels, honours zero and empty data
 * (spec §24/§25). `labels` are the x-axis tick labels (e.g. dates).
 */
export function LineChartSvg({
  labels,
  series,
  yMax,
  ySuffix = "",
  height = 240,
  empty,
}: {
  labels: string[];
  series: LineSeries[];
  yMax?: number;
  ySuffix?: string;
  height?: number;
  empty?: string;
}) {
  const n = labels.length;
  const hasAny = series.some((s) => s.points.some((p) => p != null));
  if (n === 0 || !hasAny) return <Empty message={empty} />;

  const W = 720;
  const H = height;
  const padL = 42;
  const padR = 16;
  const padT = 16;
  const padB = 36;
  const pw = W - padL - padR;
  const ph = H - padT - padB;

  const dataMax = Math.max(
    ...series.flatMap((s) => s.points.map((p) => (p == null ? 0 : p))),
    1
  );
  const max = yMax ?? niceMax(dataMax);

  const x = (i: number) => (n === 1 ? padL + pw / 2 : padL + (i / (n - 1)) * pw);
  const y = (v: number) => padT + ph * (1 - v / max);

  const gridY = [0, 0.25, 0.5, 0.75, 1].map((t) => ({
    yy: padT + ph * t,
    val: Math.round(max * (1 - t)),
  }));

  // Thin x labels to ~6 to avoid crowding.
  const step = Math.max(1, Math.ceil(n / 6));

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1">
        {series.map((s) => (
          <span key={s.name} className="inline-flex items-center gap-1.5 text-xs text-slate-600">
            <span className="inline-block h-2 w-3 rounded-sm" style={{ backgroundColor: s.color }} />
            {s.name}
          </span>
        ))}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" preserveAspectRatio="xMidYMid meet">
        {gridY.map((g, i) => (
          <g key={i}>
            <line x1={padL} y1={g.yy} x2={W - padR} y2={g.yy} stroke="#f1f5f9" strokeWidth={1} />
            <text x={padL - 6} y={g.yy + 3} textAnchor="end" fontSize={10} fill="#94a3b8">
              {g.val}
              {ySuffix}
            </text>
          </g>
        ))}
        {labels.map((lb, i) =>
          i % step === 0 || i === n - 1 ? (
            <text key={i} x={x(i)} y={H - padB + 16} textAnchor="middle" fontSize={9} fill="#94a3b8">
              {lb}
            </text>
          ) : null
        )}
        {series.map((s) => {
          const segs: string[] = [];
          let started = false;
          s.points.forEach((p, i) => {
            if (p == null) {
              started = false;
              return;
            }
            segs.push(`${started ? "L" : "M"}${x(i).toFixed(1)},${y(p).toFixed(1)}`);
            started = true;
          });
          return (
            <g key={s.name}>
              <path d={segs.join(" ")} fill="none" stroke={s.color} strokeWidth={2} />
              {s.points.map((p, i) =>
                p == null ? null : <circle key={i} cx={x(i)} cy={y(p)} r={2.5} fill={s.color} />
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function niceMax(v: number): number {
  if (v <= 5) return 5;
  const mag = Math.pow(10, Math.floor(Math.log10(v)));
  const norm = v / mag;
  const step = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10;
  return step * mag;
}
