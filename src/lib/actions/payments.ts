"use server";

import { and, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db, payments } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { canDeletePayment, canRegisterPayment } from "@/lib/permissions";
import { idSchema, paymentSchema } from "@/lib/validation/schemas";
import { activeUserNames, getActiveSection, money } from "./guards";
import { fail, guard, logActivity, newId, zodFail, type ActionResult } from "./shared";

/**
 * "Ya he pagado": registra un pago de A a B dentro de una sección. Lo puede
 * registrar quien paga, quien cobra o el admin. Reduce los saldos al instante.
 */
export async function createPaymentAction(
  input: unknown,
): Promise<ActionResult<{ id: string; sectionId: string }>> {
  return guard(async () => {
    const actor = await requireUser();
    const parsed = paymentSchema.safeParse(input);
    if (!parsed.success) return zodFail(parsed.error);
    const data = parsed.data;

    if (!canRegisterPayment(actor, data)) {
      return fail("Solo puedes registrar pagos en los que participas tú.");
    }

    const section = await getActiveSection(data.sectionId);
    const names = await activeUserNames([data.fromUserId, data.toUserId]);
    const id = newId();

    await db.transaction(async (tx) => {
      await tx.insert(payments).values({
        id,
        sectionId: section.id,
        fromUserId: data.fromUserId,
        toUserId: data.toUserId,
        amountCents: data.amountCents,
        paymentDate: data.date,
        note: data.note ?? null,
        createdBy: actor.id,
      });
      await logActivity(tx, {
        actorId: actor.id,
        action: "created",
        entityType: "payment",
        entityId: id,
        sectionId: section.id,
        summary: `${names.get(data.fromUserId)} pagó ${money(data.amountCents)} a ${names.get(data.toUserId)} en ${section.name}${
          actor.id !== data.fromUserId ? ` (registrado por ${actor.name})` : ""
        }`,
        details: {
          after: {
            fromUserId: data.fromUserId,
            toUserId: data.toUserId,
            amountCents: data.amountCents,
            date: data.date,
          },
        },
      });
    });

    revalidatePath("/", "layout");
    return { ok: true as const, id, sectionId: section.id };
  });
}

/** Borrado lógico de un pago: lo puede deshacer quien lo registró o el admin. */
export async function deletePaymentAction(input: unknown): Promise<ActionResult> {
  return guard(async () => {
    const actor = await requireUser();
    const parsed = idSchema.safeParse(input);
    if (!parsed.success) return zodFail(parsed.error);

    const [existing] = await db
      .select()
      .from(payments)
      .where(and(eq(payments.id, parsed.data.id), isNull(payments.deletedAt)))
      .limit(1);
    if (!existing) return fail("El pago no existe o ya se borró.");
    if (!canDeletePayment(actor, existing)) {
      return fail("Solo puedes borrar los pagos que has registrado tú.");
    }

    await db.transaction(async (tx) => {
      await tx
        .update(payments)
        .set({ deletedAt: new Date(), deletedBy: actor.id })
        .where(eq(payments.id, existing.id));
      await logActivity(tx, {
        actorId: actor.id,
        action: "deleted",
        entityType: "payment",
        entityId: existing.id,
        sectionId: existing.sectionId,
        summary: `${actor.name} borró un pago de ${money(existing.amountCents)}`,
        details: {
          before: {
            fromUserId: existing.fromUserId,
            toUserId: existing.toUserId,
            amountCents: existing.amountCents,
            date: existing.paymentDate,
          },
        },
      });
    });

    revalidatePath("/", "layout");
    return { ok: true as const };
  });
}
