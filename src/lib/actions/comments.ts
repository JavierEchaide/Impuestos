"use server";

import { and, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { comments, db, expenses } from "@/lib/db";
import { isAdmin, requireUser } from "@/lib/auth/session";
import { commentSchema, idSchema } from "@/lib/validation/schemas";
import { fail, guard, logActivity, newId, zodFail, type ActionResult } from "./shared";

export async function addCommentAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  return guard(async () => {
    const actor = await requireUser();
    const parsed = commentSchema.safeParse(input);
    if (!parsed.success) return zodFail(parsed.error);

    const [expense] = await db
      .select()
      .from(expenses)
      .where(and(eq(expenses.id, parsed.data.expenseId), isNull(expenses.deletedAt)))
      .limit(1);
    if (!expense) return fail("El gasto no existe o se borró.");

    const id = newId();
    await db.transaction(async (tx) => {
      await tx.insert(comments).values({
        id,
        expenseId: expense.id,
        userId: actor.id,
        body: parsed.data.body,
      });
      await logActivity(tx, {
        actorId: actor.id,
        action: "created",
        entityType: "comment",
        entityId: id,
        sectionId: expense.sectionId,
        summary: `${actor.name} comentó en «${expense.title}»`,
        details: { after: { body: parsed.data.body, expenseId: expense.id } },
      });
    });

    revalidatePath(`/gastos/${expense.id}`);
    return { ok: true as const, id };
  });
}

export async function deleteCommentAction(input: unknown): Promise<ActionResult> {
  return guard(async () => {
    const actor = await requireUser();
    const parsed = idSchema.safeParse(input);
    if (!parsed.success) return zodFail(parsed.error);

    const [comment] = await db
      .select()
      .from(comments)
      .where(and(eq(comments.id, parsed.data.id), isNull(comments.deletedAt)))
      .limit(1);
    if (!comment) return fail("El comentario no existe.");
    if (comment.userId !== actor.id && !isAdmin(actor)) {
      return fail("Solo puedes borrar tus propios comentarios.");
    }

    const [expense] = await db.select().from(expenses).where(eq(expenses.id, comment.expenseId)).limit(1);

    await db.transaction(async (tx) => {
      await tx.update(comments).set({ deletedAt: new Date() }).where(eq(comments.id, comment.id));
      await logActivity(tx, {
        actorId: actor.id,
        action: "deleted",
        entityType: "comment",
        entityId: comment.id,
        sectionId: expense?.sectionId ?? null,
        summary: `${actor.name} borró un comentario en «${expense?.title ?? "un gasto"}»`,
        details: { before: { body: comment.body } },
      });
    });

    revalidatePath(`/gastos/${comment.expenseId}`);
    return { ok: true as const };
  });
}
