import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { sites } from "@/db/schema";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LocalDateTime } from "@/components/local-date-time";
import { SiloGauge } from "@/components/silo-gauge";
import { isSiteOnline } from "@/lib/site-status";

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

      {!site.latestReport || site.latestReport.pages.length === 0 ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">No data reported by this site yet.</p>
      ) : (
        site.latestReport.pages.map((page) => (
          <Card key={page.slug}>
            <CardHeader>
              <CardTitle>{page.name}</CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              {page.silos.length === 0 ? (
                <p className="text-sm text-slate-500 dark:text-slate-400">No silos on this page.</p>
              ) : (
                <div className="flex gap-4 overflow-x-auto pb-2">
                  {page.silos.map((silo, i) => (
                    <SiloGauge
                      key={silo.name}
                      clipKey={`${page.slug}-${i}`}
                      name={silo.name}
                      percent={silo.percent}
                      currentValue={silo.currentValue}
                      capacity={silo.capacity}
                      unit={silo.unit}
                      status={silo.status}
                      lastReadAt={silo.lastReadAt}
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}
