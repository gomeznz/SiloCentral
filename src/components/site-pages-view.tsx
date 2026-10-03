import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SiloGauge, STATUS_FILL } from "@/components/silo-gauge";
import { SiloTrendChart, type TrendSeries } from "@/components/silo-trend-chart";
import { TrendSparkline } from "@/components/trend-sparkline";
import type { LocalDateTimeMode } from "@/components/local-date-time";
import type { SiteReport } from "@/db/schema";

type Reading = { pageSlug: string; siloName: string; percent: string; recordedAt: Date };

// Shared between the single-site detail page and the merged all-sites view —
// both render the same "gauges, then trend" pair per page, just at
// different points in the tree (one site's pages vs. every site's) and,
// for all-sites, in a much denser form (see `compact` below).
export function SitePagesView({
  pages,
  readings,
  compact = false,
  axisFormat,
  emptyMessage,
}: {
  pages: SiteReport["pages"];
  readings: Reading[];
  // Passed straight through to the full-size trend chart (not used by the
  // compact sparklines, which have no axis). See SiloTrendChart.
  axisFormat?: LocalDateTimeMode;
  emptyMessage?: string;
  // All-sites needs every site's every silo to fit on one screen, so it
  // trades the full tank gauge + axis-labeled chart for a mini gauge and a
  // bare sparkline, packed into a wrapping grid instead of one card per
  // concern. The single-site page never sets this — it has room to spare.
  compact?: boolean;
}) {
  if (pages.length === 0) {
    return <p className="text-sm text-slate-500 dark:text-slate-400">No data reported by this site yet.</p>;
  }

  if (compact) {
    return (
      <div className="space-y-3">
        {pages.map((page) => (
          <div key={page.slug}>
            <div className="mb-1.5 text-xs font-medium text-slate-400 dark:text-slate-500">{page.name}</div>
            {page.silos.length === 0 ? (
              <p className="text-xs text-slate-500 dark:text-slate-400">No silos on this page.</p>
            ) : (
              <div className="grid grid-cols-[repeat(auto-fill,minmax(72px,1fr))] gap-2">
                {page.silos.map((silo, i) => {
                  const percents = readings
                    .filter((r) => r.pageSlug === page.slug && r.siloName === silo.name)
                    .map((r) => Number(r.percent));

                  return (
                    <div
                      key={silo.name}
                      className="flex flex-col items-center gap-1 rounded-md border border-slate-200/80 p-1 dark:border-slate-800"
                    >
                      <SiloGauge
                        clipKey={`${page.slug}-${i}`}
                        name={silo.name}
                        percent={silo.percent}
                        currentValue={silo.currentValue}
                        capacity={silo.capacity}
                        unit={silo.unit}
                        status={silo.status}
                        lastReadAt={silo.lastReadAt}
                        size="compact"
                      />
                      <TrendSparkline percents={percents} color={STATUS_FILL[silo.status]} />
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </div>
    );
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
                  <SiloTrendChart series={trendSeries} axisFormat={axisFormat} emptyMessage={emptyMessage} />
                </CardContent>
              </Card>
            )}
          </div>
        );
      })}
    </>
  );
}
