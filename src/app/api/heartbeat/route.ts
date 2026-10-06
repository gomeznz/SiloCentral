import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { sites } from "@/db/schema";
import { authenticateSite } from "@/lib/site-auth";

// A SiloMon site's worker POSTs here every ~30s (see scripts/silo-worker.ts in
// that repo) purely to say "I'm alive". No body is read — the Bearer key
// identifies the site, and the timestamp is taken from this server's clock
// rather than the site's, so a Pi with a drifting clock can't look online
// (or offline) by sending the wrong time.
export async function POST(request: Request) {
  const siteId = await authenticateSite(request);
  if (siteId === null) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await db.update(sites).set({ lastHeartbeatAt: new Date() }).where(eq(sites.id, siteId));

  return NextResponse.json({ ok: true });
}
