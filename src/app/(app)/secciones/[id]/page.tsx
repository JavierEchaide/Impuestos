import { HandCoins, Plus, Trash2 } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ConfirmActionButton } from "@/components/confirm-action-button";
import { DebtRow } from "@/components/debt-row";
import { ModeToggle } from "@/components/mode-toggle";
import { Money } from "@/components/money";
import { MovementList } from "@/components/movement-list";
import { PaymentDialog } from "@/components/payments/payment-dialog";
import { SectionActions } from "@/components/sections/section-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { UserAvatar } from "@/components/user-avatar";
import { deletePaymentAction } from "@/lib/actions/payments";
import { requireUser } from "@/lib/auth/session";
import { canDeletePayment, canEditSection, canRegisterPayment } from "@/lib/permissions";
import { computeBalances, directDebts, simplifyDebts } from "@/lib/money";
import { getSection, loadLedger } from "@/lib/queries/ledger";
import { listMovements } from "@/lib/queries/movements";
import { parseMode } from "@/lib/queries/overview";
import { listUsers, userMap } from "@/lib/queries/users";

export const metadata: Metadata = { title: "Sección" };

export default async function SectionPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const me = await requireUser();
  const { id } = await params;
  const mode = parseMode((await searchParams).modo);

  const section = await getSection(id);
  if (!section) notFound();

  const [users, ledger, movements] = await Promise.all([
    listUsers(),
    loadLedger(id),
    listMovements({ section: id }, 30),
  ]);
  const usersById = userMap(users);
  const balances = computeBalances(ledger.expenses, ledger.payments, users.map((u) => u.id));
  const transfers = mode === "directo" ? directDebts(ledger.expenses, ledger.payments) : simplifyDebts(balances);
  const activePeople = users.filter((u) => u.active).map((u) => ({ id: u.id, name: u.name }));
  const canEditThisSection = canEditSection(me, section);
  const archived = Boolean(section.archivedAt);

  // Personas con saldo o activas, de mayor a menor saldo.
  const people = users
    .filter((u) => u.active || (balances[u.id] ?? 0) !== 0)
    .sort((a, b) => (balances[b.id] ?? 0) - (balances[a.id] ?? 0));

  const paymentIds = new Map(ledger.payments.map((p) => [p.id, p]));

  return (
    <>
      <div className="flex flex-col gap-2">
        <Link href="/secciones" className="text-sm text-muted-foreground underline underline-offset-4">
          ← Secciones
        </Link>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="flex flex-wrap items-center gap-2 text-xl font-bold">
              {section.name}
              {archived ? <Badge variant="outline">Archivada</Badge> : null}
            </h1>
            {section.description ? <p className="text-sm text-muted-foreground">{section.description}</p> : null}
          </div>
        </div>
        {canEditThisSection ? (
          <SectionActions id={section.id} name={section.name} description={section.description} archived={archived} />
        ) : null}
      </div>

      {!archived ? (
        <div className="grid grid-cols-2 gap-3">
          <Button asChild size="lg">
            <Link href={`/gastos/nuevo?seccion=${section.id}`}>
              <Plus />
              Añadir gasto
            </Link>
          </Button>
          <PaymentDialog
            sectionId={section.id}
            sectionName={section.name}
            people={activePeople}
            currentUserId={me.id}
            trigger={{ label: "Registrar pago", variant: "outline", size: "lg", icon: <HandCoins /> }}
          />
        </div>
      ) : (
        <p className="rounded-lg border border-dashed p-3 text-center text-sm text-muted-foreground">
          Sección archivada: desarchívala para añadir gastos o pagos.
        </p>
      )}

      <section aria-labelledby="saldos-titulo" className="flex flex-col gap-2">
        <h2 id="saldos-titulo" className="text-base font-semibold">
          Saldo de cada persona
        </h2>
        <Card>
          <ul className="divide-y px-4">
            {people.map((u) => (
              <li key={u.id} className="flex items-center gap-3 py-3">
                <UserAvatar name={u.name} color={u.color} />
                <span className="flex-1 font-medium">{u.id === me.id ? `${u.name} (tú)` : u.name}</span>
                <Money cents={balances[u.id] ?? 0} signed className="font-semibold" />
              </li>
            ))}
          </ul>
        </Card>
      </section>

      <section aria-labelledby="quien-paga-titulo" className="flex flex-col gap-2">
        <h2 id="quien-paga-titulo" className="text-base font-semibold">
          Quién paga a quién
        </h2>
        <ModeToggle mode={mode} basePath={`/secciones/${section.id}`} />
        {transfers.length === 0 ? (
          <p className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
            Todo saldado en esta sección.
          </p>
        ) : (
          <Card>
            <ul className="divide-y px-4">
              {transfers.map((t) => {
                const canPay = !archived && canRegisterPayment(me, { fromUserId: t.from, toUserId: t.to });
                return (
                  <DebtRow
                    key={`${t.from}-${t.to}`}
                    from={usersById.get(t.from)}
                    to={usersById.get(t.to)}
                    amountCents={t.amountCents}
                    currentUserId={me.id}
                    action={
                      canPay ? (
                        <PaymentDialog
                          sectionId={section.id}
                          sectionName={section.name}
                          people={activePeople}
                          currentUserId={me.id}
                          fromId={t.from}
                          toId={t.to}
                          amountCents={t.amountCents}
                          lockParties
                          title={t.from === me.id ? "Ya he pagado" : t.to === me.id ? "Ya me ha pagado" : "Registrar pago"}
                          trigger={{
                            label: t.from === me.id ? "Ya he pagado" : t.to === me.id ? "Ya me ha pagado" : "Registrar pago",
                            variant: t.from === me.id ? "success" : "outline",
                          }}
                        />
                      ) : null
                    }
                  />
                );
              })}
            </ul>
          </Card>
        )}
        <p className="text-xs text-muted-foreground">
          {mode === "simplificado"
            ? "Simplificadas: el mínimo de transferencias para dejar todo a cero."
            : "Directas: lo que se deben entre sí cada dos personas, sin reencaminar."}
        </p>
      </section>

      <section aria-labelledby="movimientos-titulo" className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between">
          <h2 id="movimientos-titulo" className="text-base font-semibold">
            Movimientos
          </h2>
          <Link href={`/gastos?seccion=${section.id}`} className="text-sm text-primary underline-offset-4 hover:underline">
            Buscar y filtrar
          </Link>
        </div>
        <MovementList
          movements={movements}
          usersById={usersById}
          currentUserId={me.id}
          renderPaymentAction={(m) => {
            const payment = paymentIds.get(m.id);
            if (!payment || !canDeletePayment(me, payment)) return null;
            return (
              <ConfirmActionButton
                action={deletePaymentAction}
                id={payment.id}
                label="Borrar pago"
                icon={<Trash2 />}
                iconOnly
                variant="ghost"
                size="icon"
                destructive
                title="¿Borrar este pago?"
                description="El pago dejará de contar en los saldos, pero quedará registrado en el historial."
                confirmLabel="Borrar pago"
                successMessage="Pago borrado"
              />
            );
          }}
        />
        <Link
          href={`/actividad?seccion=${section.id}`}
          className="text-center text-sm text-muted-foreground underline underline-offset-4"
        >
          Ver el historial de actividad de esta sección
        </Link>
      </section>
    </>
  );
}
