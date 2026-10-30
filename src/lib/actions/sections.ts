"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db, sections } from "@/lib/db";
import { isAdmin, requireUser } from "@/lib/auth/session";
import { sectionArchiveSchema, sectionSchema, sectionUpdateSchema } from "@/lib/validation/schemas";
import { ActionError, guard, logActivity, newId, zodFail, type ActionResult } from "./shared";

/** Cualquier miembro puede crear una sección (cuenta con nombre dentro del grupo). */
export async function createSectionAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  return guard(async () => {
    const actor = await requireUser();
    const parsed = sectionSchema.safeParse(input);
    if (!parsed.success) return zodFail(parsed.error);

    const id = newId();
    await db.transaction(async (tx) => {
      await tx.insert(sections).values({
        id,
        name: parsed.data.name,
        description: parsed.data.description ?? null,
        createdBy: actor.id,
      });
      await logActivity(tx, {
        actorId: actor.id,
        action: "created",
        entityType: "section",
        entityId: id,
        sectionId: id,
        summary: `${actor.name} creó la sección «${parsed.data.name}»`,
      });
    });

    revalidatePath("/", "layout");
    return { ok: true as const, id };
  });
}

async function loadEditableSection(actor: { id: string; role: "admin" | "member" }, id: string) {
  const [section] = await db.select().from(sections).where(eq(sections.id, id)).limit(1);
  if (!section) throw new ActionError("La sección no existe.");
  if (section.createdBy !== actor.id && !isAdmin(actor)) {
    throw new ActionError("Solo quien creó la sección o el administrador puede modificarla.");
  }
  return section;
}

export async function updateSectionAction(input: unknown): Promise<ActionResult> {
  return guard(async () => {
    const actor = await requireUser();
    const parsed = sectionUpdateSchema.safeParse(input);
    if (!parsed.success) return zodFail(parsed.error);

    const section = await loadEditableSection(actor, parsed.data.id);

    await db.transaction(async (tx) => {
      await tx
        .update(sections)
        .set({
          name: parsed.data.name,
          description: parsed.data.description ?? null,
          updatedAt: new Date(),
        })
        .where(eq(sections.id, section.id));
      await logActivity(tx, {
        actorId: actor.id,
        action: "updated",
        entityType: "section",
        entityId: section.id,
        sectionId: section.id,
        summary: `${actor.name} editó la sección «${parsed.data.name}»`,
        details: {
          before: { name: section.name, description: section.description },
          after: { name: parsed.data.name, description: parsed.data.description ?? null },
        },
      });
    });

    revalidatePath("/", "layout");
    return { ok: true as const };
  });
}

/** Archivar oculta la sección de las listas y bloquea nuevos movimientos; nada se borra. */
export async function setSectionArchivedAction(input: unknown): Promise<ActionResult> {
  return guard(async () => {
    const actor = await requireUser();
    const parsed = sectionArchiveSchema.safeParse(input);
    if (!parsed.success) return zodFail(parsed.error);

    const section = await loadEditableSection(actor, parsed.data.id);

    await db.transaction(async (tx) => {
      await tx
        .update(sections)
        .set({ archivedAt: parsed.data.archived ? new Date() : null, updatedAt: new Date() })
        .where(eq(sections.id, section.id));
      await logActivity(tx, {
        actorId: actor.id,
        action: parsed.data.archived ? "archived" : "unarchived",
        entityType: "section",
        entityId: section.id,
        sectionId: section.id,
        summary: `${actor.name} ${parsed.data.archived ? "archivó" : "desarchivó"} la sección «${section.name}»`,
      });
    });

    revalidatePath("/", "layout");
    return { ok: true as const };
  });
}
