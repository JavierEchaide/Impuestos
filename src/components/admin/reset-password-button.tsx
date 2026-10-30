"use client";

import { KeyRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
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
import { resetPasswordAction } from "@/lib/actions/admin";
import { TempPassword } from "./temp-password";

export function ResetPasswordButton({ id, name, username }: { id: string; name: string; username: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function confirm() {
    setError(null);
    startTransition(async () => {
      const result = await resetPasswordAction({ id });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setPassword(result.tempPassword);
      router.refresh();
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          setPassword(null);
          setError(null);
        }
      }}
    >
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm">
          <KeyRound />
          Restablecer
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Restablecer contraseña de {name}</DialogTitle>
          <DialogDescription>
            Se generará una contraseña temporal nueva, se cerrarán sus sesiones abiertas y tendrá que cambiarla al entrar.
          </DialogDescription>
        </DialogHeader>
        {password ? <TempPassword username={username} password={password} /> : null}
        <FormError message={error} />
        <DialogFooter>
          {password ? (
            <DialogClose asChild>
              <Button type="button" size="lg">
                Hecho
              </Button>
            </DialogClose>
          ) : (
            <Button type="button" size="lg" onClick={confirm} disabled={pending}>
              {pending ? "Generando…" : "Generar contraseña temporal"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
