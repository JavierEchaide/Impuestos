import { KeyRound, Landmark, LogOut, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { ThemeToggle } from "@/components/theme-toggle";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { UserAvatar } from "@/components/user-avatar";
import { logoutAction } from "@/lib/actions/auth";
import { isAdmin, requireUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Ajustes" };

export default async function SettingsPage() {
  const me = await requireUser();

  return (
    <>
      <Card>
        <CardContent className="flex items-center gap-4 p-5">
          <UserAvatar name={me.name} color={me.color} size="lg" />
          <div className="min-w-0">
            <p className="text-lg font-bold leading-tight">{me.name}</p>
            <p className="text-sm text-muted-foreground">@{me.username}</p>
            <Badge variant={isAdmin(me) ? "default" : "secondary"} className="mt-1">
              {isAdmin(me) ? "Administrador" : "Miembro"}
            </Badge>
          </div>
        </CardContent>
      </Card>

      <section className="flex flex-col gap-2" aria-labelledby="cuenta-titulo">
        <h2 id="cuenta-titulo" className="text-base font-semibold">
          Tu cuenta
        </h2>
        <Button asChild variant="outline" className="justify-start">
          <Link href="/cambiar-contrasena">
            <KeyRound />
            Cambiar contraseña
          </Link>
        </Button>
        <ThemeToggle withLabel />
        <form action={logoutAction}>
          <Button type="submit" variant="outline" className="w-full justify-start">
            <LogOut />
            Cerrar sesión
          </Button>
        </form>
      </section>

      {isAdmin(me) ? (
        <section className="flex flex-col gap-2" aria-labelledby="admin-titulo">
          <h2 id="admin-titulo" className="text-base font-semibold">
            Administración
          </h2>
          <Button asChild variant="outline" className="justify-start">
            <Link href="/admin/usuarios">
              <Users />
              Usuarios y contraseñas
            </Link>
          </Button>
          <Button asChild variant="outline" className="justify-start">
            <Link href="/admin/deudas-iniciales">
              <Landmark />
              Deudas iniciales
            </Link>
          </Button>
        </section>
      ) : null}

      <section className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
        <p className="font-medium text-foreground">Instalar en el móvil</p>
        <p>
          En Android (Chrome): menú ⋮ → «Instalar aplicación». En iPhone (Safari): botón Compartir → «Añadir a la
          pantalla de inicio».
        </p>
      </section>
    </>
  );
}
