"use client";

import { Check } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useSyncExternalStore, useTransition } from "react";
import { toast } from "sonner";
import { CategoryIcon } from "@/components/category-icon";
import { Field, FormError } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { UserAvatar } from "@/components/user-avatar";
import { createExpenseAction, updateExpenseAction } from "@/lib/actions/expenses";
import { USER_CATEGORIES, categoryLabel } from "@/lib/categories";
import { todayInMadrid } from "@/lib/format";
import {
  PERCENT_TOTAL_BP,
  SplitError,
  bpToInput,
  centiSharesToInput,
  centsToInput,
  computeSplit,
  formatEuros,
  parseEuros,
  parsePercentToBp,
  parseSharesToCenti,
  type SplitType,
} from "@/lib/money";
import { cn } from "@/lib/utils";
import { expenseSchema, expenseUpdateSchema } from "@/lib/validation/schemas";

export interface FormPerson {
  id: string;
  name: string;
  color: string;
}

export interface ExpenseFormInitial {
  id?: string;
  sectionId?: string;
  title?: string;
  amountCents?: number;
  date?: string;
  category?: string;
  paidBy?: string;
  splitType?: SplitType;
  note?: string | null;
  /** userId -> peso guardado (céntimos, puntos básicos o centésimas) */
  splits?: { userId: string; weight: number }[];
}

const SPLIT_TABS: { key: SplitType; label: string }[] = [
  { key: "equal", label: "Iguales" },
  { key: "exact", label: "Exactos" },
  { key: "percent", label: "%" },
  { key: "shares", label: "Partes" },
];

const LAST_SECTION_KEY = "cuentas:last-section";

const subscribeNoop = () => () => {};

function readLastSection(): string | null {
  try {
    return window.localStorage.getItem(LAST_SECTION_KEY);
  } catch {
    // localStorage puede no estar disponible (modo privado): se ignora.
    return null;
  }
}

const eur = (cents: number) => formatEuros(cents).replace(/ /g, " ");

function inputFromWeight(type: SplitType, weight: number): string {
  if (type === "exact") return centsToInput(weight);
  if (type === "percent") return bpToInput(weight);
  if (type === "shares") return centiSharesToInput(weight);
  return "";
}

