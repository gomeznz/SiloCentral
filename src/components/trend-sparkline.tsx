// Minimal inline trend line — no axes, ticks or legend — for views where
// SiloTrendChart's full chart (with its per-series legend and time axis)
// takes too much space to show one per silo. Not meant to replace it: this
// answers "what's the shape been," not "what was it at 2pm."
const WIDTH = 64;
const HEIGHT = 22;

export function TrendSparkline({ percents, color }: { percents: number[]; color: string }) {
  if (percents.length === 0) {
    return <div className="text-[9px] text-slate-400 dark:text-slate-500">No data</div>;
  }

  const x = (i: number) => (percents.length === 1 ? WIDTH / 2 : (i / (percents.length - 1)) * WIDTH);
  const y = (v: number) => HEIGHT - (Math.max(0, Math.min(100, v)) / 100) * HEIGHT;

  if (percents.length === 1) {
    return (
      <svg width={WIDTH} height={HEIGHT} viewBox={`0 0 ${WIDTH} ${HEIGHT}`}>
        <circle cx={WIDTH / 2} cy={y(percents[0])} r={2} fill={color} />
      </svg>
    );
  }

  const d = percents.map((v, i) => `${i === 0 ? "M" : "L"} ${x(i)} ${y(v)}`).join(" ");
  return (
    <svg width={WIDTH} height={HEIGHT} viewBox={`0 0 ${WIDTH} ${HEIGHT}`}>
      <path d={d} fill="none" stroke={color} strokeWidth={1.5} />
    </svg>
  );
}
