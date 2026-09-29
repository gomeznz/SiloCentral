import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, eq, gte } from "drizzle-orm";
import { db } from "@/db";
import { sites, siteSiloReadings } from "@/db/schema";
import { buttonVariants } from "@/components/ui/button";
import { LocalDateTime } from "@/components/local-date-time";
import { SitePagesView } from "@/components/site-pages-view";
import { isSiteOnline } from "@/lib/site-status";

// How far back the trend chart looks — same window SiloMon itself uses, and
// generous relative to a site's default 60s push interval.
const TREND_WINDOW_MS = 3 * 60 * 60 * 1000;

function trendCutoff(): Date {
  return new Date(Date.now() - TREND_WINDOW_MS);
}

// Reads live DB state on every request — must not be statically prerendered
// at build time (the DB isn't reachable from the build environment anyway).
export const dynamic = "force-dynamic";

export default async function SiteDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  const [site] = await db.select().from(sites).where(eq(sites.slug, slug)).limit(1);
  if (!site) {
    notFound();
  }

  const online = isSiteOnline(site.lastReportAt);

  const hasSilos = !!site.latestReport && site.latestReport.pages.some((p) => p.silos.length > 0);
  const readings = hasSilos
    ? await db
        .select({
          pageSlug: siteSiloReadings.pageSlug,
          siloName: siteSiloReadings.siloName,
          percent: siteSiloReadings.percent,
          recordedAt: siteSiloReadings.recordedAt,
        })
        .from(siteSiloReadings)
        .where(and(eq(siteSiloReadings.siteId, site.id), gte(siteSiloReadings.recordedAt, trendCutoff())))
        .orderBy(asc(siteSiloReadings.recordedAt))
    : [];

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{site.name}</h1>
          <p className={`text-sm ${online ? "text-slate-500 dark:text-slate-400" : "text-red-600 dark:text-red-400"}`}>
            {site.lastReportAt ? (
              <>
                {online ? "Last seen" : "Stale — last seen"} <LocalDateTime value={site.lastReportAt} />
              </>
            ) : (
              "Never reported"
            )}
          </p>
        </div>
        <Link href="/" className={buttonVariants({ variant: "outline", size: "sm" })}>
          All sites
        </Link>
      </div>

      <SitePagesView pages={site.latestReport?.pages ?? []} readings={readings} />
    </div>
  );
}
