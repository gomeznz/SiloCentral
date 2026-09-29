import { pgTable, serial, integer, text, timestamp, jsonb, numeric } from "drizzle-orm/pg-core";

// Mirrors the SiloReport shape each SiloMon site pushes (see
// src/lib/report.ts in the SiloMon repo) — kept as a plain type here rather
// than a shared package since these are two separate deployable repos.
export type SiteSiloStatus = "ok" | "low" | "critical" | "high" | "offline";

export type SiteReport = {
  site: string;
  generatedAt: string;
  pages: {
    name: string;
    slug: string;
    silos: {
      name: string;
      status: SiteSiloStatus;
      percent: number;
      currentValue: number | null;
      capacity: number;
      unit: string;
      lastReadAt: string | null;
    }[];
  }[];
};

// One row per SiloMon site. latestReport is simply overwritten by each
// push — this table only ever shows current status across sites. Per-silo
// history for trend charts lives in siteSiloReadings below instead, so this
// row doesn't grow.
export const sites = pgTable("sites", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  apiKey: text("api_key").notNull().unique(),
  latestReport: jsonb("latest_report").$type<SiteReport>(),
  lastReportAt: timestamp("last_report_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// Append-only trend history — one row per silo per ingested report (see
// src/app/api/ingest/route.ts). Keyed by (siteId, pageSlug, siloName) rather
// than a foreign-keyed silo id, since a silo here is just a name inside a
// site's pushed JSON, not a row of its own. Stores percent directly (already
// computed by the pushing site) rather than raw value + capacity, since
// percent-of-capacity is the only thing the trend chart plots.
export const siteSiloReadings = pgTable("site_silo_readings", {
  id: serial("id").primaryKey(),
  siteId: integer("site_id")
    .notNull()
    .references(() => sites.id, { onDelete: "cascade" }),
  pageSlug: text("page_slug").notNull(),
  siloName: text("silo_name").notNull(),
  percent: numeric("percent", { precision: 5, scale: 2 }).notNull(),
  recordedAt: timestamp("recorded_at", { withTimezone: true }).notNull().defaultNow(),
});
