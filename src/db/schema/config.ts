import { pgTable, serial, integer, text, timestamp, jsonb, boolean } from "drizzle-orm/pg-core";
import { sites } from "./sites";
import type { SiteConfigContent } from "../../lib/site-config-schema";

// What SiloCentral holds about a site's pages and silos (see
// src/lib/site-config.ts). One row per site, created when the site first
// sends its configuration up.
export const siteConfigs = pgTable("site_configs", {
  siteId: integer("site_id")
    .primaryKey()
    .references(() => sites.id, { onDelete: "cascade" }),
  // Bumped on every change. The site compares it with the version it last
  // applied to know there's something new to fetch.
  version: integer("version").notNull(),
  config: jsonb("config").$type<SiteConfigContent>().notNull(),

  // false: an imported snapshot, shown read-only — the site still edits its own
  // pages and silos. true: an admin has taken over, edits here are applied to
  // the site, and the site's own Setup page is locked.
  managed: boolean("managed").notNull().default(false),
  // An admin asked for a fresh copy of the site's current configuration.
  importRequested: boolean("import_requested").notNull().default(false),
  importedAt: timestamp("imported_at", { withTimezone: true }),

  // What the site last reported back, so the page can say "applied", "waiting"
  // or "the site rejected v8 because…".
  appliedVersion: integer("applied_version"),
  appliedAt: timestamp("applied_at", { withTimezone: true }),
  applyError: text("apply_error"),
  applyErrorVersion: integer("apply_error_version"),

  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// Who changed what on a site's configuration. The username is copied in
// rather than only referenced, so the record survives the account being
// deleted.
export const configAudit = pgTable("config_audit", {
  id: serial("id").primaryKey(),
  siteId: integer("site_id")
    .notNull()
    .references(() => sites.id, { onDelete: "cascade" }),
  username: text("username").notNull(),
  summary: text("summary").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
