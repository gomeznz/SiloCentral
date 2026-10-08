import { INTERVALS, type IntervalKey } from "@/lib/report-data";

// Query-string parsing for GET /api/v1/history. Returns a message on the first
// problem so the caller can answer 400 with something a developer can act on.

const DAY_MS = 86_400_000;
export const MAX_SPAN_DAYS = 366;
const DEFAULT_WINDOW_MS = DAY_MS;

export type HistoryParams = {
  fromMs: number;
  toMs: number;
  interval: IntervalKey;
  site?: string;
  page?: string;
  silo?: string;
  format: "json" | "csv";
};

// "2026-09-01"  -> that UTC day (a `to` of 2026-09-14 includes all of it).
// "2026-09-01T08:30:00Z" / "...+12:00" -> that instant. With no zone given the
// time is taken as UTC.
function parseInstant(value: string, isTo: boolean): number | null {
  const date = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (date) {
    const [y, m, d] = [Number(date[1]), Number(date[2]), Number(date[3])];
    const ms = Date.UTC(y, m - 1, d);
    const check = new Date(ms);
    if (check.getUTCFullYear() !== y || check.getUTCMonth() !== m - 1 || check.getUTCDate() !== d) return null;
    return isTo ? ms + DAY_MS : ms;
  }
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})?$/.test(value)) return null;
  const ms = Date.parse(/(Z|[+-]\d{2}:\d{2})$/.test(value) ? value : `${value}Z`);
  return Number.isNaN(ms) ? null : ms;
}

export function parseHistoryParams(params: URLSearchParams, now = Date.now()): HistoryParams | string {
  const fromRaw = params.get("from");
  const toRaw = params.get("to");

  let toMs = now;
  if (toRaw) {
    const parsed = parseInstant(toRaw, true);
    if (parsed === null) return "`to` must be a date (2026-09-14) or an ISO 8601 date-time (2026-09-14T08:30:00Z)";
    toMs = parsed;
  }
  let fromMs = toMs - DEFAULT_WINDOW_MS;
  if (fromRaw) {
    const parsed = parseInstant(fromRaw, false);
    if (parsed === null) return "`from` must be a date (2026-09-01) or an ISO 8601 date-time (2026-09-01T08:30:00Z)";
    fromMs = parsed;
  }

  if (fromMs >= toMs) return "`from` must be earlier than `to`";
  if (toMs - fromMs > MAX_SPAN_DAYS * DAY_MS) {
    return `The range can be at most ${MAX_SPAN_DAYS} days; request it in several calls`;
  }

  const interval = params.get("interval") ?? "1h";
  if (!Object.hasOwn(INTERVALS, interval)) return `\`interval\` must be one of: ${Object.keys(INTERVALS).join(", ")}`;

  const format = params.get("format") ?? "json";
  if (format !== "json" && format !== "csv") return "`format` must be json or csv";

  const clean = (name: string): string | undefined => params.get(name) || undefined;

  return {
    fromMs,
    toMs,
    interval: interval as IntervalKey,
    site: clean("site"),
    page: clean("page"),
    silo: clean("silo"),
    format,
  };
}
