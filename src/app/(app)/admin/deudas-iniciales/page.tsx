import type { Metadata } from "next";
import Link from "next/link";
import { InitialDebtsForm } from "@/components/admin/initial-debts-form";
import { requireAdmin } from "@/lib/auth/session";
import { listSections } from "@/lib/queries/ledger";
import { listUsers } from "@/lib/queries/users";

export const metadata: Metadata = { title: "Deudas iniciales" };

export default async function InitialDebtsPage() {
  await requireAdmin();
  const [users, sections] = await Promise.all([listUsers(), listSections()]);
  const people = users.filter((u) => u.active).map((u) => ({ id: u.id, name: u.name, color: u.color }));

  return (
    <>
      <Link href="/ajustes" className="text-sm text-muted-foreground underline underline-offset-4">
        ← Ajustes
      </Link>
      <div>
        <h1 className="text-xl font-bold">Deudas iniciales</h1>
        <p className="text-sm text-muted-foreground">
          Carga lo que ya se debe hoy. Cada deuda se registra como un gasto normal pagado por quien cobra y repartido al
          100 % a quien debe, con la categoría «Deuda inicial», así que entra en el mismo cálculo de saldos.
        </p>
      </div>
      <InitialDebtsForm people={people} sections={sections.map((s) => ({ id: s.id, name: s.name }))} />
    </>
  );
}
