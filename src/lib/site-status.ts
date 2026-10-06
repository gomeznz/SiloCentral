import type { SiteReport, SiteSiloStatus } from "@/db/schema";

// How long a site can go without sending anything before it's shown as
// offline. A worker pings /api/heartbeat every ~30s and pushes a full report
// every ~60s, so 2 minutes tolerates several missed pings (a slow network
// hop, a brief restart) without a site flapping between online and offline,
// while still flagging a genuinely dead site quickly.
const ONLINE_WITHIN_MS = 2 * 60 * 1000;

// Either kind of contact proves the site is alive, so "last seen" is
// whichever came most recently. This also keeps sites still running an older
// SiloMon (which only pushes reports, no heartbeat) working: their reports
// alone arrive often enough to stay inside the window above.
export function lastSeenAt(site: { lastReportAt: Date | null; lastHeartbeatAt: Date | null }): Date | null {
  const times = [site.lastReportAt, site.lastHeartbeatAt].filter((d): d is Date => d !== null);
  return times.length > 0 ? new Date(Math.max(...times.map((d) => d.getTime()))) : null;
}

export function isSiteOnline(lastSeen: Date | null): boolean {
  return !!lastSeen && Date.now() - lastSeen.getTime() <= ONLINE_WITHIN_MS;
}

// What each silo status is called on screen. The stored/API value stays
// "offline" (it's part of the report SiloMon sends), but it reads ERROR here
// because sitting next to a site's ONLINE badge, a silo that says OFFLINE
// looks like a contradiction: the site is up, it's the sensor that isn't
// answering.
export const SILO_STATUS_LABEL: Record<SiteSiloStatus, string> = {
  ok: "OK",
  low: "LOW",
  critical: "CRITICAL",
  high: "HIGH",
  offline: "ERROR",
};

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
