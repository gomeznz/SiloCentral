import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { and, eq, gt, lt, ne } from "drizzle-orm";
import { db } from "@/db";
import { sessions, users } from "@/db/schema";

export const SESSION_COOKIE = "silocentral_session";
const SESSION_DAYS = 30;

export type CurrentUser = { id: number; username: string; role: "admin" | "viewer" };

// The cookie holds a random token; the database holds only its hash.
function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

// Only callable from a Server Action or Route Handler (setting a cookie isn't
// allowed while rendering a page).
export async function createSession(userId: number): Promise<void> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 3600_000);

  await db.insert(sessions).values({ id: hashToken(token), userId, expiresAt });
  // Opportunistic tidy-up so expired rows don't pile up forever.
  await db.delete(sessions).where(lt(sessions.expiresAt, new Date()));

  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true, // not readable by page scripts
    sameSite: "lax", // not sent on cross-site POSTs
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

async function currentSessionId(): Promise<string | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return token ? hashToken(token) : null;
}

// Who is signed in right now, checked against the database on every request
// (cached for the duration of one). The proxy only looks for the cookie's
// presence; THIS is what actually authenticates.
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const sessionId = await currentSessionId();
  if (!sessionId) return null;

  const [row] = await db
    .select({ id: users.id, username: users.username, role: users.role })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.id, sessionId), gt(sessions.expiresAt, new Date())))
    .limit(1);

  return row ?? null;
});

// Call at the top of every page and every Server Action that needs a login.
// Don't rely on a layout for this — layouts don't re-render on client-side
// navigation, and actions are reachable by direct POST regardless of the page.
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireAdmin(): Promise<CurrentUser> {
  const user = await requireUser();
  if (user.role !== "admin") redirect("/");
  return user;
}

export async function destroySession(): Promise<void> {
  const sessionId = await currentSessionId();
  if (sessionId) await db.delete(sessions).where(eq(sessions.id, sessionId));
  (await cookies()).delete(SESSION_COOKIE);
}

// Signs a user out everywhere — used when their password changes or they're
// deleted. `keepCurrent` spares the session making the change, so changing
// your own password doesn't log you out of the page you're on.
export async function endSessionsForUser(userId: number, keepCurrent = false): Promise<void> {
  const keep = keepCurrent ? await currentSessionId() : null;
  await db
    .delete(sessions)
    .where(keep ? and(eq(sessions.userId, userId), ne(sessions.id, keep)) : eq(sessions.userId, userId));
}
