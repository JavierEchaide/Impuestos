import "server-only";
import { createDb, type Db } from "./client";

export * from "./schema";
export type { Db };

const globalForDb = globalThis as unknown as { __cuentasDb?: ReturnType<typeof createDb> };

function getDb() {
  if (!globalForDb.__cuentasDb) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("Falta la variable de entorno DATABASE_URL.");
    globalForDb.__cuentasDb = createDb(url);
  }
  return globalForDb.__cuentasDb;
}

/** Cliente Drizzle compartido (singleton por proceso, perezoso). */
export const db: Db = new Proxy({} as Db, {
  get(_target, prop, receiver) {
    return Reflect.get(getDb().db, prop, receiver);
  },
});
