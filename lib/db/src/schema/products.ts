import { pgTable, serial, text, real, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const productsTable = pgTable("products", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  quantity: real("quantity").notNull().default(1),
  unit: text("unit").notNull().default("pcs"),
  storageLocation: text("storage_location").notNull(),
  householdId: integer("household_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  // Deleting sets this instead of removing the row, so the product can be found
  // again on the Verwijderd page.
  deletedAt: timestamp("deleted_at"),
});

export const insertProductSchema = createInsertSchema(productsTable).omit({ id: true, createdAt: true });
export type InsertProduct = z.infer<typeof insertProductSchema>;
export type Product = typeof productsTable.$inferSelect;
