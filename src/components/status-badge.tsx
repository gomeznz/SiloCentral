import { cn } from "@/lib/utils";
import type { SiteSiloStatus } from "@/db/schema";

// Same color language as SiloMon's own gauge badges (src/components/silo-gauge.tsx
// there) — HIGH reads as green (well-stocked, not a warning), CRITICAL is the
// one status that means real trouble.
const STATUS_STYLES: Record<SiteSiloStatus, string> = {
  ok: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300",
  high: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300",
  low: "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300",
  critical: "bg-red-600 text-white dark:bg-red-600 dark:text-white",
  offline: "bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300",
};

export function StatusBadge({ status, className }: { status: SiteSiloStatus; className?: string }) {
  return (
    <span
      className={cn(
        "inline-block rounded-full px-2.5 py-0.5 text-xs font-medium",
        STATUS_STYLES[status],
        className,
      )}
    >
      {status.toUpperCase()}
    </span>
  );
}
