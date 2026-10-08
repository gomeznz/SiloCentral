import "server-only";
import { and, asc, eq, gte, inArray, lt, sql } from "drizzle-orm";
import { db } from "@/db";
import { sites, siteSiloReadings } from "@/db/schema";
import { isSiteOnline, lastSeenAt } from "@/lib/site-status";

// The data behind the reporting API (/api/v1/*) and the dashboard's CSV
// downloads: one implementation, so a customer's key and a signed-in user
// always see the same numbers. Every function takes `siteIds`, the sites the
// caller may read (null = all of them, for signed-in dashboard users) — it is
// the ONLY thing that scopes access, so every query below filters on it.

type Scope = number[] | null;

export const MAX_HISTORY_ROWS = 50_000;

// Bucket width in seconds for each `interval` a caller can ask for; 0 = raw
// readings. Only ever picked from this table, never taken from the request,
// so it is safe to inline into SQL.
export const INTERVALS = { raw: 0, "5m": 300, "15m": 900, "1h": 3600, "1d": 86400 } as const;
export type IntervalKey = keyof typeof INTERVALS;

// Tonnes of feed: the fill percentage (clamped to 0-100) of the silo's
// full-silo feed weight. Null when no feed weight is set.
export function feedStored(percent: number, feedWeightTonnes: number | null): number | null {
  if (feedWeightTonnes === null) return null;
  return round((Math.max(0, Math.min(100, percent)) / 100) * feedWeightTonnes, 2);
}

function round(value: number, places: number): number {
  const f = 10 ** places;
  return Math.round(value * f) / f;
}

function scoped(siteIds: Scope, slug?: string) {
  const conditions = [];
  if (siteIds !== null) conditions.push(siteIds.length > 0 ? inArray(sites.id, siteIds) : sql`false`);
  if (slug) conditions.push(eq(sites.slug, slug));
  return conditions.length > 0 ? and(...conditions) : undefined;
}

export async function listSites(siteIds: Scope) {
  const rows = await db.select().from(sites).where(scoped(siteIds)).orderBy(asc(sites.name));
  return rows.map((site) => {
    const seen = lastSeenAt(site);
    return { slug: site.slug, name: site.name, online: isSiteOnline(seen), lastSeenAt: seen ? seen.toISOString() : null };
  });
}

// ---- current levels --------------------------------------------------------

export type SiloLevel = {
  name: string;
  status: string;
  percent: number;
  currentValue: number | null;
  capacity: number;
  unit: string;
  feedWeightTonnes: number | null;
  feedStoredTonnes: number | null;
  lastReadAt: string | null;
};

export type SiteLevels = {
  slug: string;
  name: string;
  online: boolean;
  lastSeenAt: string | null;
  reportedAt: string | null;
  pages: { name: string; slug: string; silos: SiloLevel[] }[];
};

export async function currentLevels(siteIds: Scope, slug?: string): Promise<SiteLevels[]> {
  const rows = await db.select().from(sites).where(scoped(siteIds, slug)).orderBy(asc(sites.name));

  return rows.map((site) => {
    const seen = lastSeenAt(site);
    const report = site.latestReport;
    return {
      slug: site.slug,
      name: site.name,
      online: isSiteOnline(seen),
      lastSeenAt: seen ? seen.toISOString() : null,
      reportedAt: report?.generatedAt ?? null,
      pages: (report?.pages ?? []).map((page) => ({
        name: page.name,
        slug: page.slug,
        silos: page.silos.map((silo) => {
          const feedWeightTonnes = silo.feedWeightTonnes ?? null;
          return {
            name: silo.name,
            status: silo.status,
            percent: round(silo.percent, 2),
            currentValue: silo.currentValue,
            capacity: silo.capacity,
            unit: silo.unit,
            feedWeightTonnes,
            feedStoredTonnes: feedStored(silo.percent, feedWeightTonnes),
            lastReadAt: silo.lastReadAt,
          };
        }),
      })),
    };
  });
}

