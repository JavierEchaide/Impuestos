import { WifiOff } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Sin conexión" };

export default function OfflinePage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col items-center justify-center gap-4 px-6 text-center">
      <WifiOff className="size-12 text-muted-foreground" aria-hidden />
      <h1 className="text-xl font-bold">Sin conexión</h1>
      <p className="text-sm text-muted-foreground">
        Cuentas Claras necesita internet para mostrar los saldos al día. Vuelve a intentarlo cuando tengas
        conexión.
      </p>
    </main>
  );
}
