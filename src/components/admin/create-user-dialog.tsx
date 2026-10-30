"use client";

import { UserPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
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
import { createUserAction } from "@/lib/actions/admin";
import { createUserSchema } from "@/lib/validation/schemas";
import { TempPassword } from "./temp-password";

export function CreateUserDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [role, setRole] = useState<"member" | "admin">("member");
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<{ username: string; password: string } | null>(null);
  const [pending, startTransition] = useTransition();

  function reset() {
    setName("");
    setUsername("");
    setRole("member");
    setError(null);
    setCreated(null);
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    const parsed = createUserSchema.safeParse({ name, username, role });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Datos no válidos");
      return;
    }
    startTransition(async () => {
      const result = await createUserAction(parsed.data);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setCreated({ username: result.username, password: result.tempPassword });
      router.refresh();
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button type="button">
          <UserPlus />
          Nuevo usuario
        </Button>
      </DialogTrigger>
      <DialogContent>
        {created ? (
          <div className="flex flex-col gap-4">
            <DialogHeader>
              <DialogTitle>Usuario creado</DialogTitle>
              <DialogDescription>Apunta la contraseña antes de cerrar esta ventana.</DialogDescription>
            </DialogHeader>
            <TempPassword username={created.username} password={created.password} />
            <DialogFooter>
              <Button type="button" size="lg" onClick={() => setOpen(false)}>
                Hecho
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
            <DialogHeader>
              <DialogTitle>Nuevo usuario</DialogTitle>
              <DialogDescription>
                Se genera una contraseña temporal y la persona deberá cambiarla en su primer inicio de sesión.
              </DialogDescription>
            </DialogHeader>
            <Field label="Nombre" htmlFor="new-name">
              <Input id="new-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} autoFocus />
            </Field>
            <Field label="Nombre de usuario" htmlFor="new-username" hint="Minúsculas, números, punto o guion bajo.">
              <Input
                id="new-username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                maxLength={30}
              />
            </Field>
            <Field label="Rol" htmlFor="new-role">
              <NativeSelect id="new-role" value={role} onChange={(e) => setRole(e.target.value as "member" | "admin")}>
                <option value="member">Miembro</option>
                <option value="admin">Administrador</option>
              </NativeSelect>
            </Field>
            <FormError message={error} />
            <DialogFooter>
              <Button type="submit" size="lg" disabled={pending}>
                {pending ? "Creando…" : "Crear usuario"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
