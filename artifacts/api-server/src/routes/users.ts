import { Router } from "express";
import { db } from "@workspace/db";
import { householdsTable, usersTable } from "@workspace/db";
import {
  DeleteCurrentUserHeader,
  GetCurrentUserHeader,
  UpdateCurrentUserBody,
  UpdateCurrentUserHeader,
} from "@workspace/api-zod";
import { clerkClient, getAuth } from "@clerk/express";
import { and, eq, isNull } from "drizzle-orm";
import { isAppAdmin, requireAdmin } from "../middlewares/admin";

const router = Router();
type UserRow = typeof usersTable.$inferSelect;

function toUserProfile(user: UserRow, householdName: string | null, householdIsCreator: boolean) {
  return {
    id: user.id,
    deviceId: user.deviceId,
    username: user.username,
    isBanned: user.isBanned,
    ipAddress: user.ipAddress,
    createdAt: user.createdAt,
    householdId: user.householdId,
    householdName,
    householdIsCreator,
  };
}

async function getUserProfile(user: UserRow) {
  if (user.householdId === null) return toUserProfile(user, null, false);
  const [household] = await db
    .select({ name: householdsTable.name, creatorDeviceId: householdsTable.creatorDeviceId })
    .from(householdsTable)
    .where(eq(householdsTable.id, user.householdId))
    .limit(1);
  return toUserProfile(
    user,
    household?.name ?? null,
    household?.creatorDeviceId === user.deviceId,
  );
}

function getClientIp(req: import("express").Request): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (forwarded) {
    const first = Array.isArray(forwarded) ? forwarded[0] : forwarded.split(",")[0];
    return first.trim();
  }
  return req.socket?.remoteAddress ?? req.ip ?? "onbekend";
}

// GET /users/admin-status — used to hide the developer menu from non-admins
router.get("/admin-status", async (req, res) => {
  res.json({ isAdmin: await isAppAdmin(req) });
});

// GET /users/me — load or link the signed-in account's app profile
router.get("/me", async (req, res) => {
  const clerkUserId = getAuth(req).userId;
  if (!clerkUserId) {
    res.status(401).json({ error: "Inloggen vereist" });
    return;
  }

  const parsedHeader = GetCurrentUserHeader.safeParse({
    "x-device-id": req.headers["x-device-id"],
  });
  if (!parsedHeader.success) {
    res.status(400).json({ error: "Ongeldig apparaat-ID" });
    return;
  }

  try {
    let [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.clerkUserId, clerkUserId))
      .limit(1);

    if (!user && parsedHeader.data["x-device-id"]) {
      const [deviceProfile] = await db
        .select()
        .from(usersTable)
        .where(eq(usersTable.deviceId, parsedHeader.data["x-device-id"]))
        .limit(1);

      if (deviceProfile?.clerkUserId && deviceProfile.clerkUserId !== clerkUserId) {
        res.status(409).json({ error: "Dit apparaatprofiel is aan een ander account gekoppeld" });
        return;
      }

      if (deviceProfile?.clerkUserId === clerkUserId) {
        user = deviceProfile;
      } else if (deviceProfile && !deviceProfile.clerkUserId) {
        [user] = await db
          .update(usersTable)
          .set({ clerkUserId })
          .where(and(eq(usersTable.id, deviceProfile.id), isNull(usersTable.clerkUserId)))
          .returning();
      }
    }

    if (!user) {
      res.status(404).json({ error: "Geen profiel gekoppeld aan dit account" });
      return;
    }
    res.json(await getUserProfile(user));
  } catch {
    res.status(500).json({ error: "Profiel ophalen mislukt" });
  }
});

// GET /users — list all (developer only)
router.get("/", requireAdmin, async (_req, res) => {
  try {
    const users = await db
      .select({
        id: usersTable.id,
        deviceId: usersTable.deviceId,
        username: usersTable.username,
        isBanned: usersTable.isBanned,
        ipAddress: usersTable.ipAddress,
        createdAt: usersTable.createdAt,
      })
      .from(usersTable)
      .orderBy(usersTable.createdAt);
    res.json(users);
  } catch {
    res.status(500).json({ error: "Ophalen mislukt" });
  }
});

