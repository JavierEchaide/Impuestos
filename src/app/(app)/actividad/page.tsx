import type { Metadata } from "next";
import Link from "next/link";
import { NativeSelect } from "@/components/ui/native-select";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/form-field";
import { UserAvatar } from "@/components/user-avatar";
import { isAdmin, requireUser } from "@/lib/auth/session";
import { formatDateTime } from "@/lib/format";
import { listActivity } from "@/lib/queries/detail";
import { listSections } from "@/lib/queries/ledger";
import { listUsers, userMap } from "@/lib/queries/users";

export const metadata: Metadata = { title: "Actividad" };

const PAGE_SIZE = 40;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || undefined;

export default async function ActivityPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const me = await requireUser();
  const admin = isAdmin(me);
  const sp = await searchParams;
  const sectionId = first(sp.seccion);
  const beforeRaw = first(sp.antes);
  const before = beforeRaw && !Number.isNaN(Date.parse(beforeRaw)) ? new Date(beforeRaw) : undefined;

  const [users, sections, rows] = await Promise.all([
    listUsers(),
    listSections({ includeArchived: true }),
    listActivity({ sectionId, includeAdminOnly: admin, before, limit: PAGE_SIZE + 1 }),
  ]);
  const usersById = userMap(users);
  const hasMore = rows.length > PAGE_SIZE;
  const page = rows.slice(0, PAGE_SIZE);
  const nextCursor = hasMore ? page[page.length - 1].createdAt.toISOString() : null;

  return (
    <>
      <div>
        <h1 className="text-xl font-bold">Actividad</h1>
        <p className="text-sm text-muted-foreground">
          {admin
            ? "Historial completo: gastos, pagos, comentarios, secciones y gestión de usuarios."
            : "Quién ha creado, editado o borrado gastos, pagos y comentarios."}
        </p>
      </div>

      <form action="/actividad" method="get" className="flex items-end gap-2">
        <Field label="Sección" htmlFor="seccion" className="flex-1">
          <NativeSelect id="seccion" name="seccion" defaultValue={sectionId ?? ""}>
            <option value="">Todas</option>
            {sections.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Button type="submit" variant="outline">
          Filtrar
        </Button>
      </form>

      <ul className="flex flex-col gap-3">
        {page.map((entry) => {
          const actor = usersById.get(entry.actorId);
          const href =
            entry.entityType === "expense"
              ? `/gastos/${entry.entityId}`
              : entry.sectionId
                ? `/secciones/${entry.sectionId}`
                : null;
          const details = admin && entry.details ? JSON.stringify(entry.details, null, 2) : null;
          return (
            <li key={entry.id} className="flex gap-3">
              <UserAvatar name={actor?.name ?? "?"} color={actor?.color ?? "#928374"} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="text-sm leading-snug break-words">
                  {href ? (
                    <Link href={href} className="hover:underline">
                      {entry.summary}
                    </Link>
                  ) : (
                    entry.summary
                  )}
                </p>
                <p className="text-xs text-muted-foreground">{formatDateTime(entry.createdAt)}</p>
                {details ? (
                  <details className="mt-1 text-xs">
                    <summary className="cursor-pointer text-muted-foreground">Ver detalle</summary>
                    <pre className="mt-1 max-h-48 overflow-auto rounded-md bg-secondary p-2 text-[11px] leading-snug">{details}</pre>
                  </details>
                ) : null}
              </div>
            </li>
          );
        })}
        {page.length === 0 ? (
          <li className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
            Todavía no hay actividad.
          </li>
        ) : null}
      </ul>

      {nextCursor ? (
        <Button asChild variant="outline">
          <Link href={`/actividad?${new URLSearchParams({ ...(sectionId ? { seccion: sectionId } : {}), antes: nextCursor })}`}>
            Ver más antiguos
          </Link>
        </Button>
      ) : null}
    </>
  );
}
