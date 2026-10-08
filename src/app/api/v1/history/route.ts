import { apiError, apiJson, authenticateCustomer } from "@/lib/customer-auth";
import { INTERVALS, MAX_HISTORY_ROWS, history, historyToCsv, listSites } from "@/lib/report-data";
import { parseHistoryParams } from "@/lib/report-params";

// Historic fill levels (and tonnes of feed, where a feed weight is set) for
// the silos on the sites this key may read. See docs/api-reference.md for the
// parameters; in short: from, to, interval (raw|5m|15m|1h|1d), site, page,
// silo, format (json|csv).
export async function GET(request: Request) {
  const auth = await authenticateCustomer(request);
  if (auth instanceof Response) return auth;

  const parsed = parseHistoryParams(new URL(request.url).searchParams);
  if (typeof parsed === "string") return apiError(400, parsed);

  // Same answer for "no such site" and "not yours".
  if (parsed.site && !(await listSites(auth.siteIds)).some((s) => s.slug === parsed.site)) {
    return apiError(404, "Site not found");
  }

  const result = await history({
    siteIds: auth.siteIds,
    slug: parsed.site,
    page: parsed.page,
    silo: parsed.silo,
    fromMs: parsed.fromMs,
    toMs: parsed.toMs,
    bucketSeconds: INTERVALS[parsed.interval],
  });
  if ("tooManyRows" in result) {
    return apiError(
      422,
      `That request matches more than ${MAX_HISTORY_ROWS.toLocaleString("en-US")} data points. Narrow the date range, ask for a coarser interval, or filter by site or silo.`,
      { code: "too_many_rows" },
    );
  }

  if (parsed.format === "csv") {
    const day = (ms: number) => new Date(ms).toISOString().slice(0, 10);
    return new Response(historyToCsv(result.sites), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="silocentral-history-${day(parsed.fromMs)}-to-${day(parsed.toMs)}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  }

  return apiJson({
    generatedAt: new Date().toISOString(),
    from: new Date(parsed.fromMs).toISOString(),
    to: new Date(parsed.toMs).toISOString(),
    interval: parsed.interval,
    sites: result.sites,
  });
}
