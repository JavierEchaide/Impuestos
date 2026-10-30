"use server";

import { and, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { INITIAL_DEBT_CATEGORY } from "@/lib/categories";
import { db, expenseSplits, expenses } from "@/lib/db";
import { computeSplit } from "@/lib/money";
import { isAdmin, requireUser } from "@/lib/auth/session";
import {
  expenseSchema,
  expenseUpdateSchema,
  idSchema,
  type ExpenseInput,
} from "@/lib/validation/schemas";
import { activeUserNames, getActiveSection, money } from "./guards";
import { ActionError, fail, guard, logActivity, newId, zodFail, type ActionResult } from "./shared";

function snapshot(
  e: Omit<Pick<ExpenseInput, "title" | "amountCents" | "date" | "category" | "paidBy" | "splitType" | "note">, "category"> & {
    category: string;
  },
  splits: { userId: string; amountCents: number }[],
) {
  return {
    title: e.title,
    amountCents: e.amountCents,
    date: e.date,
    category: e.category,
    paidBy: e.paidBy,
    splitType: e.splitType,
    note: e.note ?? null,
    splits: [...splits].sort((a, b) => a.userId.localeCompare(b.userId)),
  };
}

export async function createExpenseAction(
  input: unknown,
): Promise<ActionResult<{ id: string; sectionId: string }>> {
  return guard(async () => {
    const actor = await requireUser();
    const parsed = expenseSchema.safeParse(input);
    if (!parsed.success) return zodFail(parsed.error);
    const data = parsed.data;

    const section = await getActiveSection(data.sectionId);
    const names = await activeUserNames([data.paidBy, ...data.participants.map((p) => p.userId)]);

    const id = newId();
    const parts = computeSplit(data.amountCents, data.splitType, data.participants, id);

    await db.transaction(async (tx) => {
      await tx.insert(expenses).values({
        id,
        sectionId: section.id,
        title: data.title,
        amountCents: data.amountCents,
        expenseDate: data.date,
        category: data.category,
        paidBy: data.paidBy,
        splitType: data.splitType,
        note: data.note ?? null,
        createdBy: actor.id,
      });
      await tx.insert(expenseSplits).values(
        parts.map((p) => ({
          expenseId: id,
          userId: p.userId,
          amountCents: p.amountCents,
          weight: p.weight,
        })),
      );
      await logActivity(tx, {
        actorId: actor.id,
        action: "created",
        entityType: "expense",
        entityId: id,
        sectionId: section.id,
        summary: `${actor.name} añadió «${data.title}» (${money(data.amountCents)}) pagado por ${names.get(data.paidBy)} en ${section.name}`,
        details: { after: snapshot(data, parts) },
      });
    });

    revalidatePath("/", "layout");
    return { ok: true as const, id, sectionId: section.id };
  });
}

export async function updateExpenseAction(
  input: unknown,
): Promise<ActionResult<{ id: string; sectionId: string }>> {
  return guard(async () => {
    const actor = await requireUser();
    const parsed = expenseUpdateSchema.safeParse(input);
    if (!parsed.success) return zodFail(parsed.error);
    const data = parsed.data;

    const [existing] = await db
      .select()
      .from(expenses)
      .where(and(eq(expenses.id, data.id), isNull(expenses.deletedAt)))
      .limit(1);
    if (!existing) return fail("El gasto no existe o ya se borró.");

    assertCanModify(actor, existing);
    if (existing.category === INITIAL_DEBT_CATEGORY && data.category !== INITIAL_DEBT_CATEGORY) {
      return fail("Una deuda inicial no puede cambiar de categoría.");
    }
    if (existing.category !== INITIAL_DEBT_CATEGORY && data.category === INITIAL_DEBT_CATEGORY) {
      return fail("La categoría «Deuda inicial» solo se crea desde la pantalla de deudas iniciales.");
    }

    // El gasto sigue en su sección; no se permite moverlo a una archivada.
    const section = await getActiveSection(existing.sectionId);
    const names = await activeUserNames([data.paidBy, ...data.participants.map((p) => p.userId)]);
    const parts = computeSplit(data.amountCents, data.splitType, data.participants, existing.id);

    const previousSplits = await db
      .select()
      .from(expenseSplits)
      .where(eq(expenseSplits.expenseId, existing.id));

    await db.transaction(async (tx) => {
      await tx
        .update(expenses)
        .set({
          title: data.title,
          amountCents: data.amountCents,
          expenseDate: data.date,
          category: data.category,
          paidBy: data.paidBy,
          splitType: data.splitType,
          note: data.note ?? null,
          updatedAt: new Date(),
        })
        .where(eq(expenses.id, existing.id));
      await tx.delete(expenseSplits).where(eq(expenseSplits.expenseId, existing.id));
      await tx.insert(expenseSplits).values(
        parts.map((p) => ({
          expenseId: existing.id,
          userId: p.userId,
          amountCents: p.amountCents,
          weight: p.weight,
        })),
      );
      await logActivity(tx, {
        actorId: actor.id,
        action: "updated",
        entityType: "expense",
        entityId: existing.id,
        sectionId: section.id,
        summary: `${actor.name} editó «${data.title}» (${money(data.amountCents)}), pagado por ${names.get(data.paidBy)}`,
        details: {
          before: snapshot(
            {
              title: existing.title,
              amountCents: existing.amountCents,
              date: existing.expenseDate,
              category: existing.category,
              paidBy: existing.paidBy,
              splitType: existing.splitType as ExpenseInput["splitType"],
              note: existing.note ?? undefined,
            },
            previousSplits,
          ),
          after: snapshot(data, parts),
        },
      });
    });

    revalidatePath("/", "layout");
    return { ok: true as const, id: existing.id, sectionId: section.id };
  });
}

/** Borrado lógico: el gasto deja de contar en los saldos pero queda en el historial. */
export async function deleteExpenseAction(input: unknown): Promise<ActionResult> {
  return guard(async () => {
    const actor = await requireUser();
    const parsed = idSchema.safeParse(input);
    if (!parsed.success) return zodFail(parsed.error);

    const [existing] = await db
      .select()
      .from(expenses)
      .where(and(eq(expenses.id, parsed.data.id), isNull(expenses.deletedAt)))
      .limit(1);
    if (!existing) return fail("El gasto no existe o ya se borró.");
    assertCanModify(actor, existing);

    await db.transaction(async (tx) => {
      await tx
        .update(expenses)
        .set({ deletedAt: new Date(), deletedBy: actor.id })
        .where(eq(expenses.id, existing.id));
      await logActivity(tx, {
        actorId: actor.id,
        action: "deleted",
        entityType: "expense",
        entityId: existing.id,
        sectionId: existing.sectionId,
        summary: `${actor.name} borró «${existing.title}» (${money(existing.amountCents)})`,
        details: { before: { title: existing.title, amountCents: existing.amountCents } },
      });
    });

    revalidatePath("/", "layout");
    return { ok: true as const };
  });
}

/** Solo el admin puede recuperar un gasto borrado. */
export async function restoreExpenseAction(input: unknown): Promise<ActionResult> {
  return guard(async () => {
    const actor = await requireUser();
    if (!isAdmin(actor)) return fail("Solo el administrador puede restaurar gastos.");
    const parsed = idSchema.safeParse(input);
    if (!parsed.success) return zodFail(parsed.error);

    const [existing] = await db.select().from(expenses).where(eq(expenses.id, parsed.data.id)).limit(1);
    if (!existing || !existing.deletedAt) return fail("El gasto no está borrado.");

    await db.transaction(async (tx) => {
      await tx
        .update(expenses)
        .set({ deletedAt: null, deletedBy: null, updatedAt: new Date() })
        .where(eq(expenses.id, existing.id));
      await logActivity(tx, {
        actorId: actor.id,
        action: "restored",
        entityType: "expense",
        entityId: existing.id,
        sectionId: existing.sectionId,
        summary: `${actor.name} restauró «${existing.title}» (${money(existing.amountCents)})`,
      });
    });

    revalidatePath("/", "layout");
    return { ok: true as const };
  });
}

/**
 * Miembro: solo sus gastos. Admin: cualquiera. Las deudas iniciales las
 * gestiona únicamente el admin, aunque las haya creado otra persona.
 */
function assertCanModify(
  actor: { id: string; role: "admin" | "member" },
  expense: { createdBy: string; category: string },
) {
  if (isAdmin(actor)) return;
  if (expense.category === INITIAL_DEBT_CATEGORY) {
    throw new ActionError("Las deudas iniciales solo las puede modificar el administrador.");
  }
  if (expense.createdBy !== actor.id) {
    throw new ActionError("Solo puedes modificar los gastos que has creado tú.");
  }
}
