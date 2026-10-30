import "server-only";
import { and, asc, desc, eq, isNull, lt } from "drizzle-orm";
import { activityLog, comments, db, expenseSplits, expenses, payments, sections } from "@/lib/db";

export async function getExpenseDetail(id: string) {
  const [row] = await db
    .select({ expense: expenses, sectionName: sections.name })
    .from(expenses)
    .innerJoin(sections, eq(sections.id, expenses.sectionId))
    .where(eq(expenses.id, id))
    .limit(1);
  if (!row) return null;

  const splits = await db.select().from(expenseSplits).where(eq(expenseSplits.expenseId, id));
  const commentRows = await db
    .select()
    .from(comments)
    .where(and(eq(comments.expenseId, id), isNull(comments.deletedAt)))
    .orderBy(asc(comments.createdAt));

  return { expense: row.expense, sectionName: row.sectionName, splits, comments: commentRows };
}

export async function getPayment(id: string) {
  const [row] = await db.select().from(payments).where(eq(payments.id, id)).limit(1);
  return row ?? null;
}

export interface ActivityFilters {
  sectionId?: string;
  entityType?: string;
  entityId?: string;
  /** El admin ve también los eventos de gestión de usuarios. */
  includeAdminOnly: boolean;
  before?: Date;
  limit?: number;
}

export async function listActivity(filters: ActivityFilters) {
  return db
    .select()
    .from(activityLog)
    .where(
      and(
        filters.includeAdminOnly ? undefined : eq(activityLog.adminOnly, false),
        filters.sectionId ? eq(activityLog.sectionId, filters.sectionId) : undefined,
        filters.entityType ? eq(activityLog.entityType, filters.entityType) : undefined,
        filters.entityId ? eq(activityLog.entityId, filters.entityId) : undefined,
        filters.before ? lt(activityLog.createdAt, filters.before) : undefined,
      ),
    )
    .orderBy(desc(activityLog.createdAt))
    .limit(filters.limit ?? 50);
}
