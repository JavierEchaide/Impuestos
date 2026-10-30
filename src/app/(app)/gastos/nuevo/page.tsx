import type { Metadata } from "next";
import Link from "next/link";
import { ExpenseForm } from "@/components/expenses/expense-form";
import { requireUser } from "@/lib/auth/session";
import { listSections } from "@/lib/queries/ledger";
import { listUsers } from "@/lib/queries/users";

export const metadata: Metadata = { title: "Añadir gasto" };

export default async function NewExpensePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const me = await requireUser();
  const sp = await searchParams;
  const requested = Array.isArray(sp.seccion) ? sp.seccion[0] : sp.seccion;

  const [users, sections] = await Promise.all([listUsers(), listSections()]);
  const people = users.filter((u) => u.active).map((u) => ({ id: u.id, name: u.name, color: u.color }));
  const sectionOptions = sections.map((s) => ({ id: s.id, name: s.name }));
  const sectionId = sectionOptions.find((s) => s.id === requested)?.id;

  return (
    <>
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Añadir gasto</h1>
        <Link href={sectionId ? `/secciones/${sectionId}` : "/"} className="text-sm text-muted-foreground underline underline-offset-4">
          Cancelar
        </Link>
      </div>
      <ExpenseForm mode="create" people={people} sections={sectionOptions} currentUserId={me.id} initial={{ sectionId }} />
    </>
  );
}
