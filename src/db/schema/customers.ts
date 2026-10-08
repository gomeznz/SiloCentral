import { pgTable, serial, integer, text, timestamp, primaryKey } from "drizzle-orm/pg-core";
import { sites } from "./sites";

// A customer is an outside party (a person or another company's system) who
// reads data over the reporting API (/api/v1/*) with a key of their own, and
// can see only the sites they've been granted. Separate from `users`, which
// are people who sign in to the dashboards.
export const customers = pgTable("customers", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  // SHA-256 of the key; the key itself is shown once, when it's created, and
  // never stored — so a leaked copy of this table can't be used to call the
  // API. The keys are 256 bits of randomness, so an unsalted fast hash is
  // fine (there is nothing to guess).
  keyHash: text("key_hash").notNull().unique(),
  // The first few characters of the key, only so an admin can tell keys
  // apart ("sck_AbCd…"). Not enough to use the key.
  keyPrefix: text("key_prefix").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
});

// Which sites a customer may read. A new site is NOT visible to anyone until
// it's added here — access is an explicit allow-list.
export const customerSites = pgTable(
  "customer_sites",
  {
    customerId: integer("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "cascade" }),
    siteId: integer("site_id")
      .notNull()
      .references(() => sites.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.customerId, t.siteId] })],
);
