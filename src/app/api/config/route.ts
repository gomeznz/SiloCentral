import { NextResponse } from "next/server";
import { getConfigRow } from "@/lib/site-config";
import { authenticateSite } from "@/lib/site-auth";

// A site fetches the configuration it should apply. Only served once an admin
// has taken over management of that site — until then SiloCentral only holds a
// read-only copy of what the site sent, and the site must keep using its own.
export async function GET(request: Request) {
  const siteId = await authenticateSite(request);
  if (siteId === null) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const row = await getConfigRow(siteId);
  if (!row || !row.managed) {
    return NextResponse.json({ error: "This site is not managed by SiloCentral" }, { status: 404 });
  }

  return NextResponse.json({ version: row.version, ...row.config });
}