// POST /users — register or get existing (also refreshes IP)
router.post("/", async (req, res) => {
  try {
    const { deviceId, username } = req.body ?? {};
    if (!deviceId || typeof deviceId !== "string" || !deviceId.trim() || deviceId.length > 128) {
      res.status(400).json({ error: "Ongeldige invoer" });
      return;
    }

    const ip = getClientIp(req);
    const normalizedDeviceId = deviceId.trim();
    const clerkUserId = getAuth(req).userId ?? null;
    if (clerkUserId) {
      const [accountUser] = await db
        .select()
        .from(usersTable)
        .where(eq(usersTable.clerkUserId, clerkUserId))
        .limit(1);
      if (accountUser) {
        const [updated] = await db
          .update(usersTable)
          .set({ ipAddress: ip })
          .where(eq(usersTable.id, accountUser.id))
          .returning();
        res.json(await getUserProfile(updated));
        return;
      }
    }

    const existing = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.deviceId, normalizedDeviceId))
      .limit(1);

    if (existing.length > 0) {
      if (clerkUserId && existing[0].clerkUserId && existing[0].clerkUserId !== clerkUserId) {
        res.status(409).json({ error: "Dit apparaatprofiel is aan een ander account gekoppeld" });
        return;
      }
      // Refresh IP on each login
      const [updated] = await db
        .update(usersTable)
        .set({ ipAddress: ip, ...(clerkUserId ? { clerkUserId } : {}) })
        .where(eq(usersTable.deviceId, normalizedDeviceId))
        .returning();
      res.json(await getUserProfile(updated));
      return;
    }

    if (!username || typeof username !== "string" || !username.trim()) {
      res.status(400).json({ error: "Gebruikersnaam vereist" });
      return;
    }

    const [user] = await db
      .insert(usersTable)
      .values({
        deviceId: normalizedDeviceId,
        username: username.trim().slice(0, 32),
        ipAddress: ip,
        clerkUserId,
      })
      .returning();

    res.status(201).json(await getUserProfile(user));
  } catch {
    res.status(500).json({ error: "Registratie mislukt" });
  }
});

// PATCH /users/me — update own username
router.patch("/me", async (req, res) => {
  try {
    const parsedHeader = UpdateCurrentUserHeader.safeParse({
      "x-device-id": req.headers["x-device-id"],
    });
    const parsedBody = UpdateCurrentUserBody.safeParse(req.body ?? {});
    if (!parsedHeader.success || !parsedBody.success) {
      res.status(400).json({ error: "Ongeldige invoer" }); return;
    }
    const deviceId = parsedHeader.data["x-device-id"];
    const clerkUserId = getAuth(req).userId;
    const [current] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.deviceId, deviceId))
      .limit(1);
    if (current?.clerkUserId && current.clerkUserId !== clerkUserId) {
      res.status(403).json({ error: "Dit profiel hoort bij een ander account" });
      return;
    }
    const [updated] = await db
      .update(usersTable)
      .set({ username: parsedBody.data.username.trim().slice(0, 32) })
      .where(eq(usersTable.deviceId, deviceId))
      .returning();
    if (!updated) { res.status(404).json({ error: "Gebruiker niet gevonden" }); return; }
    res.json(await getUserProfile(updated));
  } catch {
    res.status(500).json({ error: "Bijwerken mislukt" });
  }
});

// DELETE /users/me/household — leave a shared household without deleting it
router.delete("/me/household", async (req, res) => {
  const parsedHeader = DeleteCurrentUserHeader.safeParse({
    "x-device-id": req.headers["x-device-id"],
  });
  if (!parsedHeader.success) {
    res.status(400).json({ error: "Ongeldig apparaat-ID" });
    return;
  }

  const deviceId = parsedHeader.data["x-device-id"];
  const clerkUserId = getAuth(req).userId;
  try {
    const [current] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.deviceId, deviceId))
      .limit(1);
    if (current?.clerkUserId && current.clerkUserId !== clerkUserId) {
      res.status(403).json({ error: "Dit profiel hoort bij een ander account" });
      return;
    }
    await db
      .update(usersTable)
      .set({ householdId: null })
      .where(eq(usersTable.deviceId, deviceId));
    res.status(204).send();
  } catch {
    res.status(500).json({ error: "Huishouden verlaten mislukt" });
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
  const clerkUserId = getAuth(req).userId;
  try {
    const [current] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.deviceId, deviceId))
      .limit(1);
    if (current?.clerkUserId && current.clerkUserId !== clerkUserId) {
      res.status(403).json({ error: "Dit profiel hoort bij een ander account" });
      return;
    }
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
router.post("/:id/ban", requireAdmin, async (req, res) => {
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

// DELETE /users/:id — permanently remove a user and their sign-in account
router.delete("/:id", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: "Ongeldig id" });
    return;
  }

  try {
    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, id))
      .limit(1);
    if (!user) {
      res.status(404).json({ error: "Gebruiker niet gevonden" });
      return;
    }

    if (user.clerkUserId) {
      try {
        await clerkClient.users.deleteUser(user.clerkUserId);
      } catch (error) {
        const clerkStatus = error as { status?: number; statusCode?: number };
        if ((clerkStatus.status ?? clerkStatus.statusCode) !== 404) throw error;
      }
    }

    await db.transaction(async (tx) => {
      await tx
        .update(householdsTable)
        .set({ creatorDeviceId: null })
        .where(eq(householdsTable.creatorDeviceId, user.deviceId));
      await tx.delete(usersTable).where(eq(usersTable.id, id));
    });
    res.status(204).send();
  } catch {
    res.status(500).json({ error: "Gebruiker verwijderen mislukt" });
  }
});

export default router;
