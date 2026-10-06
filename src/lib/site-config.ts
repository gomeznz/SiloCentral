import "server-only";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { configAudit, siteConfigs } from "@/db/schema";
import { SiteConfigSchema, formatConfigIssues, type SiteConfigContent } from "@/lib/site-config-schema";

export type ConfigRow = typeof siteConfigs.$inferSelect;

// Thrown for anything an admin can fix (a bad value, a stale form, editing a
// site that isn't managed yet) — the action turns the message into an error
// banner. Anything else is a bug and is left to surface as one.
export class ConfigEditError extends Error {}

export async function getConfigRow(siteId: number): Promise<ConfigRow | null> {
  const [row] = await db.select().from(siteConfigs).where(eq(siteConfigs.siteId, siteId)).limit(1);
  return row ?? null;
}

export async function recordAudit(siteId: number, username: string, summary: string): Promise<void> {
  await db.insert(configAudit).values({ siteId, username, summary });
}

export async function recentAudit(siteId: number, limit = 15) {
  return db
    .select()
    .from(configAudit)
    .where(eq(configAudit.siteId, siteId))
    .orderBy(desc(configAudit.createdAt), desc(configAudit.id))
    .limit(limit);
}

// The only way a managed site's configuration is changed. In one transaction:
//
//   - the row is locked, so two admins saving at once are processed in turn;
//   - `expectedVersion` (carried by the form the admin was looking at) must
//     still be the current version, otherwise the admin would silently
//     overwrite a change they never saw;
//   - `edit` mutates a copy, and the WHOLE result is validated with the same
//     schema the Pi re-checks, so an invalid configuration can never be saved
//     and shipped;
//   - the version is bumped (which is what tells the site there's something
//     new) and the change is recorded in the audit log.
//
// Returns the new version.
export async function editConfig(opts: {
  siteId: number;
  expectedVersion: number;
  username: string;
  summary: string;
  // May return a more specific description of what it did (naming the silo
  // that was deleted, or listing the fields that changed); that replaces
  // `summary` in the audit log.
  edit: (draft: SiteConfigContent) => string | void;
}): Promise<number> {
  return db.transaction(async (tx) => {
    const [row] = await tx.select().from(siteConfigs).where(eq(siteConfigs.siteId, opts.siteId)).for("update");

    if (!row) throw new ConfigEditError("This site hasn't sent its configuration yet");
    if (!row.managed) throw new ConfigEditError("Take over management of this site before changing its configuration");
    if (row.version !== opts.expectedVersion) {
      throw new ConfigEditError(
        "Someone else changed this configuration while you were editing it. Your change was not saved — reload and try again.",
      );
    }

    const draft = structuredClone(row.config);
    const detail = opts.edit(draft);

    const parsed = SiteConfigSchema.safeParse(draft);
    if (!parsed.success) throw new ConfigEditError(formatConfigIssues(parsed.error));

    const version = row.version + 1;
    await tx
      .update(siteConfigs)
      .set({ version, config: parsed.data, updatedAt: new Date() })
      .where(eq(siteConfigs.siteId, opts.siteId));
    await tx
      .insert(configAudit)
      .values({ siteId: opts.siteId, username: opts.username, summary: `${detail || opts.summary} (v${version})` });

    return version;
  });
}
