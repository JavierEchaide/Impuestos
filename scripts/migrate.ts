/**
 * Aplica las migraciones SQL de ./drizzle a la base de datos.
 * Uso: npm run db:migrate   (lee DATABASE_URL_UNPOOLED o DATABASE_URL del entorno / .env)
 */
import "dotenv/config";
import path from "node:path";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { createDb } from "../src/lib/db/client";

async function main() {
  const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
  if (!url) {
    console.error("Falta DATABASE_URL (o DATABASE_URL_UNPOOLED).");
    process.exit(1);
  }
  const { db, pool } = createDb(url, { max: 1 });
  try {
    await migrate(db, { migrationsFolder: path.join(process.cwd(), "drizzle") });
    console.log("Migraciones aplicadas.");
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error("Error al migrar:", error instanceof Error ? error.message : error);
  process.exit(1);
});
