import { HandCoins, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { DebtRow } from "@/components/debt-row";
import { ModeToggle } from "@/components/mode-toggle";
import { Money } from "@/components/money";
import { PaymentDialog } from "@/components/payments/payment-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { requireUser } from "@/lib/auth/session";
import { buildOverview, parseMode, personalTotals } from "@/lib/queries/overview";

export const metadata: Metadata = { title: "Inicio" };

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const me = await requireUser();
  const mode = parseMode((await searchParams).modo);
  const overview = await buildOverview(mode);
  const totals = personalTotals(overview, me.id);
  const activePeople = overview.users.filter((u) => u.active).map((u) => ({ id: u.id, name: u.name }));

  const headline =
    totals.netCents > 0 ? "Te deben" : totals.netCents < 0 ? "Debes" : "Estás al día";

  return (
    <>
      <section aria-labelledby="saldo-titulo" className="flex flex-col gap-3">
        <Card className="overflow-hidden">
          <CardContent className="flex flex-col gap-1 p-5">
            <p id="saldo-titulo" className="text-sm text-muted-foreground">
              Hola, {me.name}
            </p>
            <p className="text-sm font-medium">{headline}</p>
            <p className="text-4xl font-bold leading-none">
              <Money cents={Math.abs(totals.netCents)} className={totals.netCents > 0 ? "text-success" : totals.netCents < 0 ? "text-destructive" : ""} />
            </p>
            <p className="mt-2 text-xs text-muted-foreground">Saldo total sumando todas las secciones.</p>
          </CardContent>
        </Card>
        <Button asChild size="lg" className="h-14 text-base">
          <Link href="/gastos/nuevo">
            <Plus className="size-5" />
            Añadir gasto
          </Link>
        </Button>
      </section>

      <ModeToggle mode={mode} basePath="/" />

      <section aria-labelledby="debes-titulo">
        <h2 id="debes-titulo" className="mb-1 flex items-baseline justify-between text-base font-semibold">
          <span>Debes</span>
          {totals.iOwe.length > 0 ? <Money cents={totals.totalIOweCents} className="text-sm text-destructive" /> : null}
        </h2>
        {totals.iOwe.length === 0 ? (
          <p className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
            No debes nada a nadie.
          </p>
        ) : (
          <Card>
            <ul className="divide-y px-4">
              {totals.iOwe.map((t) => (
                <DebtRow
                  key={`${t.sectionId}-${t.from}-${t.to}`}
                  from={overview.usersById.get(t.from)}
                  to={overview.usersById.get(t.to)}
                  amountCents={t.amountCents}
                  sectionName={t.sectionName}
                  currentUserId={me.id}
                  action={
                    <PaymentDialog
                      sectionId={t.sectionId}
                      sectionName={t.sectionName}
                      people={activePeople}
                      currentUserId={me.id}
                      fromId={t.from}
                      toId={t.to}
                      amountCents={t.amountCents}
                      lockParties
                      title="Ya he pagado"
                      trigger={{ label: "Ya he pagado", variant: "success" }}
                    />
                  }
                />
              ))}
            </ul>
          </Card>
        )}
      </section>

      <section aria-labelledby="deben-titulo">
        <h2 id="deben-titulo" className="mb-1 flex items-baseline justify-between text-base font-semibold">
          <span>Te deben</span>
          {totals.owedToMe.length > 0 ? <Money cents={totals.totalOwedToMeCents} className="text-sm text-success" /> : null}
        </h2>
        {totals.owedToMe.length === 0 ? (
          <p className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
            Nadie te debe nada ahora mismo.
          </p>
        ) : (
          <Card>
            <ul className="divide-y px-4">
              {totals.owedToMe.map((t) => (
                <DebtRow
                  key={`${t.sectionId}-${t.from}-${t.to}`}
                  from={overview.usersById.get(t.from)}
                  to={overview.usersById.get(t.to)}
                  amountCents={t.amountCents}
                  sectionName={t.sectionName}
                  currentUserId={me.id}
                  action={
                    <PaymentDialog
                      sectionId={t.sectionId}
                      sectionName={t.sectionName}
                      people={activePeople}
                      currentUserId={me.id}
                      fromId={t.from}
                      toId={t.to}
                      amountCents={t.amountCents}
                      lockParties
                      title="Ya me ha pagado"
                      trigger={{ label: "Ya me ha pagado", variant: "outline", icon: <HandCoins /> }}
                    />
                  }
                />
              ))}
            </ul>
          </Card>
        )}
      </section>

      <section aria-labelledby="secciones-titulo">
        <div className="mb-2 flex items-baseline justify-between">
          <h2 id="secciones-titulo" className="text-base font-semibold">
            Tus secciones
          </h2>
          <Link href="/secciones" className="text-sm text-primary underline-offset-4 hover:underline">
            Ver todas
          </Link>
        </div>
        <ul className="flex flex-col gap-2">
          {overview.sections.map(({ section, balances }) => (
            <li key={section.id}>
              <Link
                href={`/secciones/${section.id}`}
                className="flex items-center justify-between gap-3 rounded-xl border bg-card p-4 transition-colors hover:bg-secondary"
              >
                <span className="min-w-0 truncate font-medium">{section.name}</span>
                <Money cents={balances[me.id] ?? 0} signed className="font-semibold" />
              </Link>
            </li>
          ))}
          {overview.sections.length === 0 ? (
            <li className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
              Todavía no hay secciones.{" "}
              <Link href="/secciones" className="text-primary underline">
                Crea la primera
              </Link>
              .
            </li>
          ) : null}
        </ul>
      </section>

    </>
  );
}
