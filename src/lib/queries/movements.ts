import "server-only";
import { and, desc, eq, exists, gte, ilike, inArray, isNull, lte, or, sql } from "drizzle-orm";
import { db, expenseSplits, expenses, payments, sections } from "@/lib/db";
import { PAYMENT_CATEGORY } from "@/lib/categories";
import type { MovementFilters } from "@/lib/validation/schemas";

export interface Movement {
  kind: "expense" | "payment";
  id: string;
  sectionId: string;
  sectionName: string;
  date: string;
  createdAt: Date;
  title: string;
  amountCents: number;
  category: string;
  /** Gasto: quien pagó. Pago: quien paga. */
  fromUserId: string;
  /** Pago: quien cobra. Gasto: null. */
  toUserId: string | null;
  /** Gasto: participantes del reparto. */
  participantIds: string[];
}

function escapeLike(text: string): string {
  return text.replace(/[\\%_]/g, (c) => `\\${c}`);
}

/** Lista unificada de gastos y pagos con filtros. Solo movimientos vigentes. */
export async function listMovements(filters: MovementFilters, limit = 100): Promise<Movement[]> {
  const result: Movement[] = [];
  const q = filters.q ? `%${escapeLike(filters.q)}%` : null;
  const wantsExpenses = filters.category !== PAYMENT_CATEGORY;
  const wantsPayments = !filters.category || filters.category === PAYMENT_CATEGORY;

  if (wantsExpenses) {
    const rows = await db
      .select({ expense: expenses, sectionName: sections.name })
      .from(expenses)
      .innerJoin(sections, eq(sections.id, expenses.sectionId))
      .where(
        and(
          isNull(expenses.deletedAt),
          filters.section ? eq(expenses.sectionId, filters.section) : undefined,
          filters.category ? eq(expenses.category, filters.category) : undefined,
          filters.from ? gte(expenses.expenseDate, filters.from) : undefined,
          filters.to ? lte(expenses.expenseDate, filters.to) : undefined,
          q ? or(ilike(expenses.title, q), ilike(sql`coalesce(${expenses.note}, '')`, q)) : undefined,
          filters.person
            ? or(
                eq(expenses.paidBy, filters.person),
                exists(
                  db
                    .select({ one: sql`1` })
                    .from(expenseSplits)
                    .where(
                      and(
                        eq(expenseSplits.expenseId, expenses.id),
                        eq(expenseSplits.userId, filters.person),
                      ),
                    ),
                ),
              )
            : undefined,
        ),
      )
      .orderBy(desc(expenses.expenseDate), desc(expenses.createdAt))
      .limit(limit);

    const ids = rows.map((r) => r.expense.id);
    const splitRows = ids.length
      ? await db.select().from(expenseSplits).where(inArray(expenseSplits.expenseId, ids))
      : [];
    const participants = new Map<string, string[]>();
    for (const split of splitRows) {
      const list = participants.get(split.expenseId) ?? [];
      list.push(split.userId);
      participants.set(split.expenseId, list);
    }
    for (const { expense, sectionName } of rows) {
      result.push({
        kind: "expense",
        id: expense.id,
        sectionId: expense.sectionId,
        sectionName,
        date: expense.expenseDate,
        createdAt: expense.createdAt,
        title: expense.title,
        amountCents: expense.amountCents,
        category: expense.category,
        fromUserId: expense.paidBy,
        toUserId: null,
        participantIds: participants.get(expense.id) ?? [],
      });
    }
  }

  if (wantsPayments) {
    const rows = await db
      .select({ payment: payments, sectionName: sections.name })
      .from(payments)
      .innerJoin(sections, eq(sections.id, payments.sectionId))
      .where(
        and(
          isNull(payments.deletedAt),
          filters.section ? eq(payments.sectionId, filters.section) : undefined,
          filters.from ? gte(payments.paymentDate, filters.from) : undefined,
          filters.to ? lte(payments.paymentDate, filters.to) : undefined,
          q ? ilike(sql`coalesce(${payments.note}, '')`, q) : undefined,
          filters.person
            ? or(eq(payments.fromUserId, filters.person), eq(payments.toUserId, filters.person))
            : undefined,
        ),
      )
      .orderBy(desc(payments.paymentDate), desc(payments.createdAt))
      .limit(limit);

    for (const { payment, sectionName } of rows) {
      result.push({
        kind: "payment",
        id: payment.id,
        sectionId: payment.sectionId,
        sectionName,
        date: payment.paymentDate,
        createdAt: payment.createdAt,
        title: "Pago",
        amountCents: payment.amountCents,
        category: PAYMENT_CATEGORY,
        fromUserId: payment.fromUserId,
        toUserId: payment.toUserId,
        participantIds: [payment.toUserId],
      });
    }
  }

  return result
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, limit);
}
