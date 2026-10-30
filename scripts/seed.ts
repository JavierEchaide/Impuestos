/**
 * Seed: crea los 5 perfiles y la sección de ejemplo "Arepas casa Javi".
 *
 * - Es idempotente: no toca usuarios que ya existen ni duplica la sección.
 * - Genera una contraseña temporal aleatoria por usuario NUEVO y la muestra UNA
 *   sola vez en la terminal. No se guarda en ningún fichero ni en la BD (solo su hash).
 * - Cada usuario nuevo debe cambiarla en su primer inicio de sesión.
 *
 * Uso: npm run db:seed   (lee DATABASE_URL del entorno / .env)
 */
import { config as loadEnv } from "dotenv";

// .env.local es lo que genera `vercel env pull`; .env es el archivo local de siempre.
loadEnv({ path: [".env.local", ".env"], quiet: true });
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { createAuth } from "../src/lib/auth/config";
import { generateTempPassword } from "../src/lib/auth/passwords";
import { createDb } from "../src/lib/db/client";
import { activityLog, expenseSplits, expenses, sections, user } from "../src/lib/db/schema";

const PROFILES = [
  { name: "Javi", username: "javi", role: "admin", color: "#d79921" },
  { name: "Cristian", username: "cristian", role: "member", color: "#458588" },
  { name: "Amy", username: "amy", role: "member", color: "#b16286" },
  { name: "Paula", username: "paula", role: "member", color: "#689d6a" },
  { name: "Pablo", username: "pablo", role: "member", color: "#cc241d" },
] as const;

/** Sección de ejemplo pedida: Javi es el receptor y los otros cuatro pagan 4,50 € cada uno. */
const EXAMPLE_SECTION = {
  name: "Arepas casa Javi",
  title: "Arepas",
  creditor: "javi",
  amountCents: 450,
  debtors: ["cristian", "amy", "paula", "pablo"],
} as const;

async function main() {
  const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
  if (!url) {
    console.error("Falta DATABASE_URL (o DATABASE_URL_UNPOOLED).");
    process.exit(1);
  }
  const { db, pool } = createDb(url, { max: 2 });
  const auth = createAuth(db, { nextCookies: false });

  const created: { name: string; username: string; password: string }[] = [];
  const skipped: string[] = [];

  try {
    for (const profile of PROFILES) {
      const [existing] = await db.select({ id: user.id }).from(user).where(eq(user.username, profile.username)).limit(1);
      if (existing) {
        skipped.push(profile.username);
        continue;
      }
      const password = generateTempPassword();
      await auth.api.createUser({
        body: {
          email: `${profile.username}@cuentas-claras.local`,
          password,
          name: profile.name,
          data: {
            role: profile.role,
            username: profile.username,
            color: profile.color,
            mustChangePassword: true,
          },
        },
      });
      created.push({ name: profile.name, username: profile.username, password });
    }

    const users = await db.select().from(user);
    const byUsername = new Map(users.map((u) => [u.username, u]));
    const creditor = byUsername.get(EXAMPLE_SECTION.creditor);

    const [existingSection] = await db.select().from(sections).where(eq(sections.name, EXAMPLE_SECTION.name)).limit(1);
    let exampleCreated = false;
    if (!existingSection && creditor) {
      const sectionId = randomUUID();
      const today = new Date().toISOString().slice(0, 10);
      await db.transaction(async (tx) => {
        await tx.insert(sections).values({ id: sectionId, name: EXAMPLE_SECTION.name, createdBy: creditor.id });
        for (const debtorName of EXAMPLE_SECTION.debtors) {
          const debtor = byUsername.get(debtorName);
          if (!debtor) continue;
          const expenseId = randomUUID();
          await tx.insert(expenses).values({
            id: expenseId,
            sectionId,
            title: EXAMPLE_SECTION.title,
            amountCents: EXAMPLE_SECTION.amountCents,
            expenseDate: today,
            category: "deuda_inicial",
            paidBy: creditor.id,
            splitType: "exact",
            createdBy: creditor.id,
          });
          await tx.insert(expenseSplits).values({
            expenseId,
            userId: debtor.id,
            amountCents: EXAMPLE_SECTION.amountCents,
            weight: EXAMPLE_SECTION.amountCents,
          });
          await tx.insert(activityLog).values({
            id: randomUUID(),
            actorId: creditor.id,
            action: "created",
            entityType: "expense",
            entityId: expenseId,
            sectionId,
            summary: `Deuda inicial «${EXAMPLE_SECTION.title}»: ${debtor.name} debe 4,50 € a ${creditor.name} en ${EXAMPLE_SECTION.name}`,
          });
        }
      });
      exampleCreated = true;
    }

    console.log("\n=== Seed completado ===");
    console.log(`Usuarios nuevos: ${created.length} · ya existían: ${skipped.length ? skipped.join(", ") : "ninguno"}`);
    console.log(
      `Sección «${EXAMPLE_SECTION.name}»: ${exampleCreated ? "creada" : existingSection ? "ya existía" : "no creada (falta Javi)"}`,
    );

    if (created.length > 0) {
      console.log("\nCONTRASEÑAS TEMPORALES (se muestran UNA sola vez; cada persona debe cambiarla al entrar):\n");
      const width = Math.max(...created.map((c) => c.username.length)) + 2;
      for (const c of created) {
        console.log(`  ${c.username.padEnd(width)} ${c.password}   (${c.name})`);
      }
      console.log("\nGuárdalas ahora: no se pueden volver a ver. Si se pierde una, el admin puede restablecerla.\n");
    }
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error("Error en el seed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
