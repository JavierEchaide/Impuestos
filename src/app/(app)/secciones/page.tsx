import { Archive } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Money } from "@/components/money";
import { CreateSectionDialog } from "@/components/sections/create-section-dialog";
import { Badge } from "@/components/ui/badge";
import { requireUser } from "@/lib/auth/session";
import { buildOverview } from "@/lib/queries/overview";

export const metadata: Metadata = { title: "Secciones" };

export default async function SectionsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const me = await requireUser();
  const showArchived = (await searchParams).archivadas === "1";
  const overview = await buildOverview("simplificado", { includeArchived: showArchived });
  const sections = showArchived ? overview.sections : overview.sections.filter((s) => !s.section.archivedAt);

  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-bold">Secciones</h1>
        <CreateSectionDialog />
      </div>
      <p className="-mt-2 text-sm text-muted-foreground">
        Cada sección es una cuenta con nombre dentro del grupo, con sus propios gastos, saldos y pagos.
      </p>

      <ul className="flex flex-col gap-2">
        {sections.map(({ section, balances, movementCount }) => (
          <li key={section.id}>
            <Link
              href={`/secciones/${section.id}`}
              className="flex items-center justify-between gap-3 rounded-xl border bg-card p-4 transition-colors hover:bg-secondary"
            >
              <div className="min-w-0">
                <p className="flex items-center gap-2 font-medium">
                  <span className="truncate">{section.name}</span>
                  {section.archivedAt ? (
                    <Badge variant="outline">
                      <Archive className="mr-1 size-3" />
                      Archivada
                    </Badge>
                  ) : null}
                </p>
                <p className="text-xs text-muted-foreground">
                  {movementCount} {movementCount === 1 ? "movimiento" : "movimientos"}
                  {section.description ? ` · ${section.description}` : ""}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground">Tu saldo</p>
                <Money cents={balances[me.id] ?? 0} signed className="font-semibold" />
              </div>
            </Link>
          </li>
        ))}
        {sections.length === 0 ? (
          <li className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
            No hay secciones todavía. Crea una para empezar a repartir gastos.
          </li>
        ) : null}
      </ul>

      <Link
        href={showArchived ? "/secciones" : "/secciones?archivadas=1"}
        className="text-center text-sm text-muted-foreground underline underline-offset-4"
      >
        {showArchived ? "Ocultar secciones archivadas" : "Mostrar secciones archivadas"}
      </Link>
    </>
  );
}
