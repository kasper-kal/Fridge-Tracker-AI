import { Router } from "express";
import { db } from "@workspace/db";
import { appSettingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAdmin } from "../middlewares/admin";

const router = Router();

// GET /settings
router.get("/", async (_req, res) => {
  try {
    const rows = await db.select().from(appSettingsTable);
    const result: Record<string, string> = {};
    rows.forEach((r) => { result[r.key] = r.value; });
    res.json(result);
  } catch {
    res.status(500).json({ error: "Ophalen mislukt" });
  }
});

// PUT /settings — upsert a key
router.put("/", requireAdmin, async (req, res) => {
  try {
    const { key, value } = req.body ?? {};
    if (!key || typeof key !== "string" || !value || typeof value !== "string") {
      res.status(400).json({ error: "Ongeldige invoer" }); return;
    }
    const allowed = ["primaryColor", "secondaryColor"];
    if (!allowed.includes(key)) { res.status(400).json({ error: "Ongeldige sleutel" }); return; }

    await db
      .insert(appSettingsTable)
      .values({ key, value })
      .onConflictDoUpdate({ target: appSettingsTable.key, set: { value, updatedAt: new Date() } });

    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "Opslaan mislukt" });
  }
});

export default router;
