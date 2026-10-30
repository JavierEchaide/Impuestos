import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth/login-form";
import { Logo } from "@/components/logo";
import { getCurrentUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Entrar" };

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) redirect("/");

  return (
    <>
      <div className="flex flex-col items-center gap-3 text-center">
        <Logo className="size-16" />
        <div>
          <h1 className="text-2xl font-bold">Cuentas Claras</h1>
          <p className="text-sm text-muted-foreground">Inicia sesión para ver los gastos del grupo.</p>
        </div>
      </div>
      <LoginForm />
      <p className="text-center text-xs text-muted-foreground">
        ¿Sin cuenta o sin contraseña? Pídeselo al administrador: no hay registro público.
      </p>
    </>
  );
}
