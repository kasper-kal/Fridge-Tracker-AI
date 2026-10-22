import { Router } from "express";
import { db } from "@workspace/db";
import { householdsTable, usersTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { createHash } from "crypto";
import { isAppAdmin, requireAdmin } from "../middlewares/admin";

const router = Router();

function hashPin(pin: string) {
  return createHash("sha256").update(pin.trim()).digest("hex");
}

function parseBody(body: unknown): { name: string; pin: string; deviceId?: string } | null {
  if (!body || typeof body !== "object") return null;
  const { name, pin, deviceId } = body as Record<string, unknown>;
  if (typeof name !== "string" || !name.trim()) return null;
  if (typeof pin !== "string" || !pin.trim()) return null;
  if (name.length > 64 || pin.length > 32) return null;
  return {
    name: name.trim(),
    pin: pin.trim(),
    deviceId: typeof deviceId === "string" ? deviceId.trim() : undefined,
  };
}

/**
 * Sharing is the one thing a guest profile cannot do. Returns an error message
 * when the caller has a profile but never chose a name.
 */
async function guestBlockReason(deviceId?: string): Promise<string | null> {
  if (!deviceId) return null;
  const [row] = await db
    .select({ username: usersTable.username })
    .from(usersTable)
    .where(eq(usersTable.deviceId, deviceId))
    .limit(1);
  if (row && !row.username.trim()) {
    return "Stel eerst een gebruikersnaam in voordat je een huishouden deelt";
  }
  return null;
}

// GET /households — list all (admin)
router.get("/", requireAdmin, async (_req, res) => {
  try {
    const all = await db
      .select({ id: householdsTable.id, name: householdsTable.name, createdAt: householdsTable.createdAt, creatorDeviceId: householdsTable.creatorDeviceId })
      .from(householdsTable)
      .orderBy(householdsTable.createdAt);
    res.json(all);
  } catch {
    res.status(500).json({ error: "Ophalen mislukt" });
  }
});

// POST /households — create
router.post("/", async (req, res) => {
  try {
    const body = parseBody(req.body);
    if (!body) { res.status(400).json({ error: "Ongeldige invoer" }); return; }

    const blocked = await guestBlockReason(body.deviceId);
    if (blocked) { res.status(403).json({ error: blocked }); return; }

    const existing = await db
      .select()
      .from(householdsTable)
      .where(eq(householdsTable.name, body.name))
      .limit(1);

    if (existing.length > 0) {
      res.status(409).json({ error: "Er bestaat al een huishouden met deze naam" });
      return;
    }

    const [household] = await db
      .insert(householdsTable)
      .values({ name: body.name, pinHash: hashPin(body.pin), creatorDeviceId: body.deviceId ?? null })
      .returning();
    if (body.deviceId) {
      await db
        .update(usersTable)
        .set({ householdId: household.id })
        .where(eq(usersTable.deviceId, body.deviceId));
    }

    res.status(201).json({ id: household.id, name: household.name, isCreator: true });
  } catch {
    res.status(500).json({ error: "Aanmaken mislukt" });
  }
});

// POST /households/join — join by name + pin
router.post("/join", async (req, res) => {
  try {
    const body = parseBody(req.body);
    if (!body) { res.status(400).json({ error: "Ongeldige invoer" }); return; }

    const blocked = await guestBlockReason(body.deviceId);
    if (blocked) { res.status(403).json({ error: blocked }); return; }

    const [household] = await db
      .select()
      .from(householdsTable)
      .where(and(eq(householdsTable.name, body.name), eq(householdsTable.pinHash, hashPin(body.pin))))
      .limit(1);

    if (!household) {
      res.status(404).json({ error: "Naam of pincode onjuist" });
      return;
    }

    if (body.deviceId) {
      await db
        .update(usersTable)
        .set({ householdId: household.id })
        .where(eq(usersTable.deviceId, body.deviceId));
    }
    const isCreator = !!body.deviceId && household.creatorDeviceId === body.deviceId;
    res.json({ id: household.id, name: household.name, isCreator });
  } catch {
    res.status(500).json({ error: "Inloggen mislukt" });
  }
});

// DELETE /households/:id
router.delete("/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) { res.status(400).json({ error: "Ongeldig id" }); return; }

    const deviceId = req.headers["x-device-id"] as string | undefined;

    const [household] = await db.select().from(householdsTable).where(eq(householdsTable.id, id)).limit(1);
    if (!household) { res.status(404).json({ error: "Niet gevonden" }); return; }

    const isAdmin = await isAppAdmin(req);
    if (!isAdmin && household.creatorDeviceId !== deviceId) {
      res.status(403).json({ error: "Alleen de maker kan dit huishouden verwijderen" });
      return;
    }

    await db.transaction(async (tx) => {
      await tx
        .update(usersTable)
        .set({ householdId: null })
        .where(eq(usersTable.householdId, id));
      await tx.delete(householdsTable).where(eq(householdsTable.id, id));
    });
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "Verwijderen mislukt" });
  }
});

export default router;
