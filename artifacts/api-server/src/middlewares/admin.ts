import { clerkClient, getAuth } from "@clerk/express";
import type { NextFunction, Request, Response } from "express";

export async function isAppAdmin(req: Request): Promise<boolean> {
  const userId = getAuth(req).userId;
  if (!userId) return false;

  const allowedEmails = new Set(
    (process.env.ADMIN_EMAILS ?? "")
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  );
  if (allowedEmails.size === 0) return false;

  try {
    const user = await clerkClient.users.getUser(userId);
    return user.emailAddresses.some(
      (email) =>
        email.verification?.status === "verified" &&
        allowedEmails.has(email.emailAddress.toLowerCase()),
    );
  } catch {
    return false;
  }
}

export async function requireAdmin(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  if (!(await isAppAdmin(req))) {
    res.status(403).json({ error: "Alleen ontwikkelaars hebben toegang" });
    return;
  }
  next();
}
