import { UserCheck, UserX } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { CreateUserDialog } from "@/components/admin/create-user-dialog";
import { ResetPasswordButton } from "@/components/admin/reset-password-button";
import { ConfirmActionButton } from "@/components/confirm-action-button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { UserAvatar } from "@/components/user-avatar";
import { setUserActiveAction } from "@/lib/actions/admin";
import { requireAdmin } from "@/lib/auth/session";
import { listUsers } from "@/lib/queries/users";

export const metadata: Metadata = { title: "Usuarios" };

export default async function UsersAdminPage() {
  const me = await requireAdmin();
  const users = await listUsers();

  return (
    <>
      <Link href="/ajustes" className="text-sm text-muted-foreground underline underline-offset-4">
        ← Ajustes
      </Link>
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-bold">Usuarios</h1>
        <CreateUserDialog />
      </div>
      <p className="-mt-2 text-sm text-muted-foreground">
        No hay registro público: solo tú puedes crear usuarios y restablecer contraseñas.
      </p>

      <ul className="flex flex-col gap-3">
        {users.map((u) => (
          <li key={u.id}>
            <Card className="flex flex-col gap-3 p-4">
              <div className="flex items-center gap-3">
                <UserAvatar name={u.name} color={u.color} size="lg" />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold leading-tight">
                    {u.name} {u.id === me.id ? <span className="text-muted-foreground">(tú)</span> : null}
                  </p>
                  <p className="text-sm text-muted-foreground">@{u.username}</p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    <Badge variant={u.role === "admin" ? "default" : "secondary"}>
                      {u.role === "admin" ? "Administrador" : "Miembro"}
                    </Badge>
                    {!u.active ? <Badge variant="destructive">Desactivado</Badge> : null}
                    {u.active && u.mustChangePassword ? <Badge variant="outline">Pendiente de cambiar contraseña</Badge> : null}
                  </div>
                </div>
              </div>
              {u.id !== me.id ? (
                <div className="flex flex-wrap gap-2">
                  <ResetPasswordButton id={u.id} name={u.name} username={u.username} />
                  {u.active ? (
                    <ConfirmActionButton
                      action={setUserActiveAction}
                      id={u.id}
                      extra={{ active: false }}
                      label="Desactivar"
                      icon={<UserX />}
                      destructive
                      title={`¿Desactivar a ${u.name}?`}
                      description="No podrá iniciar sesión ni aparecer en gastos nuevos. Su historial y sus saldos se conservan."
                      confirmLabel="Desactivar"
                      successMessage={`${u.name} desactivado`}
                    />
                  ) : (
                    <ConfirmActionButton
                      action={setUserActiveAction}
                      id={u.id}
                      extra={{ active: true }}
                      label="Reactivar"
                      icon={<UserCheck />}
                      title={`¿Reactivar a ${u.name}?`}
                      description="Podrá volver a iniciar sesión. Si no recuerda su contraseña, restablécela."
                      confirmLabel="Reactivar"
                      successMessage={`${u.name} reactivado`}
                    />
                  )}
                </div>
              ) : null}
            </Card>
          </li>
        ))}
      </ul>
    </>
  );
}
