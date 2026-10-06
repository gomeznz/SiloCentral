import Link from "next/link";
import { and, asc, gte, inArray } from "drizzle-orm";
import { db } from "@/db";
import { sites, siteSiloReadings } from "@/db/schema";
import { buttonVariants } from "@/components/ui/button";
import { LocalDateTime } from "@/components/local-date-time";
import { SitePagesView } from "@/components/site-pages-view";
import { SiteOnlineBadge } from "@/components/site-online-badge";
import { requireUser } from "@/lib/auth";
import { isSiteOnline, lastSeenAt } from "@/lib/site-status";

// Same window the single-site page uses.
const TREND_WINDOW_MS = 3 * 60 * 60 * 1000;

function trendCutoff(): Date {
  return new Date(Date.now() - TREND_WINDOW_MS);
}

// Reads live DB state on every request — must not be statically prerendered
// at build time (the DB isn't reachable from the build environment anyway).
export const dynamic = "force-dynamic";

export default async function AllSitesPage() {
  await requireUser();
  const allSites = await db.select().from(sites).orderBy(asc(sites.name));

  const siteIdsWithSilos = allSites
    .filter((s) => s.latestReport && s.latestReport.pages.some((p) => p.silos.length > 0))
    .map((s) => s.id);

  // One query across every site rather than one per site — readings are
  // filtered back out per site below when building each site's section.
  const readings =
    siteIdsWithSilos.length > 0
      ? await db
          .select({
            siteId: siteSiloReadings.siteId,
            pageSlug: siteSiloReadings.pageSlug,
            siloName: siteSiloReadings.siloName,
            percent: siteSiloReadings.percent,
            recordedAt: siteSiloReadings.recordedAt,
          })
          .from(siteSiloReadings)
          .where(and(inArray(siteSiloReadings.siteId, siteIdsWithSilos), gte(siteSiloReadings.recordedAt, trendCutoff())))
          .orderBy(asc(siteSiloReadings.recordedAt))
      : [];

  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-3 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">All sites</h1>
        <Link href="/" className={buttonVariants({ variant: "outline", size: "sm" })}>
          Back to sites
        </Link>
      </div>

      {allSites.length === 0 ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">
          No sites configured yet — add one in Setup and point that site&apos;s SiloMon worker at this dashboard.
        </p>
      ) : (
        allSites.map((site) => {
          const lastSeen = lastSeenAt(site);
          const online = isSiteOnline(lastSeen);

          return (
            <div key={site.id} className="space-y-1.5 border-t border-slate-200 pt-1.5 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Link href={`/${site.slug}`} className="text-sm font-semibold hover:underline">
                  {site.name}
                </Link>
                <SiteOnlineBadge online={online} />
                <span
                  className={`text-xs ${online ? "text-slate-400 dark:text-slate-500" : "text-red-600 dark:text-red-400"}`}
                >
                  {lastSeen ? (
                    <>
                      {online ? "Last seen" : "No contact since"} <LocalDateTime value={lastSeen} />
                    </>
                  ) : (
                    "Never reported"
                  )}
                </span>
              </div>

              {/* An offline site's gauges are its last-known readings, so they're dimmed. */}
              <div className={online ? undefined : "opacity-50"}>
                <SitePagesView
                  pages={site.latestReport?.pages ?? []}
                  readings={readings.filter((r) => r.siteId === site.id)}
                  compact
                />
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
