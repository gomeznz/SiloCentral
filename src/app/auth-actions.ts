"use server";

import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { users } from "@/db/schema";
import { createSession, destroySession } from "@/lib/auth";
import { clearFailures, lockedOutMinutes, loginKeys, recordFailure } from "@/lib/login-throttle";
import { MAX_PASSWORD_LENGTH, getDummyHash, verifyPassword } from "@/lib/password";
import { safeNext } from "@/lib/safe-next";

// The address the request really came from, as set by Railway's proxy. Prefers
// x-real-ip; otherwise the LAST x-forwarded-for entry, because earlier entries
// can be supplied by the client and so can't be trusted for rate limiting.
async function clientIp(): Promise<string> {
  const h = await headers();
  const real = h.get("x-real-ip")?.trim();
  if (real) return real;
  const forwarded = h.get("x-forwarded-for")?.split(",").map((s) => s.trim()).filter(Boolean);
  return forwarded?.[forwarded.length - 1] ?? "unknown";
}

export async function loginAction(formData: FormData) {
  const username = String(formData.get("username") ?? "").trim().toLowerCase().slice(0, 100);
  const password = String(formData.get("password") ?? "");
  const next = safeNext(formData.get("next"));

  function fail(message: string): never {
    const params = new URLSearchParams({ error: message });
    if (next !== "/") params.set("next", next);
    redirect(`/login?${params.toString()}`);
  }

  if (!username || !password || password.length > MAX_PASSWORD_LENGTH) {
    fail("Enter your username and password");
  }

  const keys = loginKeys(await clientIp(), username);
  const wait = lockedOutMinutes(keys);
  if (wait > 0) {
    fail(`Too many failed attempts. Try again in ${wait} minute${wait === 1 ? "" : "s"}.`);
  }

  const [user] = await db.select().from(users).where(eq(users.username, username)).limit(1);
  // Always do a hash comparison, even for an unknown username, so the two
  // failure cases take the same time.
  const passwordOk = await verifyPassword(password, user ? user.passwordHash : await getDummyHash());
  if (!user || !passwordOk) {
    recordFailure(keys);
    // Same message either way, so it doesn't reveal which usernames exist.
    fail("Incorrect username or password");
  }

  clearFailures(keys);
  await createSession(user.id);
  await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, user.id));
  redirect(next);
}

export async function logoutAction() {
  await destroySession();
  redirect("/login");
}
