import { pgTable, serial, text, boolean, timestamp, integer } from "drizzle-orm/pg-core";

export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  deviceId: text("device_id").notNull().unique(),
  clerkUserId: text("clerk_user_id").unique(),
  username: text("username").notNull(),
  householdId: integer("household_id"),
  isBanned: boolean("is_banned").notNull().default(false),
  ipAddress: text("ip_address"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type User = typeof usersTable.$inferSelect;
