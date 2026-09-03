import type { SiteReport, SiteSiloStatus } from "@/db/schema";

// How long a site can go without a push before the dashboard treats its
// last report as stale — generous relative to the worker's default 60s
// push interval, since a slow network hop or a brief restart shouldn't
// immediately flag a site as down.
const STALE_AFTER_MS = 5 * 60 * 1000;

export function isSiteOnline(lastReportAt: Date | null): boolean {
  return !!lastReportAt && Date.now() - lastReportAt.getTime() <= STALE_AFTER_MS;
}

export type SiteRollup = {
  counts: Record<SiteSiloStatus, number>;
  // Worst status across every silo in the last known report — independent
  // of isSiteOnline() above, so a site that's stopped pushing still shows
  // whatever it last reported rather than silently going blank.
  worst: SiteSiloStatus | null;
};

export function siteRollup(latestReport: SiteReport | null): SiteRollup {
  const counts: Record<SiteSiloStatus, number> = { critical: 0, low: 0, high: 0, ok: 0, offline: 0 };

  if (latestReport) {
    for (const page of latestReport.pages) {
      for (const silo of page.silos) {
        counts[silo.status]++;
      }
    }
  }

  const worst: SiteSiloStatus | null =
    counts.critical > 0
      ? "critical"
      : counts.low > 0
        ? "low"
        : counts.offline > 0
          ? "offline"
          : counts.high > 0
            ? "high"
            : counts.ok > 0
              ? "ok"
              : null;

  return { counts, worst };
}
