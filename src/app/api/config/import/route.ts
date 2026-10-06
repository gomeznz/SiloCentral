import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { siteConfigs } from "@/db/schema";
import { authenticateSite } from "@/lib/site-auth";
import { getConfigRow, recordAudit } from "@/lib/site-config";
import { SiteConfigSchema, formatConfigIssues } from "@/lib/site-config-schema";

// A site sends its current pages and silos up. Accepted only when we have
// nothing for the site yet, or an admin asked for a fresh copy — and never
// while the site is managed, so a site can't overwrite configuration an admin
// has since changed here.
export async function POST(request: Request) {
  const siteId = await authenticateSite(request);
  if (siteId === null) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const existing = await getConfigRow(siteId);
  if (existing && (existing.managed || !existing.importRequested)) {
    return NextResponse.json({ error: "A configuration import wasn't requested" }, { status: 409 });
  }

  const body = await request.json().catch(() => null);
  const parsed = SiteConfigSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid configuration", detail: formatConfigIssues(parsed.error) },
      { status: 400 },
    );
  }

  const version = (existing?.version ?? 0) + 1;
  const now = new Date();
  const values = {
    version,
    config: parsed.data,
    importRequested: false,
    importedAt: now,
    // What we just received IS what the site has, so there's nothing pending.
    appliedVersion: version,
    appliedAt: now,
    applyError: null,
    applyErrorVersion: null,
    updatedAt: now,
  };

  if (existing) {
    await db.update(siteConfigs).set(values).where(eq(siteConfigs.siteId, siteId));
  } else {
    await db.insert(siteConfigs).values({ siteId, managed: false, ...values });
  }
  await recordAudit(
    siteId,
    "site",
    `Imported the site's configuration: ${parsed.data.pages.length} pages, ${parsed.data.silos.length} silos (v${version})`,
  );

  return NextResponse.json({ ok: true, version });
}
