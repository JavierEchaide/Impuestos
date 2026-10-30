import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

/**
 * Crea un cliente Drizzle sobre un pool de `pg`. Sin `server-only` para poder
 * usarlo desde scripts (migraciones, seed) y tests.
 */
export function createDb(connectionString: string, options: { max?: number } = {}) {
  const pool = new Pool({
    connectionString,
    max: options.max ?? 5,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 10_000,
  });
  const db = drizzle(pool, { schema });
  return { db, pool };
}

export type Db = ReturnType<typeof createDb>["db"];
export { schema };
