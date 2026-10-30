import "server-only";
import { and, asc, desc, eq, inArray, isNull } from "drizzle-orm";
import { db, expenseSplits, expenses, payments, sections } from "@/lib/db";
import { computeBalances, type ExpenseLike, type PaymentLike } from "@/lib/money";

export interface LedgerExpense extends ExpenseLike {
  id: string;
  sectionId: string;
  title: string;
  date: string;
  category: string;
  splitType: string;
  note: string | null;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  splits: { userId: string; amountCents: number; weight: number }[];
}

export interface LedgerPayment extends PaymentLike {
  id: string;
  sectionId: string;
  date: string;
  note: string | null;
  createdBy: string;
  createdAt: Date;
}

export interface SectionRow {
  id: string;
  name: string;
  description: string | null;
  createdBy: string;
  createdAt: Date;
  archivedAt: Date | null;
}

export async function listSections(options: { includeArchived?: boolean } = {}): Promise<SectionRow[]> {
  const where = options.includeArchived ? undefined : isNull(sections.archivedAt);
  return db.select().from(sections).where(where).orderBy(asc(sections.name));
}

export async function getSection(id: string): Promise<SectionRow | null> {
  const [row] = await db.select().from(sections).where(eq(sections.id, id)).limit(1);
  return row ?? null;
}

/**
 * Gastos y pagos vigentes (no borrados) con sus repartos. Sin `sectionId`
 * devuelve los de todas las secciones activas.
 */
export async function loadLedger(sectionId?: string): Promise<{
  expenses: LedgerExpense[];
  payments: LedgerPayment[];
}> {
  const expenseRows = await db
    .select()
    .from(expenses)
    .where(and(isNull(expenses.deletedAt), sectionId ? eq(expenses.sectionId, sectionId) : undefined))
    .orderBy(desc(expenses.expenseDate), desc(expenses.createdAt));

  const splitRows = expenseRows.length
    ? await db
        .select()
        .from(expenseSplits)
        .where(inArray(expenseSplits.expenseId, expenseRows.map((e) => e.id)))
    : [];

  const splitsByExpense = new Map<string, LedgerExpense["splits"]>();
  for (const split of splitRows) {
    const list = splitsByExpense.get(split.expenseId) ?? [];
    list.push({ userId: split.userId, amountCents: split.amountCents, weight: split.weight });
    splitsByExpense.set(split.expenseId, list);
  }

  const paymentRows = await db
    .select()
    .from(payments)
    .where(and(isNull(payments.deletedAt), sectionId ? eq(payments.sectionId, sectionId) : undefined))
    .orderBy(desc(payments.paymentDate), desc(payments.createdAt));

  return {
    expenses: expenseRows.map((e) => ({
      id: e.id,
      sectionId: e.sectionId,
      title: e.title,
      amountCents: e.amountCents,
      date: e.expenseDate,
      category: e.category,
      paidBy: e.paidBy,
      splitType: e.splitType,
      note: e.note,
      createdBy: e.createdBy,
      createdAt: e.createdAt,
      updatedAt: e.updatedAt,
      splits: splitsByExpense.get(e.id) ?? [],
    })),
    payments: paymentRows.map((p) => ({
      id: p.id,
      sectionId: p.sectionId,
      fromUserId: p.fromUserId,
      toUserId: p.toUserId,
      amountCents: p.amountCents,
      date: p.paymentDate,
      note: p.note,
      createdBy: p.createdBy,
      createdAt: p.createdAt,
    })),
  };
}

/** Agrupa un libro mayor por sección. */
export function groupBySection(ledger: { expenses: LedgerExpense[]; payments: LedgerPayment[] }) {
  const groups = new Map<string, { expenses: LedgerExpense[]; payments: LedgerPayment[] }>();
  const bucket = (id: string) => {
    let group = groups.get(id);
    if (!group) {
      group = { expenses: [], payments: [] };
      groups.set(id, group);
    }
    return group;
  };
  for (const expense of ledger.expenses) bucket(expense.sectionId).expenses.push(expense);
  for (const payment of ledger.payments) bucket(payment.sectionId).payments.push(payment);
  return groups;
}

export function balancesFor(
  group: { expenses: LedgerExpense[]; payments: LedgerPayment[] },
  userIds: string[],
) {
  return computeBalances(group.expenses, group.payments, userIds);
}
