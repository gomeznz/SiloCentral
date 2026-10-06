import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { siteConfigs, sites } from "@/db/schema";
import { authenticateSite } from "@/lib/site-auth";
import type { HeartbeatReply } from "@/lib/site-config-schema";

// A SiloMon site's worker POSTs here every ~30s (see scripts/silo-worker.ts in
// that repo) to say "I'm alive". No body is read — the Bearer key identifies
// the site, and the timestamp is taken from this server's clock rather than
// the site's, so a Pi with a drifting clock can't look online (or offline) by
// sending the wrong time.
//
// The reply is how SiloCentral talks back without ever connecting to the Pi:
// it says whether an admin has taken over this site's configuration, which
// version is current, and whether we'd like the site's own configuration sent
// up. The site acts on that (src/lib/remote-config-sync.ts there). An older
// SiloMon ignores the body entirely.
export async function POST(request: Request) {
  const siteId = await authenticateSite(request);
  if (siteId === null) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await db.update(sites).set({ lastHeartbeatAt: new Date() }).where(eq(sites.id, siteId));

  const [config] = await db
    .select({ managed: siteConfigs.managed, version: siteConfigs.version, importRequested: siteConfigs.importRequested })
    .from(siteConfigs)
    .where(eq(siteConfigs.siteId, siteId))
    .limit(1);

  const reply: HeartbeatReply = {
    ok: true,
    managed: config?.managed ?? false,
    configVersion: config?.version ?? 0,
    // Ask for the site's configuration when we have none yet, or when an admin
    // asked for a fresh copy (only while the site isn't managed — a managed
    // site's configuration is ours, not theirs).
    wantsImport: !config || (config.importRequested && !config.managed),
  };
  return NextResponse.json(reply);
}
