import { getCurrentUser } from "@/lib/auth";
import { MAX_HISTORY_ROWS, history, historyToCsv, listSites } from "@/lib/report-data";
import { resolveTrendView } from "@/lib/trend-view";

// "Download CSV" on a site's page: the level history of its silos over the
// trend range currently shown, bucketed exactly as the chart is. The same
// ?range=, ?from=, ?to= and ?tz= the page itself takes.
export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Sign in required" }, { status: 401 });

  const { slug } = await params;
  const query = new URL(request.url).searchParams;
  const view = resolveTrendView({
    range: query.get("range") ?? undefined,
    from: query.get("from") ?? undefined,
    to: query.get("to") ?? undefined,
    tz: query.get("tz") ?? undefined,
  });
  const endMs = view.endMs ?? Date.now();

  const result = await history({ siteIds: null, slug, fromMs: view.startMs, toMs: endMs, bucketSeconds: view.bucketSeconds });
  if ("tooManyRows" in result) {
    return Response.json(
      { error: `More than ${MAX_HISTORY_ROWS.toLocaleString("en-US")} data points; choose a shorter range.` },
      { status: 422 },
    );
  }
  if (result.sites.length === 0) {
    // Either no such site, or no readings in this range — a header-only file
    // would be confusing for the first, harmless for the second.
    if (!(await listSites(null)).some((s) => s.slug === slug)) {
      return Response.json({ error: "Site not found" }, { status: 404 });
    }
  }

  const day = (ms: number) => new Date(ms).toISOString().slice(0, 10);
  const safeSlug = slug.replace(/[^a-z0-9-]/gi, "");
  return new Response(historyToCsv(result.sites, true), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${safeSlug}-history-${day(view.startMs)}-to-${day(endMs)}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
