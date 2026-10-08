import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { customers, customerSites } from "@/db/schema";
import { takeRequest } from "@/lib/rate-limit";

export const API_KEY_PREFIX = "sck_";
// Requests per minute per customer key. Generous for a developer pulling data
// on a schedule, small enough that a runaway loop can't swamp the database.
const REQUESTS_PER_MINUTE = 120;

export function hashApiKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

// A new key: shown to the admin once, stored only as a hash.
export function generateApiKey(): { key: string; hash: string; prefix: string } {
  const key = `${API_KEY_PREFIX}${randomBytes(32).toString("base64url")}`;
  return { key, hash: hashApiKey(key), prefix: key.slice(0, 8) };
}

export type AuthorizedCustomer = { id: number; name: string; siteIds: number[] };

function json(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store", ...headers } });
}

// Only touch lastUsedAt about once a minute per customer, so a busy key
// doesn't turn every read into a write.
const lastTouched = new Map<number, number>();

// Checks the Bearer key, applies the rate limit and returns who is calling
// and which sites they may read — or the Response to send back instead.
export async function authenticateCustomer(request: Request): Promise<AuthorizedCustomer | Response> {
  const header = request.headers.get("authorization");
  const key = header?.startsWith("Bearer ") ? header.slice("Bearer ".length).trim() : null;
  if (!key) {
    return json(401, { error: "Missing API key. Send it as: Authorization: Bearer <key>" }, { "WWW-Authenticate": "Bearer" });
  }

  const [customer] = await db
    .select({ id: customers.id, name: customers.name })
    .from(customers)
    .where(eq(customers.keyHash, hashApiKey(key)))
    .limit(1);
  if (!customer) {
    return json(401, { error: "Invalid API key" }, { "WWW-Authenticate": "Bearer" });
  }

  const limit = takeRequest(`customer:${customer.id}`, REQUESTS_PER_MINUTE);
  if (!limit.allowed) {
    return json(
      429,
      { error: `Rate limit exceeded: ${REQUESTS_PER_MINUTE} requests per minute. Retry in ${limit.retryAfterSeconds}s.` },
      { "Retry-After": String(limit.retryAfterSeconds), "X-RateLimit-Limit": String(limit.limit), "X-RateLimit-Remaining": "0" },
    );
  }

  const now = Date.now();
  if (now - (lastTouched.get(customer.id) ?? 0) > 60_000) {
    lastTouched.set(customer.id, now);
    await db.update(customers).set({ lastUsedAt: new Date(now) }).where(eq(customers.id, customer.id));
  }

  const grants = await db
    .select({ siteId: customerSites.siteId })
    .from(customerSites)
    .where(eq(customerSites.customerId, customer.id));

  return { id: customer.id, name: customer.name, siteIds: grants.map((g) => g.siteId) };
}

export function apiJson(body: unknown, init: { status?: number; headers?: Record<string, string> } = {}): Response {
  return json(init.status ?? 200, body, init.headers);
}

export function apiError(status: number, message: string, extra: Record<string, unknown> = {}): Response {
  return json(status, { error: message, ...extra });
}