// ---- history ---------------------------------------------------------------

export type HistoryPoint = { t: string; percent: number; feedStoredTonnes: number | null };
export type HistorySeries = {
  page: string;
  name: string;
  unit: string | null;
  // The silo's feed weight as of its latest report. Tonnes in the points are
  // worked out from this, so they assume it hasn't changed over the period.
  feedWeightTonnes: number | null;
  points: HistoryPoint[];
};
export type HistorySite = { slug: string; name: string; silos: HistorySeries[] };

export type HistoryQuery = {
  siteIds: Scope;
  slug?: string;
  page?: string;
  silo?: string;
  fromMs: number; // inclusive
  toMs: number; // exclusive
  // Width of each averaged bucket, in seconds (0 = raw readings). Must come
  // from our own code (INTERVALS above, or a trend preset), never from a
  // request, because it is inlined into the SQL.
  bucketSeconds: number;
};

export async function history(query: HistoryQuery): Promise<{ sites: HistorySite[] } | { tooManyRows: true }> {
  const siteRows = await db.select().from(sites).where(scoped(query.siteIds, query.slug)).orderBy(asc(sites.name));
  if (siteRows.length === 0) return { sites: [] };
  const allowedIds = siteRows.map((s) => s.id);

  const filters = and(
    inArray(siteSiloReadings.siteId, allowedIds),
    gte(siteSiloReadings.recordedAt, new Date(query.fromMs)),
    lt(siteSiloReadings.recordedAt, new Date(query.toMs)),
    query.page ? eq(siteSiloReadings.pageSlug, query.page) : undefined,
    query.silo ? eq(siteSiloReadings.siloName, query.silo) : undefined,
  );

  const bucketSeconds = Math.max(0, Math.floor(query.bucketSeconds));
  let rows: { siteId: number; pageSlug: string; siloName: string; tMs: number; percent: number }[];

  if (bucketSeconds === 0) {
    const raw = await db
      .select({
        siteId: siteSiloReadings.siteId,
        pageSlug: siteSiloReadings.pageSlug,
        siloName: siteSiloReadings.siloName,
        recordedAt: siteSiloReadings.recordedAt,
        percent: siteSiloReadings.percent,
      })
      .from(siteSiloReadings)
      .where(filters)
      .orderBy(
        asc(siteSiloReadings.siteId),
        asc(siteSiloReadings.pageSlug),
        asc(siteSiloReadings.siloName),
        asc(siteSiloReadings.recordedAt),
      )
      .limit(MAX_HISTORY_ROWS + 1);
    rows = raw.map((r) => ({
      siteId: r.siteId,
      pageSlug: r.pageSlug,
      siloName: r.siloName,
      tMs: r.recordedAt.getTime(),
      percent: Number(r.percent),
    }));
  } else {
    // The same SQL bucketing the dashboard's trend chart uses: average the
    // readings in each fixed-width slice. The width is inlined (sql.raw) so
    // the SELECT and GROUP BY expressions are textually identical — Postgres
    // can't match `... / $1` against `... / $2`.
    const bucket = sql<number>`floor(extract(epoch from ${siteSiloReadings.recordedAt}) / ${sql.raw(String(bucketSeconds))})`.mapWith(
      Number,
    );
    const grouped = await db
      .select({
        siteId: siteSiloReadings.siteId,
        pageSlug: siteSiloReadings.pageSlug,
        siloName: siteSiloReadings.siloName,
        bucket,
        percent: sql<string>`avg(${siteSiloReadings.percent})`,
      })
      .from(siteSiloReadings)
      .where(filters)
      .groupBy(siteSiloReadings.siteId, siteSiloReadings.pageSlug, siteSiloReadings.siloName, bucket)
      .orderBy(asc(siteSiloReadings.siteId), asc(siteSiloReadings.pageSlug), asc(siteSiloReadings.siloName), asc(bucket))
      .limit(MAX_HISTORY_ROWS + 1);
    rows = grouped.map((r) => ({
      siteId: r.siteId,
      pageSlug: r.pageSlug,
      siloName: r.siloName,
      tMs: r.bucket * bucketSeconds * 1000,
      percent: Number(r.percent),
    }));
  }

  if (rows.length > MAX_HISTORY_ROWS) return { tooManyRows: true };

  // Unit and feed weight come from each site's latest report.
  const siteById = new Map(siteRows.map((s) => [s.id, s]));
  const infoFor = (siteId: number, pageSlug: string, siloName: string) =>
    siteById
      .get(siteId)
      ?.latestReport?.pages.find((p) => p.slug === pageSlug)
      ?.silos.find((s) => s.name === siloName);

  const result = new Map<number, HistorySite>();
  const seriesByKey = new Map<string, HistorySeries>();
  for (const row of rows) {
    const site = siteById.get(row.siteId);
    if (!site) continue;
    let entry = result.get(row.siteId);
    if (!entry) {
      entry = { slug: site.slug, name: site.name, silos: [] };
      result.set(row.siteId, entry);
    }
    const key = `${row.siteId}\u0000${row.pageSlug}\u0000${row.siloName}`;
    let series = seriesByKey.get(key);
    if (!series) {
      const info = infoFor(row.siteId, row.pageSlug, row.siloName);
      series = {
        page: row.pageSlug,
        name: row.siloName,
        unit: info?.unit ?? null,
        feedWeightTonnes: info?.feedWeightTonnes ?? null,
        points: [],
      };
      seriesByKey.set(key, series);
      entry.silos.push(series);
    }
    series.points.push({
      t: new Date(row.tMs).toISOString(),
      percent: round(row.percent, 2),
      feedStoredTonnes: feedStored(row.percent, series.feedWeightTonnes),
    });
  }

  return { sites: [...result.values()].sort((a, b) => a.name.localeCompare(b.name)) };
}

