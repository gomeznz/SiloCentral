import { eq } from "drizzle-orm";
import { db } from "@/db";
import { sites } from "@/db/schema";

// Per-site auth shared by every endpoint a SiloMon site calls: the Bearer
// token must match that site's own apiKey — there's no shared/master key, so
// a leaked key only exposes one site. Returns the site's id, or null when
// the header is missing or the key matches no site.
export async function authenticateSite(request: Request): Promise<number | null> {
  const authHeader = request.headers.get("authorization");
  const apiKey = authHeader?.startsWith("Bearer ") ? authHeader.slice("Bearer ".length) : null;
  if (!apiKey) return null;

  const [site] = await db.select({ id: sites.id }).from(sites).where(eq(sites.apiKey, apiKey)).limit(1);
  return site?.id ?? null;
}
