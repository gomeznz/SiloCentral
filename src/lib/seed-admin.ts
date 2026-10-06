import { count } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { hashPassword, passwordProblem } from "@/lib/password";

// Creates the very first admin account from two environment variables, so
// there's no sign-up page to leave open and no password ever has to be typed
// into a chat or a config file by anyone but its owner. Does nothing once any
// user exists — so it can't be used later to add or reset an account — and
// INITIAL_ADMIN_PASSWORD can (and should) be deleted after the first sign-in.
export async function seedInitialAdmin(): Promise<void> {
  const username = process.env.INITIAL_ADMIN_USERNAME?.trim().toLowerCase();
  const password = process.env.INITIAL_ADMIN_PASSWORD;
  if (!username || !password) return;

  try {
    const [{ value: existing }] = await db.select({ value: count() }).from(users);
    if (existing > 0) return;

    if (!/^[a-z0-9._-]{3,40}$/.test(username)) {
      console.error("INITIAL_ADMIN_USERNAME must be 3-40 characters: letters, numbers, dot, dash, underscore.");
      return;
    }
    const problem = passwordProblem(password);
    if (problem) {
      console.error(`INITIAL_ADMIN_PASSWORD rejected: ${problem}.`);
      return;
    }

    await db.insert(users).values({ username, passwordHash: await hashPassword(password), role: "admin" });
    console.log(`Created the first admin account "${username}". Remove INITIAL_ADMIN_PASSWORD now.`);
  } catch (err) {
    // Typically the users table doesn't exist yet (migrations not applied).
    console.error("Could not create the initial admin account:", err instanceof Error ? err.message : err);
  }
}
