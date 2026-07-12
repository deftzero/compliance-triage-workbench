import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { env } from "../config/env.js";
import * as schema from "./schema.js";

export type Db = ReturnType<typeof createDb>;

function createDb() {
  if (!env.DATABASE_URL) {
    // envSchema already refines this, so reaching here means the module was
    // imported outside of PERSISTENCE=database.
    throw new Error("DATABASE_URL is required to create a database client");
  }
  const pool = new Pool({ connectionString: env.DATABASE_URL });
  return drizzle(pool, { schema });
}

let db: Db | undefined;

/** Single lazily-created pool — nothing connects until the first call. */
export function getDb(): Db {
  db ??= createDb();
  return db;
}
