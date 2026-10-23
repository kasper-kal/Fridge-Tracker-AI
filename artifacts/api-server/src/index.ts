import app from "./app";
import { logger } from "./lib/logger";
import { startDeletionRetention } from "./lib/retention";
import { pool } from "@workspace/db";

// Every statement stands on its own: one failure (an older table missing a
// column, say) must not silently skip the rest of the schema, which is how a
// fresh database ended up with no tables at all and every request a 500.
const MIGRATIONS = [
  `CREATE TABLE IF NOT EXISTS products (
     id SERIAL PRIMARY KEY,
     name TEXT NOT NULL,
     quantity REAL NOT NULL DEFAULT 1,
     unit TEXT NOT NULL DEFAULT 'pcs',
     storage_location TEXT NOT NULL,
     household_id INTEGER,
     created_at TIMESTAMP DEFAULT NOW() NOT NULL
   )`,
  `CREATE TABLE IF NOT EXISTS households (
     id SERIAL PRIMARY KEY,
     name TEXT NOT NULL,
     pin_hash TEXT NOT NULL,
     creator_device_id TEXT,
     created_at TIMESTAMP DEFAULT NOW() NOT NULL
   )`,
  `CREATE TABLE IF NOT EXISTS users (
     id SERIAL PRIMARY KEY,
     device_id TEXT NOT NULL UNIQUE,
     clerk_user_id TEXT UNIQUE,
     username TEXT NOT NULL,
     household_id INTEGER,
     is_banned BOOLEAN NOT NULL DEFAULT FALSE,
     ip_address TEXT,
     created_at TIMESTAMP DEFAULT NOW() NOT NULL
   )`,
  `CREATE TABLE IF NOT EXISTS app_settings (
     id SERIAL PRIMARY KEY,
     key TEXT NOT NULL UNIQUE,
     value TEXT NOT NULL,
     updated_at TIMESTAMP DEFAULT NOW() NOT NULL
   )`,
  `CREATE TABLE IF NOT EXISTS household_shopping_items (
     id SERIAL PRIMARY KEY,
     household_id INTEGER NOT NULL,
     name TEXT NOT NULL,
     checked BOOLEAN NOT NULL DEFAULT FALSE,
     created_at TIMESTAMP DEFAULT NOW() NOT NULL
   )`,
  // Columns added after the first release, for databases created before them.
  `ALTER TABLE households ADD COLUMN IF NOT EXISTS creator_device_id TEXT`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS ip_address TEXT`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS clerk_user_id TEXT UNIQUE`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS household_id INTEGER`,
];

async function runMigrations() {
  const client = await pool.connect();
  try {
    for (const statement of MIGRATIONS) {
      try {
        await client.query(statement);
      } catch (err) {
        logger.error({ err, statement: statement.split("\n")[0] }, "Migration statement failed");
      }
    }
    logger.info("Migrations applied");
  } finally {
    client.release();
  }
}

const rawPort = process.env["PORT"];
const port = rawPort ? Number(rawPort) : 10000;

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

runMigrations().then(() => {
  app.listen(port, (err) => {
    if (err) {
      logger.error({ err }, "Error listening on port");
      process.exit(1);
    }
    logger.info({ port }, "Server listening");
    // Deleting only marks a product, so something has to clear out the ones
    // that have been on the Verwijderd page for longer than a week.
    startDeletionRetention();
  });
});
