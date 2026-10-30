import "server-only";
import { eq, inArray } from "drizzle-orm";
import { db, sections, user } from "@/lib/db";
import { formatEuros } from "@/lib/money";
import { ActionError } from "./shared";

/** Mapa id -> nombre de los usuarios activos indicados; falla si alguno no existe o está desactivado. */
export async function activeUserNames(ids: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(ids)];
  const rows = await db
    .select({ id: user.id, name: user.name, banned: user.banned })
    .from(user)
    .where(inArray(user.id, unique));
  const found = new Map(rows.map((r) => [r.id, r]));
  for (const id of unique) {
    const row = found.get(id);
    if (!row) throw new ActionError("Una de las personas elegidas no existe.");
    if (row.banned) throw new ActionError(`${row.name} está desactivado y no puede participar.`);
  }
  return new Map(rows.map((r) => [r.id, r.name]));
}

export async function userName(id: string): Promise<string> {
  const [row] = await db.select({ name: user.name }).from(user).where(eq(user.id, id)).limit(1);
  return row?.name ?? "Alguien";
}

/** Sección existente y no archivada. */
export async function getActiveSection(id: string) {
  const [row] = await db.select().from(sections).where(eq(sections.id, id)).limit(1);
  if (!row) throw new ActionError("La sección no existe.");
  if (row.archivedAt) throw new ActionError("La sección está archivada. Desarchívala para añadir movimientos.");
  return row;
}

export function money(cents: number): string {
  return formatEuros(cents).replace(/ /g, " ");
}
