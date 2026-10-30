"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type ReactNode } from "react";
import { toast } from "sonner";
import { FormError } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { ButtonProps } from "@/components/ui/button-props";

/** Botón con confirmación que ejecuta una server action `{ id }` y refresca (o navega) al terminar. */
export function ConfirmActionButton({
  action,
  id,
  extra,
  label,
  icon,
  title,
  description,
  confirmLabel,
  successMessage,
  variant = "outline",
  size = "sm",
  destructive = false,
  redirectTo,
  iconOnly = false,
}: {
  action: (input: { id: string } & Record<string, unknown>) => Promise<{ ok: true } | { ok: false; error: string }>;
  id: string;
  /** Campos extra que se envían junto al id (p. ej. `{ active: false }`). */
  extra?: Record<string, unknown>;
  label: string;
  icon?: ReactNode;
  title: string;
  description: string;
  confirmLabel: string;
  successMessage: string;
  variant?: ButtonProps["variant"];
  size?: ButtonProps["size"];
  destructive?: boolean;
  redirectTo?: string;
  iconOnly?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function confirm() {
    setError(null);
    startTransition(async () => {
      const result = await action({ id, ...extra });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      toast.success(successMessage);
      setOpen(false);
      if (redirectTo) router.push(redirectTo);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant={variant} size={size} aria-label={iconOnly ? label : undefined}>
          {icon}
          {iconOnly ? null : label}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <FormError message={error} />
        <DialogFooter>
          <Button type="button" variant={destructive ? "destructive" : "default"} size="lg" onClick={confirm} disabled={pending}>
            {pending ? "Un momento…" : confirmLabel}
          </Button>
          <DialogClose asChild>
            <Button type="button" variant="outline" size="lg">
              Cancelar
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
