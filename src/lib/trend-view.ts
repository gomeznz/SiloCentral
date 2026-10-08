import {
  TREND_RANGES,
  axisForSpan,
  bucketSecondsForSpan,
  parseTrendRange,
  resolveCustomRange,
  type CustomRange,
  type TrendRangeKey,
} from "@/lib/trend-range";

export type TrendView = {
  startMs: number;
  endMs: number | null; // null = open-ended, i.e. "up to now"
  bucketSeconds: number;
  axis: "shortTime" | "shortDate" | "monthYear";
  preset: TrendRangeKey | null; // which preset button is active, if any
  custom: CustomRange | null;
};

// A valid custom from/to wins over a preset; anything else falls back to the
// preset (itself defaulting to 3h). Shared by the site page and its CSV
// download, so the file always covers exactly the window the chart shows.
// Lives outside a component because it reads the clock, which React's purity
// lint disallows in a component body.
export function resolveTrendView(query: { range?: string; from?: string; to?: string; tz?: string }): TrendView {
  const custom = resolveCustomRange(query.from, query.to, query.tz);
  if (custom) {
    const span = custom.endMs - custom.startMs;
    return {
      startMs: custom.startMs,
      endMs: custom.endMs,
      bucketSeconds: bucketSecondsForSpan(span),
      axis: axisForSpan(span),
      preset: null,
      custom,
    };
  }

  const preset = parseTrendRange(query.range);
  const { windowMs, bucketSeconds, axis } = TREND_RANGES[preset];
  return { startMs: Date.now() - windowMs, endMs: null, bucketSeconds, axis, preset, custom: null };
}
