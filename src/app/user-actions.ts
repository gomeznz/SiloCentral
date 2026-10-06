"use server";

import { z } from "zod";
import { count, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { users } from "@/db/schema";
import { endSessionsForUser, requireAdmin, requireUser } from "@/lib/auth";
import { hashPassword, passwordProblem, verifyPassword } from "@/lib/password";

function redirectWithMessage(path: string, key: "error" | "ok", message: string): never {
  redirect(`${path}?${key}=${encodeURIComponent(message)}`);
}

const UsernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9._-]{3,40}$/, "Username: 3-40 characters, letters, numbers, dot, dash or underscore");

const RoleSchema = z.enum(["admin", "viewer"]);

async function adminCount(): Promise<number> {
  const [{ value }] = await db.select({ value: count() }).from(users).where(eq(users.role, "admin"));
  return value;
}

// Refuses any change that would leave nobody able to sign in to Setup.
async function assertNotLastAdmin(userId: number, path: string, what: string) {
  const [target] = await db.select({ role: users.role }).from(users).where(eq(users.id, userId)).limit(1);
  if (target?.role === "admin" && (await adminCount()) <= 1) {
    redirectWithMessage(path, "error", `You can't ${what} the only admin`);
  }
}

export async function createUserAction(formData: FormData) {
  await requireAdmin();

  const username = UsernameSchema.safeParse(formData.get("username"));
  if (!username.success) {
    redirectWithMessage("/admin/users", "error", username.error.issues[0]?.message ?? "Invalid username");
  }
  const role = RoleSchema.safeParse(formData.get("role"));
  if (!role.success) redirectWithMessage("/admin/users", "error", "Choose a role");

  const password = String(formData.get("password") ?? "");
  const problem = passwordProblem(password);
  if (problem) redirectWithMessage("/admin/users", "error", problem);

  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.username, username.data)).limit(1);
  if (existing) redirectWithMessage("/admin/users", "error", "That username is already taken");

  await db.insert(users).values({
    username: username.data,
    passwordHash: await hashPassword(password),
    role: role.data,
  });

  revalidatePath("/admin/users");
  redirectWithMessage("/admin/users", "ok", `Added ${username.data}`);
}

export async function resetPasswordAction(formData: FormData) {
  const admin = await requireAdmin();

  const id = z.coerce.number().int().positive().parse(formData.get("id"));
  const password = String(formData.get("password") ?? "");
  const problem = passwordProblem(password);
  if (problem) redirectWithMessage("/admin/users", "error", problem);

  await db.update(users).set({ passwordHash: await hashPassword(password) }).where(eq(users.id, id));
  // Whoever had that account open is signed out; an admin resetting their own
  // password stays signed in on the page they're using.
  await endSessionsForUser(id, id === admin.id);

  revalidatePath("/admin/users");
  redirectWithMessage("/admin/users", "ok", "Password updated");
}

export async function setUserRoleAction(formData: FormData) {
  await requireAdmin();

  const id = z.coerce.number().int().positive().parse(formData.get("id"));
  const role = RoleSchema.parse(formData.get("role"));

  if (role !== "admin") await assertNotLastAdmin(id, "/admin/users", "demote");
  await db.update(users).set({ role }).where(eq(users.id, id));

  revalidatePath("/admin/users");
  redirectWithMessage("/admin/users", "ok", "Role updated");
}

export async function deleteUserAction(formData: FormData) {
  const admin = await requireAdmin();

  const id = z.coerce.number().int().positive().parse(formData.get("id"));
  if (id === admin.id) redirectWithMessage("/admin/users", "error", "You can't delete your own account");
  await assertNotLastAdmin(id, "/admin/users", "delete");

  // Their sessions are removed with the row (ON DELETE CASCADE).
  await db.delete(users).where(eq(users.id, id));

  revalidatePath("/admin/users");
  redirectWithMessage("/admin/users", "ok", "User deleted");
}

// Any signed-in user, for their own account only.
export async function changeOwnPasswordAction(formData: FormData) {
  const user = await requireUser();

  const current = String(formData.get("current") ?? "");
  const next = String(formData.get("next") ?? "");
  const problem = passwordProblem(next);
  if (problem) redirectWithMessage("/account", "error", problem);

  const [row] = await db.select({ passwordHash: users.passwordHash }).from(users).where(eq(users.id, user.id)).limit(1);
  if (!row || !(await verifyPassword(current, row.passwordHash))) {
    redirectWithMessage("/account", "error", "Your current password is incorrect");
  }

  await db.update(users).set({ passwordHash: await hashPassword(next) }).where(eq(users.id, user.id));
  // Signs out every other device that had this account open.
  await endSessionsForUser(user.id, true);

  redirectWithMessage("/account", "ok", "Password changed");
}
