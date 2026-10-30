import { ArchiveRestore, Pencil, Trash2 } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CategoryIcon } from "@/components/category-icon";
import { ConfirmActionButton } from "@/components/confirm-action-button";
import { Comments, type CommentView } from "@/components/expenses/comments";
import { Money } from "@/components/money";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { UserAvatar } from "@/components/user-avatar";
import { deleteExpenseAction, restoreExpenseAction } from "@/lib/actions/expenses";
import { isAdmin, requireUser } from "@/lib/auth/session";
import { canDeleteComment, canModifyExpense } from "@/lib/permissions";
import { categoryLabel } from "@/lib/categories";
import { formatDate, formatDateTime } from "@/lib/format";
import { getExpenseDetail, listActivity } from "@/lib/queries/detail";
import { listUsers, userMap } from "@/lib/queries/users";

export const metadata: Metadata = { title: "Gasto" };

const SPLIT_LABELS: Record<string, string> = {
  equal: "A partes iguales",
  exact: "Importes exactos",
  percent: "Por porcentajes",
  shares: "Por participaciones",
};

export default async function ExpensePage({ params }: { params: Promise<{ id: string }> }) {
  const me = await requireUser();
  const { id } = await params;
  const detail = await getExpenseDetail(id);
  if (!detail) notFound();

  const { expense, sectionName, splits, comments } = detail;
  const [users, history] = await Promise.all([
    listUsers(),
    listActivity({ entityType: "expense", entityId: id, includeAdminOnly: isAdmin(me), limit: 20 }),
  ]);
  const usersById = userMap(users);
  const nameOf = (uid: string) => (uid === me.id ? "Tú" : (usersById.get(uid)?.name ?? "?"));

  const deleted = Boolean(expense.deletedAt);
  const admin = isAdmin(me);
  const canModify = !deleted && canModifyExpense(me, expense);

  const commentViews: CommentView[] = comments.map((c) => {
    const author = usersById.get(c.userId);
    return {
      id: c.id,
      body: c.body,
      authorName: author?.name ?? "?",
      authorColor: author?.color ?? "#928374",
      createdAtLabel: formatDateTime(c.createdAt),
      canDelete: canDeleteComment(me, c),
    };
  });

  return (
    <>
      <Link href={`/secciones/${expense.sectionId}`} className="text-sm text-muted-foreground underline underline-offset-4">
        ← {sectionName}
      </Link>

      {deleted ? (
        <div className="flex flex-col gap-2 rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm">
          <p className="font-medium text-destructive">
            Este gasto se borró el {formatDateTime(expense.deletedAt!)}
            {expense.deletedBy ? ` por ${nameOf(expense.deletedBy)}` : ""}. Ya no cuenta en los saldos.
          </p>
          {admin ? (
            <div>
              <ConfirmActionButton
                action={restoreExpenseAction}
                id={expense.id}
                label="Restaurar gasto"
                icon={<ArchiveRestore />}
                title="¿Restaurar este gasto?"
                description="Volverá a contar en los saldos de la sección."
                confirmLabel="Restaurar"
                successMessage="Gasto restaurado"
              />
            </div>
          ) : null}
        </div>
      ) : null}

      <Card className="p-5">
        <div className="flex items-start gap-3">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-secondary text-muted-foreground">
            <CategoryIcon category={expense.category} className="size-6" />
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-bold leading-tight break-words">{expense.title}</h1>
            <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
              <span>{formatDate(expense.expenseDate)}</span>
              <Badge variant="secondary">{categoryLabel(expense.category)}</Badge>
            </p>
          </div>
        </div>
        <p className="mt-4 text-3xl font-bold">
          <Money cents={expense.amountCents} />
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          Pagó <strong className="text-foreground">{nameOf(expense.paidBy)}</strong> · {SPLIT_LABELS[expense.splitType] ?? expense.splitType}
        </p>
        {expense.note ? <p className="mt-3 whitespace-pre-wrap rounded-lg bg-secondary p-3 text-sm">{expense.note}</p> : null}
        <p className="mt-3 text-xs text-muted-foreground">
          Creado por {nameOf(expense.createdBy)} el {formatDateTime(expense.createdAt)}
        </p>
      </Card>

      {canModify ? (
        <div className="flex gap-2">
          <Button asChild variant="outline" className="flex-1">
            <Link href={`/gastos/${expense.id}/editar`}>
              <Pencil />
              Editar
            </Link>
          </Button>
          <ConfirmActionButton
            action={deleteExpenseAction}
            id={expense.id}
            label="Borrar"
            icon={<Trash2 />}
            variant="outline"
            size="default"
            destructive
            title="¿Borrar este gasto?"
            description="Dejará de contar en los saldos. Quedará guardado en el historial y el administrador podrá restaurarlo."
            confirmLabel="Borrar gasto"
            successMessage="Gasto borrado"
            redirectTo={`/secciones/${expense.sectionId}`}
          />
        </div>
      ) : null}

      <section aria-labelledby="reparto-titulo" className="flex flex-col gap-2">
        <h2 id="reparto-titulo" className="text-base font-semibold">
          Reparto
        </h2>
        <Card>
          <ul className="divide-y px-4">
            {splits.map((s) => {
              const u = usersById.get(s.userId);
              return (
                <li key={s.userId} className="flex items-center gap-3 py-3">
                  <UserAvatar name={u?.name ?? "?"} color={u?.color ?? "#928374"} />
                  <span className="flex-1 font-medium">{nameOf(s.userId)}</span>
                  <Money cents={s.amountCents} className="font-semibold" />
                </li>
              );
            })}
          </ul>
        </Card>
      </section>

      <section aria-labelledby="comentarios-titulo" className="flex flex-col gap-2">
        <h2 id="comentarios-titulo" className="text-base font-semibold">
          Comentarios
        </h2>
        <Comments expenseId={expense.id} comments={commentViews} readOnly={deleted} />
      </section>

      <section aria-labelledby="historial-titulo" className="flex flex-col gap-2">
        <h2 id="historial-titulo" className="text-base font-semibold">
          Historial
        </h2>
        <ul className="flex flex-col gap-1 text-sm text-muted-foreground">
          {history.map((h) => (
            <li key={h.id}>
              <span className="text-foreground">{h.summary}</span> · {formatDateTime(h.createdAt)}
            </li>
          ))}
          {history.length === 0 ? <li>Sin cambios registrados.</li> : null}
        </ul>
      </section>
    </>
  );
}