export function ExpenseForm({
  mode,
  people,
  sections,
  currentUserId,
  initial,
}: {
  mode: "create" | "edit";
  people: FormPerson[];
  sections: { id: string; name: string }[];
  currentUserId: string;
  initial?: ExpenseFormInitial;
}) {
  const router = useRouter();
  const isEdit = mode === "edit";
  const initialType: SplitType = initial?.splitType ?? "equal";
  const isInitialDebt = initial?.category === "deuda_inicial";

  // Sección: la elegida por el usuario > la de la URL/edición > la última usada > la primera.
  const savedSection = useSyncExternalStore(subscribeNoop, readLastSection, () => null);
  const [sectionChoice, setSectionChoice] = useState<string | null>(initial?.sectionId ?? null);
  const sectionId =
    sectionChoice ??
    (savedSection && sections.some((s) => s.id === savedSection) ? savedSection : (sections[0]?.id ?? ""));
  const [title, setTitle] = useState(initial?.title ?? "");
  const [amount, setAmount] = useState(initial?.amountCents != null ? centsToInput(initial.amountCents) : "");
  const [date, setDate] = useState(initial?.date ?? todayInMadrid());
  const [category, setCategory] = useState(initial?.category ?? "comida");
  const [paidBy, setPaidBy] = useState(initial?.paidBy ?? currentUserId);
  const [splitType, setSplitType] = useState<SplitType>(initialType);
  const [note, setNote] = useState(initial?.note ?? "");
  const [showNote, setShowNote] = useState(Boolean(initial?.note));
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(initial?.splits?.map((s) => s.userId) ?? people.map((p) => p.id)),
  );
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries((initial?.splits ?? []).map((s) => [s.userId, inputFromWeight(initialType, s.weight)])),
  );
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();
  // Id del gasto: el cliente lo propone para que la vista previa coincida exactamente con lo guardado.
  const [clientId] = useState(() => crypto.randomUUID());
  const seed = initial?.id ?? clientId;

  const amountCents = parseEuros(amount);
  const participants = useMemo(() => people.filter((p) => selected.has(p.id)), [people, selected]);

  /** Valor entero de cada participante según el tipo de reparto (null si falta o es inválido). */
  const parsedValues = useMemo(() => {
    const out: Record<string, number | null> = {};
    for (const p of participants) {
      const raw = values[p.id] ?? "";
      if (splitType === "exact") out[p.id] = raw.trim() === "" ? null : parseEuros(raw);
      else if (splitType === "percent") out[p.id] = raw.trim() === "" ? null : parsePercentToBp(raw);
      else if (splitType === "shares") out[p.id] = raw.trim() === "" ? 100 : parseSharesToCenti(raw);
      else out[p.id] = null;
    }
    return out;
  }, [participants, values, splitType]);

  /** Vista previa del reparto y mensaje de ayuda con lo que falta. */
  const preview = useMemo(() => {
    if (amountCents === null || amountCents <= 0 || participants.length === 0) {
      return { parts: null as null | { userId: string; amountCents: number }[], hint: null as string | null };
    }
    try {
      const parts = computeSplit(
        amountCents,
        splitType,
        participants.map((p) => ({ userId: p.id, value: parsedValues[p.id] ?? undefined })),
        seed,
      );
      return { parts, hint: null };
    } catch (e) {
      if (!(e instanceof SplitError)) throw e;
      let hint = e.message;
      if (splitType === "exact") {
        const sum = participants.reduce((acc, p) => acc + (parsedValues[p.id] ?? 0), 0);
        const diff = amountCents - sum;
        hint = diff > 0 ? `Faltan ${eur(diff)} por repartir` : `Te pasas ${eur(-diff)}`;
      } else if (splitType === "percent") {
        const sum = participants.reduce((acc, p) => acc + (parsedValues[p.id] ?? 0), 0);
        const diff = PERCENT_TOTAL_BP - sum;
        hint = diff > 0 ? `Falta un ${bpToInput(diff)} %` : `Te pasas un ${bpToInput(-diff)} %`;
      }
      return { parts: null, hint };
    }
  }, [amountCents, participants, splitType, parsedValues, seed]);

  const shareOf = (id: string) => preview.parts?.find((p) => p.userId === id)?.amountCents;

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
    setFieldErrors({});

    if (amountCents === null) {
      setFieldErrors({ amountCents: "Escribe un importe válido, por ejemplo 12,50" });
      return;
    }
    const payload = {
      ...(isEdit ? { id: initial?.id } : { clientId }),
      sectionId,
      title,
      amountCents,
      date,
      category,
      paidBy,
      splitType,
      participants: participants.map((p) => ({ userId: p.id, value: parsedValues[p.id] ?? undefined })),
      note: note || undefined,
    };
    const schema = isEdit ? expenseUpdateSchema : expenseSchema;
    const parsed = schema.safeParse(payload);
    if (!parsed.success) {
      const errors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0] ?? "_");
        errors[key] ??= issue.message;
      }
      setFieldErrors(errors);
      setError(parsed.error.issues[0]?.message ?? "Revisa los datos");
      return;
    }

    startTransition(async () => {
      const result = isEdit ? await updateExpenseAction(parsed.data) : await createExpenseAction(parsed.data);
      if (!result.ok) {
        setError(result.error);
        if (result.fieldErrors) {
          const errors: Record<string, string> = {};
          for (const [key, messages] of Object.entries(result.fieldErrors)) errors[key.split(".")[0]] = messages[0];
          setFieldErrors(errors);
        }
        return;
      }
      try {
        window.localStorage.setItem(LAST_SECTION_KEY, result.sectionId);
      } catch {
        // Sin localStorage no pasa nada.
      }
      toast.success(isEdit ? "Gasto actualizado" : "Gasto añadido");
      router.push(isEdit ? `/gastos/${result.id}` : `/secciones/${result.sectionId}`);
      router.refresh();
    });
  }

  if (sections.length === 0) {
    return (
      <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
        Antes de añadir gastos hace falta una sección. Crea una en la pestaña «Secciones».
      </p>
    );
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-5" noValidate>
      {/* Lo imprescindible, en este orden: concepto, importe, quién pagó. */}
      <Field label="¿Qué has pagado?" htmlFor="title" error={fieldErrors.title}>
        <Input
          id="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Pizza, gasolina, alquiler…"
          maxLength={80}
          autoComplete="off"
          autoFocus={!isEdit}
          aria-invalid={!!fieldErrors.title}
        />
      </Field>

      <Field label="Importe (€)" htmlFor="amount" error={fieldErrors.amountCents}>
        <Input
          id="amount"
          inputMode="decimal"
          autoComplete="off"
          placeholder="0,00"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="h-14 text-2xl font-semibold tabular"
          aria-invalid={!!fieldErrors.amountCents}
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Pagó" htmlFor="paidBy" error={fieldErrors.paidBy}>
          <NativeSelect id="paidBy" value={paidBy} onChange={(e) => setPaidBy(e.target.value)}>
            {people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.id === currentUserId ? `${p.name} (yo)` : p.name}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Fecha" htmlFor="date" error={fieldErrors.date}>
          <Input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
      </div>

      {/* Reparto */}
      <fieldset className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <legend className="text-sm font-medium">Dividir entre</legend>
          <div className="flex gap-1">
            <Button type="button" variant="ghost" size="sm" onClick={() => setSelected(new Set(people.map((p) => p.id)))}>
              Todos
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setSelected(new Set())}>
              Ninguno
            </Button>
          </div>
        </div>

        <div role="tablist" aria-label="Tipo de reparto" className="flex rounded-lg bg-secondary p-1">
          {SPLIT_TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={splitType === tab.key}
              onClick={() => setSplitType(tab.key)}
              className={cn(
                "flex-1 rounded-md px-2 py-2 text-sm font-medium transition-colors",
                splitType === tab.key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent",
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <ul className="flex flex-col divide-y rounded-xl border bg-card">
          {people.map((p) => {
            const isSelected = selected.has(p.id);
            const share = shareOf(p.id);
            return (
              <li key={p.id} className="flex items-center gap-3 px-3 py-2">
                <button
                  type="button"
                  onClick={() => toggle(p.id)}
                  aria-pressed={isSelected}
                  aria-label={`${isSelected ? "Quitar a" : "Incluir a"} ${p.name}`}
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
                  <span className={cn("truncate font-medium", !isSelected && "text-muted-foreground")}>
                    {p.id === currentUserId ? `${p.name} (yo)` : p.name}
                  </span>
                </button>
                {isSelected && splitType !== "equal" ? (
                  <Input
                    inputMode="decimal"
                    autoComplete="off"
                    aria-label={`${splitType === "exact" ? "Importe" : splitType === "percent" ? "Porcentaje" : "Participaciones"} de ${p.name}`}
                    placeholder={splitType === "exact" ? "0,00" : splitType === "percent" ? "0" : "1"}
                    value={values[p.id] ?? ""}
                    onChange={(e) => setValues((prev) => ({ ...prev, [p.id]: e.target.value }))}
                    className="h-9 w-24 text-right tabular"
                  />
                ) : null}
                <span className="w-20 shrink-0 text-right text-sm tabular text-muted-foreground">
                  {isSelected && share !== undefined ? eur(share) : "—"}
                </span>
              </li>
            );
          })}
        </ul>

        {splitType !== "equal" ? (
          <p className="text-xs text-muted-foreground">
            {splitType === "exact" && "Escribe cuánto paga cada persona; deben sumar el total."}
            {splitType === "percent" && "Escribe el % de cada persona; deben sumar 100 %."}
            {splitType === "shares" && "Cada persona paga en proporción a sus partes (vacío = 1 parte)."}
          </p>
        ) : null}
        {preview.hint ? <p className="text-sm font-medium text-warning">{preview.hint}</p> : null}
        {fieldErrors.participants && !preview.hint ? (
          <p role="alert" className="text-sm text-destructive">
            {fieldErrors.participants}
          </p>
        ) : null}
      </fieldset>

      {/* Categoría */}
      {isInitialDebt ? (
        <p className="text-sm text-muted-foreground">
          Categoría: <strong>{categoryLabel("deuda_inicial")}</strong>
        </p>
      ) : (
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-sm font-medium">Categoría</legend>
          <div className="grid grid-cols-3 gap-2">
            {USER_CATEGORIES.map((c) => (
              <button
                key={c.key}
                type="button"
                aria-pressed={category === c.key}
                onClick={() => setCategory(c.key)}
                className={cn(
                  "flex flex-col items-center gap-1 rounded-lg border px-2 py-2 text-xs font-medium transition-colors",
                  category === c.key ? "border-primary bg-primary/15 text-primary" : "text-muted-foreground hover:bg-secondary",
                )}
              >
                <CategoryIcon category={c.key} className="size-5" />
                {c.label}
              </button>
            ))}
          </div>
        </fieldset>
      )}

      {sections.length > 1 || !isEdit ? (
        <Field label="Sección" htmlFor="section" error={fieldErrors.sectionId}>
          <NativeSelect id="section" value={sectionId} onChange={(e) => setSectionChoice(e.target.value)} disabled={isEdit}>
            {sections.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </NativeSelect>
        </Field>
      ) : null}

      {showNote ? (
        <Field label="Nota (opcional)" htmlFor="note" error={fieldErrors.note}>
          <Textarea id="note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} />
        </Field>
      ) : (
        <button type="button" onClick={() => setShowNote(true)} className="self-start text-sm text-primary underline underline-offset-4">
          Añadir una nota
        </button>
      )}

      <FormError message={error} />

      <Button type="submit" size="lg" className="h-14 text-base" disabled={pending}>
        {pending ? "Guardando…" : isEdit ? "Guardar cambios" : "Guardar gasto"}
      </Button>
    </form>
  );
}
