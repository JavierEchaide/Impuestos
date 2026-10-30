import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ExpenseForm } from "@/components/expenses/expense-form";
import { requireUser } from "@/lib/auth/session";
import { canModifyExpense } from "@/lib/permissions";
import { getExpenseDetail } from "@/lib/queries/detail";
import { listSections } from "@/lib/queries/ledger";
import { listUsers } from "@/lib/queries/users";
import type { SplitType } from "@/lib/money";

export const metadata: Metadata = { title: "Editar gasto" };

export default async function EditExpensePage({ params }: { params: Promise<{ id: string }> }) {
  const me = await requireUser();
  const { id } = await params;
  const detail = await getExpenseDetail(id);
  if (!detail) notFound();
  const { expense, splits } = detail;

  if (expense.deletedAt || !canModifyExpense(me, expense)) redirect(`/gastos/${id}`);

  const [users, sections] = await Promise.all([listUsers(), listSections({ includeArchived: true })]);
  // Pueden aparecer personas desactivadas que ya participaban en este gasto.
  const involved = new Set([expense.paidBy, ...splits.map((s) => s.userId)]);
  const people = users
    .filter((u) => u.active || involved.has(u.id))
    .map((u) => ({ id: u.id, name: u.name, color: u.color }));

  return (
    <>
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Editar gasto</h1>
        <Link href={`/gastos/${id}`} className="text-sm text-muted-foreground underline underline-offset-4">
          Cancelar
        </Link>
      </div>
      <ExpenseForm
        mode="edit"
        people={people}
        sections={sections.map((s) => ({ id: s.id, name: s.name }))}
        currentUserId={me.id}
        initial={{
          id: expense.id,
          sectionId: expense.sectionId,
          title: expense.title,
          amountCents: expense.amountCents,
          date: expense.expenseDate,
          category: expense.category,
          paidBy: expense.paidBy,
          splitType: expense.splitType as SplitType,
          note: expense.note,
          splits: splits.map((s) => ({ userId: s.userId, weight: s.weight })),
        }}
      />
    </>
  );
}
