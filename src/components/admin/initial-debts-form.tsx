"use client";

import { Check } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Field, FormError } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { UserAvatar } from "@/components/user-avatar";
import { createInitialDebtsAction } from "@/lib/actions/admin";
import { formatEuros, parseEuros } from "@/lib/money";
import { cn } from "@/lib/utils";
import { initialDebtsSchema } from "@/lib/validation/schemas";

const NEW_SECTION = "__nueva__";

interface Person {
  id: string;
  name: string;
  color: string;
}

/**
 * Carga lo que ya se debe hoy. Cada deuda se guarda como un gasto normal pagado
 * por el acreedor y repartido al 100 % al deudor, con la categoría «Deuda inicial».
 */
export function InitialDebtsForm({
  people,
  sections,
}: {
  people: Person[];
  sections: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [sectionChoice, setSectionChoice] = useState(sections[0]?.id ?? NEW_SECTION);
  const [newSectionName, setNewSectionName] = useState("");
  const [creditorId, setCreditorId] = useState(people[0]?.id ?? "");
  const [title, setTitle] = useState("Deuda inicial");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const debtors = people.filter((p) => p.id !== creditorId);
  const creditorName = people.find((p) => p.id === creditorId)?.name ?? "?";

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    const debts: { debtorId: string; amountCents: number }[] = [];
    for (const person of debtors) {
      if (!selected.has(person.id)) continue;
      const cents = parseEuros(amounts[person.id] ?? "");
      if (cents === null) {
        setError(`Escribe un importe válido para ${person.name}, por ejemplo 4,50`);
        return;
      }
      debts.push({ debtorId: person.id, amountCents: cents });
    }

    const isNew = sectionChoice === NEW_SECTION;
    const parsed = initialDebtsSchema.safeParse({
      sectionId: isNew ? undefined : sectionChoice,
      newSectionName: isNew ? newSectionName : undefined,
      creditorId,
      title,
      debts,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Revisa los datos");
      return;
    }

    startTransition(async () => {
      const result = await createInitialDebtsAction(parsed.data);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      toast.success(`${result.created} ${result.created === 1 ? "deuda cargada" : "deudas cargadas"}`);
      router.push(`/secciones/${result.sectionId}`);
      router.refresh();
    });
  }

  const total = [...selected].reduce((acc, id) => acc + (parseEuros(amounts[id] ?? "") ?? 0), 0);

  return (
    <form onSubmit={submit} className="flex flex-col gap-5" noValidate>
      <Field label="Sección" htmlFor="debt-section">
        <NativeSelect id="debt-section" value={sectionChoice} onChange={(e) => setSectionChoice(e.target.value)}>
          {sections.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
          <option value={NEW_SECTION}>Nueva sección…</option>
        </NativeSelect>
      </Field>
      {sectionChoice === NEW_SECTION ? (
        <Field label="Nombre de la sección nueva" htmlFor="debt-new-section">
          <Input
            id="debt-new-section"
            value={newSectionName}
            onChange={(e) => setNewSectionName(e.target.value)}
            maxLength={60}
            placeholder="Arepas casa Javi"
          />
        </Field>
      ) : null}

      <Field label="Quién cobra (acreedor)" htmlFor="debt-creditor">
        <NativeSelect
          id="debt-creditor"
          value={creditorId}
          onChange={(e) => {
            setCreditorId(e.target.value);
            setSelected((prev) => {
              const next = new Set(prev);
              next.delete(e.target.value);
              return next;
            });
          }}
        >
          {people.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </NativeSelect>
      </Field>

      <Field label="Concepto" htmlFor="debt-title">
        <Input id="debt-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} />
      </Field>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium">Quién le debe a {creditorName}</legend>
        <ul className="divide-y rounded-xl border bg-card">
          {debtors.map((p) => {
            const isSelected = selected.has(p.id);
            return (
              <li key={p.id} className="flex items-center gap-3 px-3 py-2">
                <button
                  type="button"
                  onClick={() => toggle(p.id)}
                  aria-pressed={isSelected}
                  className="flex min-w-0 flex-1 items-center gap-3 text-left"
                >
                  <span
                    className={cn(
                      "flex size-6 shrink-0 items-center justify-center rounded-md border-2",
                      isSelected ? "border-primary bg-primary text-primary-foreground" : "border-input",
                    )}
                  >
                    {isSelected ? <Check className="size-4" strokeWidth={3} /> : null}
                  </span>
                  <UserAvatar name={p.name} color={p.color} size="sm" />
                  <span className="truncate font-medium">{p.name}</span>
                </button>
                {isSelected ? (
                  <Input
                    inputMode="decimal"
                    autoComplete="off"
                    placeholder="0,00"
                    aria-label={`Importe que debe ${p.name}`}
                    value={amounts[p.id] ?? ""}
                    onChange={(e) => setAmounts((prev) => ({ ...prev, [p.id]: e.target.value }))}
                    className="h-9 w-28 text-right tabular"
                  />
                ) : null}
              </li>
            );
          })}
        </ul>
        {selected.size > 0 ? (
          <p className="text-sm text-muted-foreground">
            Total a cobrar: <strong className="text-foreground">{formatEuros(total).replace(/ /g, " ")}</strong>
          </p>
        ) : null}
      </fieldset>

      <FormError message={error} />
      <Button type="submit" size="lg" disabled={pending}>
        {pending ? "Cargando…" : "Cargar deudas"}
      </Button>
    </form>
  );
}
