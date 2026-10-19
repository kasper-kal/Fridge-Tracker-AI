import { Router } from "express";
import { db } from "@workspace/db";
import { householdsTable, usersTable } from "@workspace/db";
import { DeleteCurrentUserHeader } from "@workspace/api-zod";
import { eq } from "drizzle-orm";

const router = Router();

function getClientIp(req: import("express").Request): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (forwarded) {
    const first = Array.isArray(forwarded) ? forwarded[0] : forwarded.split(",")[0];
    return first.trim();
  }
  return req.socket?.remoteAddress ?? req.ip ?? "onbekend";
}

// GET /users — list all
router.get("/", async (_req, res) => {
  try {
    const users = await db.select().from(usersTable).orderBy(usersTable.createdAt);
    res.json(users);
  } catch {
    res.status(500).json({ error: "Ophalen mislukt" });
  }
});

// POST /users — register or get existing (also refreshes IP)
router.post("/", async (req, res) => {
  try {
    const { deviceId, username } = req.body ?? {};
    if (!deviceId || typeof deviceId !== "string" || deviceId.length > 128) {
      res.status(400).json({ error: "Ongeldige invoer" });
      return;
    }

    const ip = getClientIp(req);
    const existing = await db.select().from(usersTable).where(eq(usersTable.deviceId, deviceId)).limit(1);

    if (existing.length > 0) {
      // Refresh IP on each login
      const [updated] = await db
        .update(usersTable)
        .set({ ipAddress: ip })
        .where(eq(usersTable.deviceId, deviceId))
        .returning();
      res.json(updated);
      return;
    }

    if (!username || typeof username !== "string" || !username.trim()) {
      res.status(400).json({ error: "Gebruikersnaam vereist" });
      return;
    }

    const [user] = await db
      .insert(usersTable)
      .values({ deviceId: deviceId.trim(), username: username.trim().slice(0, 32), ipAddress: ip })
      .returning();

    res.status(201).json(user);
  } catch {
    res.status(500).json({ error: "Registratie mislukt" });
  }
});

// PATCH /users/me — update own username
router.patch("/me", async (req, res) => {
  try {
    const deviceId = req.headers["x-device-id"] as string | undefined;
    const { username } = req.body ?? {};
    if (!deviceId || !username || typeof username !== "string" || !username.trim()) {
      res.status(400).json({ error: "Ongeldige invoer" }); return;
    }
    const [updated] = await db
      .update(usersTable)
      .set({ username: username.trim().slice(0, 32) })
      .where(eq(usersTable.deviceId, deviceId))
      .returning();
    if (!updated) { res.status(404).json({ error: "Gebruiker niet gevonden" }); return; }
    res.json(updated);
  } catch {
    res.status(500).json({ error: "Bijwerken mislukt" });
  }
});

// DELETE /users/me — remove this device profile without deleting shared inventory
router.delete("/me", async (req, res) => {
  const parsedHeader = DeleteCurrentUserHeader.safeParse({
    "x-device-id": req.headers["x-device-id"],
  });
  if (!parsedHeader.success) {
    res.status(400).json({ error: "Ongeldig apparaat-ID" });
    return;
  }

  const deviceId = parsedHeader.data["x-device-id"];
  try {
    await db.transaction(async (tx) => {
      await tx
        .update(householdsTable)
        .set({ creatorDeviceId: null })
        .where(eq(householdsTable.creatorDeviceId, deviceId));
      await tx.delete(usersTable).where(eq(usersTable.deviceId, deviceId));
    });
    res.status(204).send();
  } catch {
    res.status(500).json({ error: "Resetten mislukt" });
  }
});

// POST /users/:id/ban — toggle ban
router.post("/:id/ban", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) { res.status(400).json({ error: "Ongeldig id" }); return; }

    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, id)).limit(1);
    if (!user) { res.status(404).json({ error: "Gebruiker niet gevonden" }); return; }

    const [updated] = await db
      .update(usersTable)
      .set({ isBanned: !user.isBanned })
      .where(eq(usersTable.id, id))
      .returning();

    res.json(updated);
  } catch {
    res.status(500).json({ error: "Bijwerken mislukt" });
  }
});

export default router;
