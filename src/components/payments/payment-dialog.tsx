"use client";

import { HandCoins } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition, type ReactNode } from "react";
import { toast } from "sonner";
import { Field, FormError } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { createPaymentAction } from "@/lib/actions/payments";
import { todayInMadrid } from "@/lib/format";
import { centsToInput, formatEuros, parseEuros } from "@/lib/money";
import { paymentSchema } from "@/lib/validation/schemas";
import type { ButtonProps } from "@/components/ui/button-props";

interface PersonOption {
  id: string;
  name: string;
}

/**
 * Registra un pago de A a B en una sección ("Ya he pagado"). Con `lockParties`
 * las personas vienen fijadas por una deuda concreta; sin él se pueden elegir.
 */
export function PaymentDialog({
  sectionId,
  sectionName,
  people,
  currentUserId,
  fromId,
  toId,
  amountCents,
  lockParties = false,
  trigger,
  title = "Registrar pago",
}: {
  sectionId: string;
  sectionName: string;
  people: PersonOption[];
  currentUserId: string;
  fromId?: string;
  toId?: string;
  amountCents?: number;
  lockParties?: boolean;
  trigger: { label: string; variant?: ButtonProps["variant"]; size?: ButtonProps["size"]; icon?: ReactNode };
  title?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState(fromId ?? currentUserId);
  const [to, setTo] = useState(toId ?? people.find((p) => p.id !== (fromId ?? currentUserId))?.id ?? "");
  const [amount, setAmount] = useState(amountCents ? centsToInput(amountCents) : "");
  const [date, setDate] = useState(todayInMadrid());
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const nameOf = (id: string) => people.find((p) => p.id === id)?.name ?? "?";

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    const cents = parseEuros(amount);
    if (cents === null) {
      setError("Escribe un importe válido, por ejemplo 4,50");
      return;
    }
    const parsed = paymentSchema.safeParse({ sectionId, fromUserId: from, toUserId: to, amountCents: cents, date });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Datos no válidos");
      return;
    }
    startTransition(async () => {
      const result = await createPaymentAction(parsed.data);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      toast.success(`Pago de ${formatEuros(cents).replace(/ /g, " ")} registrado`);
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant={trigger.variant ?? "default"} size={trigger.size ?? "sm"}>
          {trigger.icon ?? <HandCoins />}
          {trigger.label}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>
              {lockParties
                ? `${nameOf(from)} paga a ${nameOf(to)} · ${sectionName}`
                : `Sección: ${sectionName}`}
            </DialogDescription>
          </DialogHeader>

          {!lockParties ? (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Quién paga" htmlFor="pay-from">
                <NativeSelect id="pay-from" value={from} onChange={(e) => setFrom(e.target.value)}>
                  {people.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
              <Field label="Quién cobra" htmlFor="pay-to">
                <NativeSelect id="pay-to" value={to} onChange={(e) => setTo(e.target.value)}>
                  {people.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
            </div>
          ) : null}

          <div className="grid grid-cols-2 gap-3">
            <Field label="Importe (€)" htmlFor="pay-amount" hint="Puedes pagar solo una parte.">
              <Input
                id="pay-amount"
                inputMode="decimal"
                autoComplete="off"
                placeholder="0,00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </Field>
            <Field label="Fecha" htmlFor="pay-date">
              <Input id="pay-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </Field>
          </div>

          <FormError message={error} />
          <DialogFooter>
            <Button type="submit" size="lg" disabled={pending}>
              {pending ? "Guardando…" : "Confirmar pago"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
