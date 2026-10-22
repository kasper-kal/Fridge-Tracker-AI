import { Router } from "express";
import { db, productsTable } from "@workspace/db";
import { eq, sql, and, isNull } from "drizzle-orm";
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
  };
}

// GET /products
router.get("/", async (req, res) => {
  try {
    const query = ListProductsQueryParams.safeParse(req.query);
    const location = query.success ? query.data.location : undefined;
    const householdId = req.query.householdId ? Number(req.query.householdId) : undefined;

    const conditions = [];
    if (location) conditions.push(eq(productsTable.storageLocation, location));
    if (householdId) {
      conditions.push(eq(productsTable.householdId, householdId));
    } else {
      conditions.push(isNull(productsTable.householdId));
    }

    const products = await db
      .select()
      .from(productsTable)
      .where(conditions.length === 1 ? conditions[0] : and(...conditions));

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
router.delete("/:id", async (req, res) => {
  try {
    const params = DeleteProductParams.safeParse({ id: Number(req.params.id) });
    if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }
    await db.delete(productsTable).where(eq(productsTable.id, params.data.id));
    res.status(204).send();
  } catch {
    res.status(500).json({ error: "Failed to delete product" });
  }
});

// GET /products/summary
router.get("/summary", async (req, res) => {
  try {
    const householdId = req.query.householdId ? Number(req.query.householdId) : undefined;
    const condition = householdId
      ? eq(productsTable.householdId, householdId)
      : isNull(productsTable.householdId);

    const rows = await db
      .select({
        location: productsTable.storageLocation,
        count: sql<number>`count(*)::int`,
      })
      .from(productsTable)
      .where(condition)
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
