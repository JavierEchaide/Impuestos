import { ArrowRight } from "lucide-react";
import type { ReactNode } from "react";
import { Money } from "@/components/money";
import { Badge } from "@/components/ui/badge";
import { UserAvatar } from "@/components/user-avatar";
import type { PublicUser } from "@/lib/queries/users";

/** Una línea "A debe X € a B", con acción opcional (p. ej. "Ya he pagado"). */
export function DebtRow({
  from,
  to,
  amountCents,
  sectionName,
  currentUserId,
  action,
}: {
  from: PublicUser | undefined;
  to: PublicUser | undefined;
  amountCents: number;
  sectionName?: string;
  currentUserId: string;
  action?: ReactNode;
}) {
  const fromName = from ? (from.id === currentUserId ? "Tú" : from.name) : "?";
  const toName = to ? (to.id === currentUserId ? "ti" : to.name) : "?";
  const iOwe = from?.id === currentUserId;
  return (
    <li className="flex items-center gap-3 py-3">
      <UserAvatar name={(iOwe ? to?.name : from?.name) ?? "?"} color={(iOwe ? to?.color : from?.color) ?? "#928374"} />
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-x-1.5 text-sm font-medium leading-tight">
          <span>{fromName}</span>
          <ArrowRight className="size-3.5 text-muted-foreground" aria-label="debe a" />
          <span>{toName}</span>
        </p>
        {sectionName ? (
          <Badge variant="secondary" className="mt-1 max-w-full truncate">
            {sectionName}
          </Badge>
        ) : null}
      </div>
      <div className="flex flex-col items-end gap-1.5">
        <Money cents={amountCents} className="font-semibold" />
        {action}
      </div>
    </li>
  );
}
