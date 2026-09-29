import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SiloGauge } from "@/components/silo-gauge";
import { SiloTrendChart, type TrendSeries } from "@/components/silo-trend-chart";
import type { SiteReport } from "@/db/schema";

type Reading = { pageSlug: string; siloName: string; percent: string; recordedAt: Date };

// Shared between the single-site detail page and the merged all-sites view —
// both render the same "gauges, then trend chart" pair per page, just at
// different points in the tree (one site's pages vs. every site's).
export function SitePagesView({ pages, readings }: { pages: SiteReport["pages"]; readings: Reading[] }) {
  if (pages.length === 0) {
    return <p className="text-sm text-slate-500 dark:text-slate-400">No data reported by this site yet.</p>;
  }

  return (
    <>
      {pages.map((page) => {
        const trendSeries: TrendSeries[] = page.silos.map((silo) => ({
          id: `${page.slug}-${silo.name}`,
          name: silo.name,
          points: readings
            .filter((r) => r.pageSlug === page.slug && r.siloName === silo.name)
            .map((r) => ({ readAt: r.recordedAt, value: Number(r.percent) })),
        }));

        return (
          <div key={page.slug} className="space-y-6">
            <Card>
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

            {page.silos.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Level trend</CardTitle>
                </CardHeader>
                <CardContent className="pt-4">
                  <SiloTrendChart series={trendSeries} />
                </CardContent>
              </Card>
            )}
          </div>
        );
      })}
    </>
  );
}
