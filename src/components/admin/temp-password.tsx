"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

/** Muestra una contraseña temporal UNA sola vez, con botón para copiarla. */
export function TempPassword({ username, password }: { username: string; password: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(password);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Si el portapapeles no está disponible, la contraseña sigue visible para copiarla a mano.
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-warning/50 bg-warning/10 p-4" role="status">
      <p className="text-sm font-medium">
        Contraseña temporal de <strong>@{username}</strong>
      </p>
      <p className="select-all break-all rounded-lg bg-background px-3 py-2 text-center font-mono text-lg font-semibold tracking-wide">
        {password}
      </p>
      <Button type="button" variant="outline" onClick={copy}>
        {copied ? <Check /> : <Copy />}
        {copied ? "Copiada" : "Copiar contraseña"}
      </Button>
      <p className="text-xs text-muted-foreground">
        Se muestra una sola vez y no se guarda. Pásasela a esa persona: tendrá que cambiarla al entrar.
      </p>
    </div>
  );
}
