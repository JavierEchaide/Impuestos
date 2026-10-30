import { Search } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { MovementList } from "@/components/movement-list";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Field } from "@/components/form-field";
import { requireUser } from "@/lib/auth/session";
import { ALL_CATEGORIES } from "@/lib/categories";
import { listSections } from "@/lib/queries/ledger";
import { listMovements } from "@/lib/queries/movements";
import { listUsers, userMap } from "@/lib/queries/users";
import { movementFiltersSchema } from "@/lib/validation/schemas";

export const metadata: Metadata = { title: "Movimientos" };

type Params = Record<string, string | string[] | undefined>;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || undefined;

export default async function MovementsPage({ searchParams }: { searchParams: Promise<Params> }) {
  const me = await requireUser();
  const sp = await searchParams;

  const parsed = movementFiltersSchema.safeParse({
    q: first(sp.q),
    section: first(sp.seccion),
    person: first(sp.persona),
    category: first(sp.categoria),
    from: first(sp.desde),
    to: first(sp.hasta),
  });
  const filters = parsed.success ? parsed.data : {};

  const [users, sections, movements] = await Promise.all([
    listUsers(),
    listSections({ includeArchived: true }),
    listMovements(filters, 100),
  ]);
  const usersById = userMap(users);
  const hasFilters = Object.values(filters).some(Boolean);

  return (
    <>
      <h1 className="text-xl font-bold">Movimientos</h1>

      <form action="/gastos" method="get" className="flex flex-col gap-3 rounded-xl border bg-card p-4">
        <Field label="Buscar" htmlFor="q">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input id="q" name="q" defaultValue={filters.q ?? ""} placeholder="Título o nota" className="pl-9" />
          </div>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Sección" htmlFor="seccion">
            <NativeSelect id="seccion" name="seccion" defaultValue={filters.section ?? ""}>
              <option value="">Todas</option>
              {sections.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Persona" htmlFor="persona">
            <NativeSelect id="persona" name="persona" defaultValue={filters.person ?? ""}>
              <option value="">Todas</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Categoría" htmlFor="categoria">
            <NativeSelect id="categoria" name="categoria" defaultValue={filters.category ?? ""}>
              <option value="">Todas</option>
              {ALL_CATEGORIES.map((c) => (
                <option key={c.key} value={c.key}>
                  {c.label}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <div className="hidden sm:block" />
          <Field label="Desde" htmlFor="desde">
            <Input id="desde" name="desde" type="date" defaultValue={filters.from ?? ""} />
          </Field>
          <Field label="Hasta" htmlFor="hasta">
            <Input id="hasta" name="hasta" type="date" defaultValue={filters.to ?? ""} />
          </Field>
        </div>
        <div className="flex gap-2">
          <Button type="submit" className="flex-1">
            <Search />
            Filtrar
          </Button>
          {hasFilters ? (
            <Button asChild variant="outline">
              <Link href="/gastos">Quitar filtros</Link>
            </Button>
          ) : null}
        </div>
      </form>

      <p className="text-sm text-muted-foreground">
        {movements.length} {movements.length === 1 ? "movimiento" : "movimientos"}
        {movements.length === 100 ? " (mostrando los 100 más recientes)" : ""}
      </p>
      <MovementList movements={movements} usersById={usersById} currentUserId={me.id} showSection />
    </>
  );
}
