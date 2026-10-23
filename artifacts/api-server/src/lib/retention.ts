import { db, productsTable } from "@workspace/db";
import { and, isNotNull, lt } from "drizzle-orm";
import { logger } from "./logger";

/**
 * How long a product stays on the Verwijderd page before it is removed for
 * good. Deleting only marks the row, so this is what keeps the table from
 * growing forever.
 */
export const DELETION_RETENTION_DAYS = 7;

const DAY_MS = 24 * 60 * 60 * 1000;
const SWEEP_INTERVAL_MS = 60 * 60 * 1000;

/** Removes every product whose deletion is older than the retention window. */
export async function purgeExpiredDeletedProducts(): Promise<number> {
  const cutoff = new Date(Date.now() - DELETION_RETENTION_DAYS * DAY_MS);
  try {
    const removed = await db
      .delete(productsTable)
      .where(and(isNotNull(productsTable.deletedAt), lt(productsTable.deletedAt, cutoff)))
      .returning({ id: productsTable.id });
    if (removed.length > 0) {
      logger.info({ count: removed.length, cutoff }, "Removed expired deleted products");
    }
    return removed.length;
  } catch (err) {
    logger.error({ err }, "Deletion retention sweep failed");
    return 0;
  }
}

/**
 * Runs the sweep once at startup and then hourly. The timer is unref'd so it
 * never keeps the process alive on its own.
 */
export function startDeletionRetention(): NodeJS.Timeout {
  void purgeExpiredDeletedProducts();
  const timer = setInterval(() => {
    void purgeExpiredDeletedProducts();
  }, SWEEP_INTERVAL_MS);
  timer.unref();
  return timer;
}
