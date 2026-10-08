"use server";

import { z } from "zod";
import { eq, inArray, ne, and } from "drizzle-orm";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { customers, customerSites, sites } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import { generateApiKey } from "@/lib/customer-auth";

// Result of an action that reveals a new API key. The key exists only in this
// return value: it is stored hashed, so it can't be shown again later.
export type KeyState = { error?: string; key?: string; customer?: string } | null;

const NameSchema = z.string().trim().min(1, "Enter a customer name").max(100, "Keep the name under 100 characters");

function redirectWithMessage(key: "error" | "ok", message: string): never {
  redirect(`/admin/customers?${key}=${encodeURIComponent(message)}`);
}

// The ticked sites, limited to ones that really exist.
async function readSiteIds(formData: FormData): Promise<number[]> {
  const wanted = [...new Set(formData.getAll("siteId").map((v) => Number(v)).filter((n) => Number.isInteger(n) && n > 0))];
  if (wanted.length === 0) return [];
  const rows = await db.select({ id: sites.id }).from(sites).where(inArray(sites.id, wanted));
  return rows.map((r) => r.id);
}

export async function createCustomerAction(_previous: KeyState, formData: FormData): Promise<KeyState> {
  await requireAdmin();

  const name = NameSchema.safeParse(formData.get("name"));
  if (!name.success) return { error: name.error.issues[0]?.message ?? "Invalid name" };

  const [existing] = await db.select({ id: customers.id }).from(customers).where(eq(customers.name, name.data)).limit(1);
  if (existing) return { error: "There is already a customer with that name" };

  const siteIds = await readSiteIds(formData);
  const { key, hash, prefix } = generateApiKey();

  await db.transaction(async (tx) => {
    const [customer] = await tx
      .insert(customers)
      .values({ name: name.data, keyHash: hash, keyPrefix: prefix })
      .returning({ id: customers.id });
    if (siteIds.length > 0) {
      await tx.insert(customerSites).values(siteIds.map((siteId) => ({ customerId: customer.id, siteId })));
    }
  });

  revalidatePath("/admin/customers");
  return { key, customer: name.data };
}

export async function regenerateKeyAction(_previous: KeyState, formData: FormData): Promise<KeyState> {
  await requireAdmin();

  if (formData.get("confirm") !== "on") return { error: "Tick the box to confirm: the current key stops working immediately" };
  const id = z.coerce.number().int().positive().safeParse(formData.get("id"));
  if (!id.success) return { error: "Unknown customer" };

  const { key, hash, prefix } = generateApiKey();
  const [updated] = await db
    .update(customers)
    .set({ keyHash: hash, keyPrefix: prefix, lastUsedAt: null })
    .where(eq(customers.id, id.data))
    .returning({ name: customers.name });
  if (!updated) return { error: "That customer no longer exists" };

  revalidatePath("/admin/customers");
  return { key, customer: updated.name };
}

export async function updateCustomerAction(formData: FormData) {
  await requireAdmin();

  const id = z.coerce.number().int().positive().safeParse(formData.get("id"));
  if (!id.success) redirectWithMessage("error", "Unknown customer");
  const name = NameSchema.safeParse(formData.get("name"));
  if (!name.success) redirectWithMessage("error", name.error.issues[0]?.message ?? "Invalid name");

  const [clash] = await db
    .select({ id: customers.id })
    .from(customers)
    .where(and(eq(customers.name, name.data), ne(customers.id, id.data)))
    .limit(1);
  if (clash) redirectWithMessage("error", "There is already a customer with that name");

  const siteIds = await readSiteIds(formData);

  await db.transaction(async (tx) => {
    await tx.update(customers).set({ name: name.data }).where(eq(customers.id, id.data));
    await tx.delete(customerSites).where(eq(customerSites.customerId, id.data));
    if (siteIds.length > 0) {
      await tx.insert(customerSites).values(siteIds.map((siteId) => ({ customerId: id.data, siteId })));
    }
  });

  revalidatePath("/admin/customers");
  redirectWithMessage("ok", `Saved ${name.data}. Site access changes apply to the very next request.`);
}

export async function deleteCustomerAction(formData: FormData) {
  await requireAdmin();

  const id = z.coerce.number().int().positive().safeParse(formData.get("id"));
  if (!id.success) redirectWithMessage("error", "Unknown customer");
  if (formData.get("confirm") !== "on") redirectWithMessage("error", "Tick the box to confirm the delete");

  const [removed] = await db.delete(customers).where(eq(customers.id, id.data)).returning({ name: customers.name });

  revalidatePath("/admin/customers");
  redirectWithMessage("ok", removed ? `Deleted ${removed.name}. Their key no longer works.` : "That customer was already gone");
}
