import { NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { siteConfigs } from "@/db/schema";
import { authenticateSite } from "@/lib/site-auth";
import { getConfigRow } from "@/lib/site-config";

const AckSchema = z.object({
  version: z.number().int().positive(),
  ok: z.boolean(),
  error: z.string().max(1000).optional(),
});

// The site reports whether it applied a version, so the admin sees "applied"
// or the reason it was rejected instead of just hoping.
export async function POST(request: Request) {
  const siteId = await authenticateSite(request);
  if (siteId === null) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = AckSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid acknowledgement" }, { status: 400 });
  }
  const { version, ok, error } = parsed.data;

  const row = await getConfigRow(siteId);
  if (!row || version > row.version) {
    return NextResponse.json({ error: "Unknown configuration version" }, { status: 400 });
  }

  if (ok) {
    await db
      .update(siteConfigs)
      .set({
        appliedVersion: sql`greatest(coalesce(${siteConfigs.appliedVersion}, 0), ${version})`,
        appliedAt: new Date(),
        // Applying a version at least as new as one that failed clears that failure.
        applyError: sql`case when ${siteConfigs.applyErrorVersion} <= ${version} then null else ${siteConfigs.applyError} end`,
        applyErrorVersion: sql`case when ${siteConfigs.applyErrorVersion} <= ${version} then null else ${siteConfigs.applyErrorVersion} end`,
      })
      .where(eq(siteConfigs.siteId, siteId));
  } else if (version >= (row.appliedVersion ?? 0)) {
    await db
      .update(siteConfigs)
      .set({ applyError: error ?? "The site could not apply this configuration", applyErrorVersion: version })
      .where(eq(siteConfigs.siteId, siteId));
  }

  return NextResponse.json({ ok: true });
}
