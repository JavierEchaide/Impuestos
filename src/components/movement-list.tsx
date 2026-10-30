import { ArrowRight } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { CategoryIcon } from "@/components/category-icon";
import { Money } from "@/components/money";
import { Badge } from "@/components/ui/badge";
import { categoryLabel } from "@/lib/categories";
import { formatDate } from "@/lib/format";
import type { Movement } from "@/lib/queries/movements";
import type { PublicUser } from "@/lib/queries/users";

/** Lista de gastos y pagos. Los gastos enlazan a su detalle; los pagos muestran quién pagó a quién. */
export function MovementList({
  movements,
  usersById,
  currentUserId,
  showSection = false,
  renderPaymentAction,
}: {
  movements: Movement[];
  usersById: Map<string, PublicUser>;
  currentUserId: string;
  showSection?: boolean;
  renderPaymentAction?: (movement: Movement) => ReactNode;
}) {
  const nameOf = (id: string | null) => {
    if (!id) return "?";
    return id === currentUserId ? "Tú" : (usersById.get(id)?.name ?? "?");
  };

  if (movements.length === 0) {
    return (
      <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
        No hay movimientos con estos criterios.
      </p>
    );
  }

  return (
    <ul className="divide-y rounded-xl border bg-card">
      {movements.map((m) => {
        const content = (
          <>
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-secondary text-muted-foreground">
              <CategoryIcon category={m.category} className="size-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium leading-tight">
                {m.kind === "payment" ? (
                  <span className="inline-flex items-center gap-1.5">
                    {nameOf(m.fromUserId)}
                    <ArrowRight className="size-3.5 text-muted-foreground" aria-label="pagó a" />
                    {nameOf(m.toUserId)}
                  </span>
                ) : (
                  m.title
                )}
              </p>
              <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                <span>{formatDate(m.date)}</span>
                {m.kind === "expense" ? <span>Pagó {nameOf(m.fromUserId)}</span> : <span>Pago</span>}
                {m.kind === "expense" ? <span>{categoryLabel(m.category)}</span> : null}
                {showSection ? (
                  <Badge variant="secondary" className="max-w-40 truncate">
                    {m.sectionName}
                  </Badge>
                ) : null}
              </p>
            </div>
            <Money cents={m.amountCents} className="font-semibold" />
          </>
        );
        return (
          <li key={`${m.kind}-${m.id}`} className="flex items-center gap-3 px-3 py-3">
            {m.kind === "expense" ? (
              <Link href={`/gastos/${m.id}`} className="flex min-w-0 flex-1 items-center gap-3">
                {content}
              </Link>
            ) : (
              <div className="flex min-w-0 flex-1 items-center gap-3">{content}</div>
            )}
            {m.kind === "payment" && renderPaymentAction ? renderPaymentAction(m) : null}
          </li>
        );
      })}
    </ul>
  );
}
