import { cn } from "@/lib/utils";
import type { SiteSiloStatus } from "@/db/schema";
import { LocalDateTime } from "@/components/local-date-time";

// Ported from SiloMon's own src/components/silo-gauge.tsx so a silo looks
// the same way here as it does on the site that actually owns it — same
// linear percent-to-height mapping over the tank silhouette, same status
// colors.
const TOP_Y = 15;
const BOTTOM_Y = 155;
const RANGE = BOTTOM_Y - TOP_Y;

export const STATUS_FILL: Record<SiteSiloStatus, string> = {
  ok: "#6366f1", // indigo-500
  low: "#f59e0b", // amber-500
  critical: "#991b1b", // red-800
  high: "#10b981", // emerald-500 — well-stocked is good news, not a warning
  offline: "#94a3b8", // slate-400
};

const STATUS_BADGE: Record<SiteSiloStatus, { label: string; className: string }> = {
  ok: { label: "OK", className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300" },
  low: { label: "LOW", className: "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300" },
  critical: { label: "CRITICAL", className: "bg-red-600 text-white dark:bg-red-600 dark:text-white" },
  high: { label: "HIGH", className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300" },
  offline: { label: "OFFLINE", className: "bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300" },
};

const CARD_BACKGROUND: Record<SiteSiloStatus, string> = {
  ok: "border-slate-200/80 bg-gradient-to-b from-white to-slate-50 dark:border-slate-800 dark:from-slate-900 dark:to-slate-950",
  low: "border-slate-200/80 bg-gradient-to-b from-white to-slate-50 dark:border-slate-800 dark:from-slate-900 dark:to-slate-950",
  high: "border-slate-200/80 bg-gradient-to-b from-white to-slate-50 dark:border-slate-800 dark:from-slate-900 dark:to-slate-950",
  offline: "border-slate-200/80 bg-gradient-to-b from-white to-slate-50 dark:border-slate-800 dark:from-slate-900 dark:to-slate-950",
  critical: "border-red-300 bg-gradient-to-b from-red-50 to-red-100 animate-pulse dark:border-red-800 dark:from-red-950/60 dark:to-red-950/30",
};

const SILO_OUTLINE = "M 25 15 Q 60 0 95 15 L 95 118 L 60 155 L 25 118 Z";

export function SiloGauge({
  clipKey,
  name,
  percent,
  currentValue,
  capacity,
  unit,
  status,
  lastReadAt,
  size = "default",
}: {
  clipKey: string;
  name: string;
  percent: number;
  currentValue: number | null;
  capacity: number;
  unit: string;
  status: SiteSiloStatus;
  lastReadAt: string | null;
  // "compact" drops the currentValue/capacity line and last-read time,
  // shrinking the whole card to icon + name + badge — for views (like
  // /all-sites) that need many of these to fit on one screen at once.
  size?: "default" | "compact";
}) {
  const compact = size === "compact";
  const clampedPercent = Math.max(0, Math.min(100, percent));
  const fillY = BOTTOM_Y - (clampedPercent / 100) * RANGE;
  // Sanitized because it flows straight into an SVG url(#...) reference —
  // an unescaped space (or other CSS-meaningful character) in the id breaks
  // that reference silently, leaving the fill rect unclipped.
  const clipId = `silo-clip-${clipKey.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
  const badge = STATUS_BADGE[status];

  return (
    <div
      className={cn(
        "flex shrink-0 flex-col items-center rounded-lg border shadow-sm shadow-slate-200/60 dark:shadow-slate-950/60",
        compact ? "p-1.5" : "p-4",
        CARD_BACKGROUND[status],
      )}
    >
      <svg viewBox="0 0 120 170" className={compact ? "h-14 w-10" : "h-40 w-28"}>
        <defs>
          <clipPath id={clipId}>
            <path d={SILO_OUTLINE} />
          </clipPath>
        </defs>

        <path d={SILO_OUTLINE} className="fill-slate-100 dark:fill-slate-800" />

        <rect
          x={0}
          y={fillY}
          width={120}
          height={BOTTOM_Y - fillY + 15}
          fill={STATUS_FILL[status]}
          opacity={status === "offline" ? 0.5 : 1}
          clipPath={`url(#${clipId})`}
        />

        <path d={SILO_OUTLINE} fill="none" strokeWidth={3} className="stroke-slate-300 dark:stroke-slate-600" />

        <text
          x={60}
          y={90}
          textAnchor="middle"
          className="fill-slate-900 text-[28px] font-semibold dark:fill-white"
          style={{ paintOrder: "stroke", stroke: "white", strokeWidth: 4, strokeOpacity: 0.6 }}
        >
          {Math.round(clampedPercent)}%
        </text>
      </svg>

      <div className="mt-1.5 text-center">
        <div className={cn("font-medium text-slate-900 dark:text-slate-100", compact ? "text-[10px]" : "text-sm")}>
          {name}
        </div>
        {!compact && (
          <div className="text-xs text-slate-500 dark:text-slate-400">
            {currentValue !== null
              ? `${currentValue.toLocaleString()} / ${capacity.toLocaleString()} ${unit}`
              : "No data"}
          </div>
        )}
        <span
          className={cn(
            "mt-1 inline-block rounded-full font-medium",
            compact ? "px-1.5 py-0 text-[8px]" : "px-2 py-0.5 text-[11px]",
            badge.className,
          )}
        >
          {badge.label}
        </span>
        {!compact && lastReadAt && (
          <div className="mt-1 text-[11px] text-slate-400 dark:text-slate-500">
            <LocalDateTime value={lastReadAt} mode="time" />
          </div>
        )}
      </div>
    </div>
  );
}
