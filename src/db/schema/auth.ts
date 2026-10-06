import { pgTable, pgEnum, serial, integer, text, timestamp } from "drizzle-orm/pg-core";

// admin: can open Setup (sites, API keys, users). viewer: dashboards only —
// the role to hand out to a customer.
export const userRoleEnum = pgEnum("user_role", ["admin", "viewer"]);

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  // Stored lowercase, so "Alex" and "alex" are the same account.
  username: text("username").notNull().unique(),
  // "scrypt$<salt hex>$<hash hex>" — see src/lib/password.ts.
  passwordHash: text("password_hash").notNull(),
  role: userRoleEnum("role").notNull().default("viewer"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
});

// One row per signed-in browser. `id` is the SHA-256 of the random token in
// the user's cookie, never the token itself, so a leaked copy of this table
// can't be used to sign in as anyone.
export const sessions = pgTable("sessions", {
  id: text("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});
