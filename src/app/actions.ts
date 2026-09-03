"use server";

// No authentication exists in this app yet — anyone who can reach it can
// add/delete sites and see/regenerate their API keys. Fine for internal
// use; add an auth check here before this is reachable from anywhere
// untrusted (it's a bigger deal here than in SiloMon itself, since a leaked
// key lets someone impersonate a site's data feed).

import { randomBytes } from "crypto";
import { z } from "zod";
import { and, eq, ne } from "drizzle-orm";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { sites } from "@/db/schema";

function redirectWithError(path: string, message: string): never {
  redirect(`${path}?error=${encodeURIComponent(message)}`);
}

function slugify(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function generateApiKey(): string {
  return randomBytes(24).toString("hex");
}

const CreateSiteSchema = z.object({
  name: z.string().trim().min(1, "Enter a site name"),
});

export async function createSiteAction(formData: FormData) {
  const parsed = CreateSiteSchema.safeParse({ name: formData.get("name") });
  if (!parsed.success) {
    redirectWithError("/admin", parsed.error.issues[0]?.message ?? "Invalid input");
  }

  const slug = slugify(parsed.data.name);
  if (!slug) {
    redirectWithError("/admin", "Enter a site name");
  }

  const existing = await db.select({ id: sites.id }).from(sites).where(eq(sites.slug, slug));
  if (existing.length > 0) {
    redirectWithError("/admin", "A site with that name already exists");
  }

  await db.insert(sites).values({ name: parsed.data.name, slug, apiKey: generateApiKey() });

  revalidatePath("/");
  revalidatePath("/admin");
  redirect("/admin");
}

const UpdateSiteSchema = z.object({
  id: z.coerce.number().int().positive(),
  name: z.string().trim().min(1, "Enter a site name"),
});

export async function updateSiteAction(formData: FormData) {
  const id = formData.get("id");

  const parsed = UpdateSiteSchema.safeParse({ id, name: formData.get("name") });
  if (!parsed.success) {
    redirectWithError(`/admin/${id}`, parsed.error.issues[0]?.message ?? "Invalid input");
  }

  const slug = slugify(parsed.data.name);
  if (!slug) {
    redirectWithError(`/admin/${id}`, "Enter a site name");
  }

  const existing = await db
    .select({ id: sites.id })
    .from(sites)
    .where(and(eq(sites.slug, slug), ne(sites.id, parsed.data.id)));
  if (existing.length > 0) {
    redirectWithError(`/admin/${id}`, "A site with that name already exists");
  }

  await db.update(sites).set({ name: parsed.data.name, slug }).where(eq(sites.id, parsed.data.id));

  revalidatePath("/");
  revalidatePath("/admin");
  redirect("/admin");
}

export async function regenerateApiKeyAction(formData: FormData) {
  const { id } = z.object({ id: z.coerce.number().int().positive() }).parse({
    id: formData.get("id"),
  });

  await db.update(sites).set({ apiKey: generateApiKey() }).where(eq(sites.id, id));

  revalidatePath("/admin");
  redirect(`/admin/${id}`);
}

export async function deleteSiteAction(formData: FormData) {
  const { id } = z.object({ id: z.coerce.number().int().positive() }).parse({
    id: formData.get("id"),
  });

  await db.delete(sites).where(eq(sites.id, id));

  revalidatePath("/");
  revalidatePath("/admin");
  redirect("/admin");
}
