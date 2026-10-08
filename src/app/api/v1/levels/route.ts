import { apiError, apiJson, authenticateCustomer } from "@/lib/customer-auth";
import { currentLevels, levelsToCsv } from "@/lib/report-data";

// Current level of every silo on the sites this key may read, as of each
// site's most recent report. ?site=<slug> narrows it to one site;
// ?format=csv returns a spreadsheet-friendly file instead of JSON.
export async function GET(request: Request) {
  const auth = await authenticateCustomer(request);
  if (auth instanceof Response) return auth;

  const params = new URL(request.url).searchParams;
  const slug = params.get("site") || undefined;
  const format = params.get("format") ?? "json";
  if (format !== "json" && format !== "csv") return apiError(400, "`format` must be json or csv");

  const sites = await currentLevels(auth.siteIds, slug);
  // A site that doesn't exist and one this key can't see look the same, so the
  // API can't be used to discover other customers' site names.
  if (slug && sites.length === 0) return apiError(404, "Site not found");

  if (format === "csv") {
    return new Response(levelsToCsv(sites), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="silocentral-levels-${new Date().toISOString().slice(0, 10)}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  }
  return apiJson({ generatedAt: new Date().toISOString(), sites });
}
