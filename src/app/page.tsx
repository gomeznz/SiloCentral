import Link from "next/link";
import { asc } from "drizzle-orm";
import { db } from "@/db";
import { sites } from "@/db/schema";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/status-badge";
import { SiteOnlineBadge } from "@/components/site-online-badge";
import { LocalDateTime } from "@/components/local-date-time";
import { isSiteOnline, lastSeenAt, siteRollup } from "@/lib/site-status";

// Reads live DB state on every request — must not be statically prerendered
// at build time (the DB isn't reachable from the build environment anyway).
export const dynamic = "force-dynamic";

export default async function HomePage() {
  const allSites = await db.select().from(sites).orderBy(asc(sites.name));

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Sites</h1>
        <div className="flex gap-2">
          <Link href="/all-sites" className={buttonVariants({ variant: "outline", size: "sm" })}>
            All Site View
          </Link>
          <Link href="/admin" className={buttonVariants({ variant: "outline", size: "sm" })}>
            Setup
          </Link>
        </div>
      </div>

      {allSites.length === 0 ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">
          No sites configured yet — add one in Setup and point that site&apos;s SiloMon worker at this
          dashboard.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {allSites.map((site) => {
            const lastSeen = lastSeenAt(site);
            const online = isSiteOnline(lastSeen);
            const { worst, counts } = siteRollup(site.latestReport);
            const siloCount = Object.values(counts).reduce((a, b) => a + b, 0);

            return (
              <Link key={site.id} href={`/${site.slug}`}>
                <Card
                  className={`h-full transition-colors hover:border-indigo-300 dark:hover:border-indigo-700 ${online ? "" : "opacity-70"}`}
                >
                  <CardHeader>
                    <div className="flex items-center justify-between gap-2">
                      <CardTitle>{site.name}</CardTitle>
                      <div className="flex items-center gap-2">
                        <SiteOnlineBadge online={online} />
                        {/* A silo status from a site that has gone quiet is stale, so
                            it's only shown while the site is actually reporting in. */}
                        {online && worst && <StatusBadge status={worst} />}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2 pt-4">
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      {siloCount > 0 ? `${siloCount} silo${siloCount === 1 ? "" : "s"}` : "No silos reported yet"}
                    </p>
                    <p
                      className={`text-xs ${online ? "text-slate-400 dark:text-slate-500" : "text-red-600 dark:text-red-400"}`}
                    >
                      {lastSeen ? (
                        <>
                          {online ? "Last seen" : "No contact since"} <LocalDateTime value={lastSeen} />
                        </>
                      ) : (
                        "Never reported"
                      )}
                    </p>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
