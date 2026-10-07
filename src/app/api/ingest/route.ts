import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { sites, siteSiloReadings } from "@/db/schema";
import { authenticateSite } from "@/lib/site-auth";

// A SiloMon site's worker POSTs its report here on a timer (see
// CENTRAL_DASHBOARD_URL/CENTRAL_API_KEY in that repo's scripts/silo-worker.ts).
// Auth is per-site: the Bearer token must match that site's own apiKey —
// there's no shared/master key, so a leaked key only exposes one site.
const SiloReportSchema = z.object({
  site: z.string(),
  generatedAt: z.string(),
  pages: z.array(
    z.object({
      name: z.string(),
      slug: z.string(),
      silos: z.array(
        z.object({
          name: z.string(),
          status: z.enum(["ok", "low", "critical", "high", "offline"]),
          percent: z.number(),
          currentValue: z.number().nullable(),
          capacity: z.number(),
          unit: z.string(),
          // Absent from sites still running a SiloMon that predates feed weight.
          feedWeightTonnes: z.number().nullable().optional(),
          feedStoredTonnes: z.number().nullable().optional(),
          lastReadAt: z.string().nullable(),
        }),
      ),
    }),
  ),
});

export async function POST(request: Request) {
  const siteId = await authenticateSite(request);
  if (siteId === null) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = SiloReportSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid report payload", issues: parsed.error.issues }, { status: 400 });
  }

  await db
    .update(sites)
    .set({ latestReport: parsed.data, lastReportAt: new Date() })
    .where(eq(sites.id, siteId));

  const readings = parsed.data.pages.flatMap((page) =>
    page.silos.map((silo) => ({
      siteId,
      pageSlug: page.slug,
      siloName: silo.name,
      percent: silo.percent.toFixed(2),
    })),
  );
  if (readings.length > 0) {
    await db.insert(siteSiloReadings).values(readings);
  }

  return NextResponse.json({ ok: true });
}