// ---- CSV -------------------------------------------------------------------

// One cell. Text that begins with = + - @ (or a tab/CR) is prefixed with an
// apostrophe so a spreadsheet shows it as text instead of running it as a
// formula — site, page and silo names are typed by whoever runs a site.
// Numbers are never altered.
function cell(value: string | number | boolean | null): string {
  if (value === null) return "";
  let text = String(value);
  if (typeof value === "string" && /^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function toCsv(header: string[], rows: (string | number | boolean | null)[][], bom: boolean): string {
  const lines = [header, ...rows].map((r) => r.map(cell).join(","));
  // BOM makes Excel read the file as UTF-8; harmless for it, but a nuisance
  // for programs, so only the dashboard download asks for it.
  return `${bom ? "﻿" : ""}${lines.join("\r\n")}\r\n`;
}

export function levelsToCsv(data: SiteLevels[], bom = false): string {
  const rows = data.flatMap((site) =>
    site.pages.flatMap((page) =>
      page.silos.map((silo) => [
        site.name,
        site.online,
        site.lastSeenAt,
        page.name,
        silo.name,
        silo.status,
        silo.percent,
        silo.currentValue,
        silo.capacity,
        silo.unit,
        silo.feedWeightTonnes,
        silo.feedStoredTonnes,
        silo.lastReadAt,
      ]),
    ),
  );
  return toCsv(
    [
      "site",
      "site_online",
      "site_last_seen_at",
      "page",
      "silo",
      "status",
      "percent",
      "current_value",
      "capacity",
      "unit",
      "feed_weight_tonnes",
      "feed_stored_tonnes",
      "last_read_at",
    ],
    rows,
    bom,
  );
}

export function historyToCsv(data: HistorySite[], bom = false): string {
  const rows = data.flatMap((site) =>
    site.silos.flatMap((silo) =>
      silo.points.map((p) => [site.name, silo.page, silo.name, p.t, p.percent, p.feedStoredTonnes]),
    ),
  );
  return toCsv(["site", "page", "silo", "timestamp", "percent", "feed_stored_tonnes"], rows, bom);
}
