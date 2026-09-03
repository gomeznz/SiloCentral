import { pgTable, serial, text, timestamp, jsonb } from "drizzle-orm/pg-core";

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
// push — this dashboard shows current status across sites, it doesn't keep
// history (each site's own dashboard already does that for its own data).
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
