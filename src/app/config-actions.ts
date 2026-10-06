"use server";

// Admin-only. Every action starts with requireAdmin(): a Server Action can be
// POSTed to directly, so the page that renders the form isn't a safeguard.
//
// What an admin changes here is saved as a new version of the site's
// configuration; the site picks it up on its next heartbeat and applies it
// (see src/lib/remote-config-sync.ts in SiloMon). Each edit is checked against
// the form's `expectedVersion` so a stale page can't overwrite a newer change.

import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { siteConfigs } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import { ConfigEditError, editConfig, getConfigRow, recordAudit } from "@/lib/site-config";
import {
  ConfigPageSchema,
  ConfigSiloSchema,
  DATA_TYPES,
  type ConfigSilo,
  type SiteConfigContent,
} from "@/lib/site-config-schema";

const Id = z.coerce.number().int().positive();

function field(formData: FormData, name: string): string {
  return String(formData.get(name) ?? "").trim();
}

function slugify(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// A slug nobody else on the site is using, derived from the page's name.
function uniqueSlug(draft: SiteConfigContent, name: string, ignoreUid?: string): string {
  const base = slugify(name) || "page";
  const taken = new Set(draft.pages.filter((p) => p.uid !== ignoreUid).map((p) => p.slug));
  if (!taken.has(base)) return base;
  for (let n = 2; ; n++) {
    if (!taken.has(`${base}-${n}`)) return `${base}-${n}`;
  }
}

// "host 127.0.0.1 → 127.0.0.2; port 502 → 1503" — what an edit actually
// changed, for the audit log. An edit of a Modbus setting is the kind of thing
// someone will later need to trace, so "Edited silo X" on its own isn't enough.
function describeChanges(label: string, before: object, after: object): string {
  const show = (v: unknown) => (v === null ? "none" : typeof v === "boolean" ? (v ? "yes" : "no") : String(v));
  const b = before as Record<string, unknown>;
  const a = after as Record<string, unknown>;
  const changes = Object.keys(a)
    .filter((k) => k !== "uid" && JSON.stringify(a[k]) !== JSON.stringify(b[k]))
    .map((k) => `${k} ${show(b[k])} → ${show(a[k])}`);
  if (changes.length === 0) return `${label}: no changes`;
  const shown = changes.slice(0, 8).join("; ");
  return `${label}: ${shown}${changes.length > 8 ? ` (+${changes.length - 8} more)` : ""}`;
}

const nextOrder = (items: { sortOrder: number }[]) => items.reduce((max, i) => Math.max(max, i.sortOrder), -1) + 1;

// "port: Too big: expected number to be <=65535" rather than a raw zod dump,
// for a single silo/page checked on its own before it goes into the document.
function describe(error: z.ZodError): string {
  return error.issues
    .slice(0, 3)
    .map((i) => `${String(i.path.at(-1) ?? "value")}: ${i.message}`)
    .join("; ");
}

function back(path: string, key: "ok" | "error", message: string): never {
  redirect(`${path}?${key}=${encodeURIComponent(message)}`);
}

// Runs an edit and sends the admin to the right place afterwards. redirect()
// works by throwing, so it must stay outside the try.
async function perform(opts: {
  siteId: number;
  expectedVersion: number;
  username: string;
  summary: string;
  edit: (draft: SiteConfigContent) => void;
  successTo: string;
  errorTo: string;
}): Promise<never> {
  let error: string | null = null;
  let version = 0;
  try {
    version = await editConfig(opts);
  } catch (e) {
    if (e instanceof ConfigEditError) error = e.message;
    else throw e;
  }

  revalidatePath(`/admin/${opts.siteId}/config`);
  if (error) back(opts.errorTo, "error", error);
  back(opts.successTo, "ok", `Saved as v${version}. The site applies it within about a minute.`);
}

const configPath = (siteId: number) => `/admin/${siteId}/config`;

function readBase(formData: FormData) {
  return { siteId: Id.parse(formData.get("siteId")), expectedVersion: Id.parse(formData.get("expectedVersion")) };
}

// ---- management ----------------------------------------------------------

export async function takeOverAction(formData: FormData) {
  const admin = await requireAdmin();
  const siteId = Id.parse(formData.get("siteId"));
  const path = configPath(siteId);

  if (formData.get("confirm") !== "on") {
    back(path, "error", "Tick the box to confirm that this configuration should replace the site's own settings");
  }
  const row = await getConfigRow(siteId);
  if (!row) back(path, "error", "This site hasn't sent its configuration yet");
  if (row.managed) back(path, "ok", "Already managed from here");

  await db
    .update(siteConfigs)
    .set({ managed: true, importRequested: false, updatedAt: new Date() })
    .where(eq(siteConfigs.siteId, siteId));
  await recordAudit(siteId, admin.username, `Took over management of this site (v${row.version})`);

  revalidatePath(path);
  back(path, "ok", "Management taken over. The site will lock its own Setup page and apply this within about a minute.");
}

export async function releaseAction(formData: FormData) {
  const admin = await requireAdmin();
  const siteId = Id.parse(formData.get("siteId"));
  const path = configPath(siteId);

  await db.update(siteConfigs).set({ managed: false, importRequested: false, updatedAt: new Date() }).where(eq(siteConfigs.siteId, siteId));
  await recordAudit(siteId, admin.username, "Released management of this site back to the site");

  revalidatePath(path);
  back(path, "ok", "Released. The site's own Setup page becomes editable again within about a minute.");
}

export async function requestReimportAction(formData: FormData) {
  const admin = await requireAdmin();
  const siteId = Id.parse(formData.get("siteId"));
  const path = configPath(siteId);

  const row = await getConfigRow(siteId);
  if (!row) back(path, "error", "This site hasn't sent its configuration yet");
  if (row.managed) back(path, "error", "Release management first — a managed site's configuration is held here");

  await db.update(siteConfigs).set({ importRequested: true, updatedAt: new Date() }).where(eq(siteConfigs.siteId, siteId));
  await recordAudit(siteId, admin.username, "Asked the site to send its current configuration again");

  revalidatePath(path);
  back(path, "ok", "Requested. The site sends a fresh copy on its next heartbeat.");
}

// ---- pages ----------------------------------------------------------------

export async function addPageAction(formData: FormData) {
  const admin = await requireAdmin();
  const { siteId, expectedVersion } = readBase(formData);
  const path = configPath(siteId);
  const name = field(formData, "name");

  return perform({
    siteId,
    expectedVersion,
    username: admin.username,
    summary: `Added page "${name}"`,
    successTo: path,
    errorTo: path,
    edit: (draft) => {
      const page = ConfigPageSchema.safeParse({
        uid: randomUUID(),
        name,
        slug: uniqueSlug(draft, name),
        sortOrder: nextOrder(draft.pages),
      });
      if (!page.success) throw new ConfigEditError(describe(page.error));
      draft.pages.push(page.data);
    },
  });
}

export async function updatePageAction(formData: FormData) {
  const admin = await requireAdmin();
  const { siteId, expectedVersion } = readBase(formData);
  const uid = field(formData, "uid");
  const here = `${configPath(siteId)}/pages/${uid}`;
  const name = field(formData, "name");

  return perform({
    siteId,
    expectedVersion,
    username: admin.username,
    summary: `Edited page "${name}"`,
    successTo: configPath(siteId),
    errorTo: here,
    edit: (draft) => {
      const existing = draft.pages.find((p) => p.uid === uid);
      if (!existing) throw new ConfigEditError("That page no longer exists");
      const page = ConfigPageSchema.safeParse({
        uid,
        name,
        slug: uniqueSlug(draft, name, uid),
        sortOrder: Number(field(formData, "sortOrder")),
      });
      if (!page.success) throw new ConfigEditError(describe(page.error));
      const detail = describeChanges(`Edited page "${existing.name}"`, existing, page.data);
      Object.assign(existing, page.data);
      return detail;
    },
  });
}

export async function deletePageAction(formData: FormData) {
  const admin = await requireAdmin();
  const { siteId, expectedVersion } = readBase(formData);
  const uid = field(formData, "uid");
  const path = configPath(siteId);

  return perform({
    siteId,
    expectedVersion,
    username: admin.username,
    summary: "Deleted a page",
    successTo: path,
    errorTo: path,
    edit: (draft) => {
      const page = draft.pages.find((p) => p.uid === uid);
      if (!page) throw new ConfigEditError("That page no longer exists");
      // Deleting a page's silos would also delete their reading history on the
      // site, so it has to be a deliberate, separate step rather than a side
      // effect of deleting the page.
      const count = draft.silos.filter((s) => s.pageUid === uid).length;
      if (count > 0) {
        throw new ConfigEditError(
          `"${page.name}" still has ${count} silo${count === 1 ? "" : "s"}. Move or delete them first.`,
        );
      }
      draft.pages = draft.pages.filter((p) => p.uid !== uid);
      return `Deleted page "${page.name}"`;
    },
  });
}

// ---- silos ----------------------------------------------------------------

const optionalPercent = (value: string): number | null => (value === "" ? null : Number(value));

// Form fields -> the wire shape, checked on its own first so the admin gets a
// message about the field they typed rather than about the whole document.
function readSilo(formData: FormData, uid: string, sortOrder: number): ConfigSilo {
  const dataType = field(formData, "dataType");
  const silo = ConfigSiloSchema.safeParse({
    uid,
    pageUid: field(formData, "pageUid"),
    name: field(formData, "name"),
    sortOrder,
    host: field(formData, "host"),
    port: Number(field(formData, "port") || 502),
    unitId: Number(field(formData, "unitId") || 1),
    registerAddress: Number(field(formData, "registerAddress")),
    dataType: (DATA_TYPES as readonly string[]).includes(dataType) ? dataType : "UINT16",
    scale: Number(field(formData, "scale") || 1),
    invertLevel: formData.get("invertLevel") === "on",
    capacity: Number(field(formData, "capacity")),
    unit: field(formData, "unit") || "t",
    lowAlarmPercent: optionalPercent(field(formData, "lowAlarmPercent")),
    highAlarmPercent: optionalPercent(field(formData, "highAlarmPercent")),
    criticalPercent: optionalPercent(field(formData, "criticalPercent")),
    isActive: formData.get("isActive") === "on",
  });
  if (!silo.success) throw new ConfigEditError(describe(silo.error));
  return silo.data;
}

export async function addSiloAction(formData: FormData) {
  const admin = await requireAdmin();
  const { siteId, expectedVersion } = readBase(formData);
  const path = configPath(siteId);

  return perform({
    siteId,
    expectedVersion,
    username: admin.username,
    summary: `Added silo "${field(formData, "name")}"`,
    successTo: path,
    errorTo: path,
    edit: (draft) => {
      const pageUid = field(formData, "pageUid");
      const onPage = draft.silos.filter((s) => s.pageUid === pageUid);
      draft.silos.push(readSilo(formData, randomUUID(), nextOrder(onPage)));
    },
  });
}

export async function updateSiloAction(formData: FormData) {
  const admin = await requireAdmin();
  const { siteId, expectedVersion } = readBase(formData);
  const uid = field(formData, "uid");

  return perform({
    siteId,
    expectedVersion,
    username: admin.username,
    summary: `Edited silo "${field(formData, "name")}"`,
    successTo: configPath(siteId),
    errorTo: `${configPath(siteId)}/silos/${uid}`,
    edit: (draft) => {
      const index = draft.silos.findIndex((s) => s.uid === uid);
      if (index < 0) throw new ConfigEditError("That silo no longer exists");
      const before = draft.silos[index];
      const after = readSilo(formData, uid, Number(field(formData, "sortOrder")));
      draft.silos[index] = after;
      return describeChanges(`Edited silo "${before.name}"`, before, after);
    },
  });
}

export async function deleteSiloAction(formData: FormData) {
  const admin = await requireAdmin();
  const { siteId, expectedVersion } = readBase(formData);
  const uid = field(formData, "uid");
  const path = configPath(siteId);

  return perform({
    siteId,
    expectedVersion,
    username: admin.username,
    summary: "Deleted a silo",
    successTo: path,
    errorTo: path,
    edit: (draft) => {
      const silo = draft.silos.find((s) => s.uid === uid);
      if (!silo) throw new ConfigEditError("That silo no longer exists");
      draft.silos = draft.silos.filter((s) => s.uid !== uid);
      return `Deleted silo "${silo.name}" (${silo.host}:${silo.port}, register ${silo.registerAddress})`;
    },
  });
}
