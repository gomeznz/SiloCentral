import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, eq, gte, lt, sql } from "drizzle-orm";
import { db } from "@/db";
import { sites, siteSiloReadings } from "@/db/schema";
import { buttonVariants } from "@/components/ui/button";
import { LocalDateTime } from "@/components/local-date-time";
import { SitePagesView } from "@/components/site-pages-view";
import { SiteOnlineBadge } from "@/components/site-online-badge";
import { requireUser } from "@/lib/auth";
import { AutoRefresh } from "@/components/auto-refresh";
import { isSiteOnline, lastSeenAt } from "@/lib/site-status";
import {
  TREND_RANGES,
  axisForSpan,
  bucketSecondsForSpan,
  parseTrendRange,
  resolveCustomRange,
  type CustomRange,
  type TrendRangeKey,
} from "@/lib/trend-range";

// Reads live DB state on every request — must not be statically prerendered
// at build time (the DB isn't reachable from the build environment anyway).
export const dynamic = "force-dynamic";

type TrendView = {
  startMs: number;
  endMs: number | null; // null = open-ended, i.e. "up to now"
  bucketSeconds: number;
  axis: "shortTime" | "shortDate" | "monthYear";
  preset: TrendRangeKey | null; // which preset button is active, if any
  custom: CustomRange | null;
};

// A valid custom from/to wins over a preset; anything else falls back to the
// preset (itself defaulting to 3h). Lives outside the component because it
// reads the clock, which React's purity lint disallows in a component body.
function resolveTrendView(query: { range?: string; from?: string; to?: string; tz?: string }): TrendView {
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

export default async function SiteDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ range?: string; from?: string; to?: string; tz?: string }>;
}) {
  const user = await requireUser();
  const { slug } = await params;
  const view = resolveTrendView(await searchParams);

  const [site] = await db.select().from(sites).where(eq(sites.slug, slug)).limit(1);
  if (!site) {
    notFound();
  }

  const lastSeen = lastSeenAt(site);
  const online = isSiteOnline(lastSeen);

  const hasSilos = !!site.latestReport && site.latestReport.pages.some((p) => p.silos.length > 0);

  // Readings are averaged into fixed-width time buckets in SQL rather than
  // fetched raw, so a year-long range doesn't ship hundreds of thousands of
  // rows per silo to the page. bucketSeconds is inlined (sql.raw) instead of
  // bound as a parameter because Postgres can't tell that `... / $1` in the
  // SELECT and `... / $2` in the GROUP BY are the same expression. It's
  // always a number from our own tables (a preset constant, or picked from
  // BUCKET_STEPS) — never text from the URL — so inlining it is safe.
  const bucket = sql<number>`floor(extract(epoch from ${siteSiloReadings.recordedAt}) / ${sql.raw(String(view.bucketSeconds))})`.mapWith(
    Number,
  );
  const bucketed = hasSilos
    ? await db
        .select({
          pageSlug: siteSiloReadings.pageSlug,
          siloName: siteSiloReadings.siloName,
          bucket,
          percent: sql<string>`avg(${siteSiloReadings.percent})`,
        })
        .from(siteSiloReadings)
        .where(
          and(
            eq(siteSiloReadings.siteId, site.id),
            gte(siteSiloReadings.recordedAt, new Date(view.startMs)),
            view.endMs !== null ? lt(siteSiloReadings.recordedAt, new Date(view.endMs)) : undefined,
          ),
        )
        .groupBy(siteSiloReadings.pageSlug, siteSiloReadings.siloName, bucket)
        .orderBy(asc(bucket))
    : [];

  // Same shape SitePagesView already takes for raw readings — a bucket's
  // average stands in for a single reading, timestamped at the bucket start.
  const readings = bucketed.map((r) => ({
    pageSlug: r.pageSlug,
    siloName: r.siloName,
    percent: r.percent,
    recordedAt: new Date(r.bucket * view.bucketSeconds * 1000),
  }));

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 p-8">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold">{site.name}</h1>
            <SiteOnlineBadge online={online} />
          </div>
          <p className={`text-sm ${online ? "text-slate-500 dark:text-slate-400" : "text-red-600 dark:text-red-400"}`}>
            {lastSeen ? (
              <>
                {online ? "Last seen" : "No contact since"} <LocalDateTime value={lastSeen} />
              </>
            ) : (
              "Never reported"
            )}
          </p>
        </div>
        <div className="flex gap-2">
          {user.role === "admin" && (
            <Link href={`/admin/${site.id}/config`} className={buttonVariants({ variant: "outline", size: "sm" })}>
              Settings
            </Link>
          )}
          <Link href="/" className={buttonVariants({ variant: "outline", size: "sm" })}>
            All sites
          </Link>
        </div>
      </div>

      {!online && (
        <div
          role="alert"
          className="rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300"
        >
          {lastSeen ? (
            <>
              This site hasn&apos;t checked in since <LocalDateTime value={lastSeen} />. The levels below are the
              last readings it reported, not live values.
            </>
          ) : (
            "This site hasn't reported in yet."
          )}
        </div>
      )}

      <AutoRefresh />

      {/* When offline these are only the last-known readings, so they're dimmed. */}
      <div className={`space-y-6 ${online ? "" : "opacity-60"}`}>
        <SitePagesView
          pages={site.latestReport?.pages ?? []}
          readings={readings}
          axisFormat={view.axis}
          emptyMessage={view.custom ? "No readings were recorded in this date range." : undefined}
          range={{
            slug,
            active: view.preset,
            from: view.custom?.from ?? null,
            to: view.custom?.to ?? null,
          }}
        />
      </div>
    </div>
  );
}
