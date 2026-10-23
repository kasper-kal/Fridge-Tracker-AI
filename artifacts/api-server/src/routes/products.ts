import { Router } from "express";
import { db, productsTable } from "@workspace/db";
import { eq, sql, and, isNull, isNotNull, desc } from "drizzle-orm";
import {
  ListProductsQueryParams,
  CreateProductBody,
  UpdateProductParams,
  UpdateProductBody,
  DeleteProductParams,
} from "@workspace/api-zod";

const router = Router();

function mapProduct(p: typeof productsTable.$inferSelect) {
  return {
    id: p.id,
    name: p.name,
    quantity: p.quantity,
    unit: p.unit,
    storageLocation: p.storageLocation,
    createdAt: p.createdAt.toISOString(),
    deletedAt: p.deletedAt ? p.deletedAt.toISOString() : null,
  };
}

/** A list is one household's products, or the ungrouped ones. */
function listScope(householdId: number | undefined) {
  return householdId
    ? eq(productsTable.householdId, householdId)
    : isNull(productsTable.householdId);
}

// GET /products
router.get("/", async (req, res) => {
  try {
    const query = ListProductsQueryParams.safeParse(req.query);
    const location = query.success ? query.data.location : undefined;
    const householdId = req.query.householdId ? Number(req.query.householdId) : undefined;

    const conditions = [listScope(householdId), isNull(productsTable.deletedAt)];
    if (location) conditions.push(eq(productsTable.storageLocation, location));

    const products = await db
      .select()
      .from(productsTable)
      .where(and(...conditions));

    res.json(products.map(mapProduct));
  } catch {
    res.status(500).json({ error: "Failed to fetch products" });
  }
});

// POST /products
router.post("/", async (req, res) => {
  try {
    const body = CreateProductBody.safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ error: "Invalid input", details: body.error.issues });
      return;
    }
    const householdId = req.query.householdId ? Number(req.query.householdId) : undefined;

    const [product] = await db
      .insert(productsTable)
      .values({
        name: body.data.name,
        quantity: body.data.quantity,
        unit: body.data.unit,
        storageLocation: body.data.storageLocation,
        householdId: householdId ?? null,
      })
      .returning();

    res.status(201).json(mapProduct(product));
  } catch {
    res.status(500).json({ error: "Failed to create product" });
  }
});

// PATCH /products/:id
router.patch("/:id", async (req, res) => {
  try {
    const params = UpdateProductParams.safeParse({ id: Number(req.params.id) });
    if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }

    const body = UpdateProductBody.safeParse(req.body);
    if (!body.success) { res.status(400).json({ error: "Invalid input", details: body.error.issues }); return; }

    const updates: Record<string, unknown> = {};
    if (body.data.name !== undefined) updates.name = body.data.name;
    if (body.data.quantity !== undefined) updates.quantity = body.data.quantity;
    if (body.data.unit !== undefined) updates.unit = body.data.unit;
    if (body.data.storageLocation !== undefined) updates.storageLocation = body.data.storageLocation;

    const [product] = await db
      .update(productsTable)
      .set(updates)
      .where(eq(productsTable.id, params.data.id))
      .returning();

    if (!product) { res.status(404).json({ error: "Product not found" }); return; }
    res.json(mapProduct(product));
  } catch {
    res.status(500).json({ error: "Failed to update product" });
  }
});

// DELETE /products/:id
// Marks the row instead of removing it, so it can still be found on the
// Verwijderd page and put back from there.
router.delete("/:id", async (req, res) => {
  try {
    const params = DeleteProductParams.safeParse({ id: Number(req.params.id) });
    if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }
    await db
      .update(productsTable)
      .set({ deletedAt: new Date() })
      .where(and(eq(productsTable.id, params.data.id), isNull(productsTable.deletedAt)));
    res.status(204).send();
  } catch {
    res.status(500).json({ error: "Failed to delete product" });
  }
});

// DELETE /products/:id/permanent
// Skips the Verwijderd page and removes the row for good. The audits use it so
// their seeded rows cannot pile up in the owner's list.
router.delete("/:id/permanent", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) { res.status(400).json({ error: "Invalid id" }); return; }
    await db.delete(productsTable).where(eq(productsTable.id, id));
    res.status(204).send();
  } catch {
    res.status(500).json({ error: "Failed to remove product" });
  }
});

// GET /products/deleted
// Newest deletion first. Scoped like the normal list: a household sees its own
// deleted products, and ungrouped devices see the ungrouped ones.
router.get("/deleted", async (req, res) => {
  try {
    const householdId = req.query.householdId ? Number(req.query.householdId) : undefined;
    const products = await db
      .select()
      .from(productsTable)
      .where(and(listScope(householdId), isNotNull(productsTable.deletedAt)))
      .orderBy(desc(productsTable.deletedAt));
    res.json(products.map(mapProduct));
  } catch {
    res.status(500).json({ error: "Failed to fetch deleted products" });
  }
});

// POST /products/:id/restore
router.post("/:id/restore", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) { res.status(400).json({ error: "Invalid id" }); return; }
    const [product] = await db
      .update(productsTable)
      .set({ deletedAt: null })
      .where(and(eq(productsTable.id, id), isNotNull(productsTable.deletedAt)))
      .returning();
    if (!product) { res.status(404).json({ error: "Product not found" }); return; }
    res.json(mapProduct(product));
  } catch {
    res.status(500).json({ error: "Failed to restore product" });
  }
});

// GET /products/summary
router.get("/summary", async (req, res) => {
  try {
    const householdId = req.query.householdId ? Number(req.query.householdId) : undefined;
    const rows = await db
      .select({
        location: productsTable.storageLocation,
        count: sql<number>`count(*)::int`,
      })
      .from(productsTable)
      .where(and(listScope(householdId), isNull(productsTable.deletedAt)))
      .groupBy(productsTable.storageLocation);

    const fridge = rows.find((r) => r.location === "fridge")?.count ?? 0;
    const freezer = rows.find((r) => r.location === "freezer")?.count ?? 0;
    const pantry = rows.find((r) => r.location === "pantry")?.count ?? 0;
    res.json({ fridge, freezer, pantry, total: fridge + freezer + pantry });
  } catch {
    res.status(500).json({ error: "Failed to fetch summary" });
  }
});

export default router;
