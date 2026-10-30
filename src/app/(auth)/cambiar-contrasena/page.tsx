import type { Metadata } from "next";
import Link from "next/link";
import { ChangePasswordForm } from "@/components/auth/change-password-form";
import { Logo } from "@/components/logo";
import { requireUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Cambiar contraseña" };

export default async function ChangePasswordPage() {
  const user = await requireUser({ allowMustChange: true });

  return (
    <>
      <div className="flex flex-col items-center gap-3 text-center">
        <Logo className="size-14" />
        <div>
          <h1 className="text-xl font-bold">
            {user.mustChangePassword ? `Hola, ${user.name}` : "Cambiar contraseña"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {user.mustChangePassword
              ? "Por seguridad, cambia la contraseña temporal antes de continuar."
              : "Elige una contraseña nueva para tu cuenta."}
          </p>
        </div>
      </div>
      <ChangePasswordForm />
      {!user.mustChangePassword ? (
        <Link href="/ajustes" className="text-center text-sm text-muted-foreground underline">
          Volver a ajustes
        </Link>
      ) : null}
    </>
  );
}
