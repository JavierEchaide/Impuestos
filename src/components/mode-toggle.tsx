import Link from "next/link";
import { cn } from "@/lib/utils";
import type { DebtMode } from "@/lib/queries/overview";

/** Alterna entre deudas simplificadas (mínimas transferencias) y directas (persona a persona). */
export function ModeToggle({ mode, basePath, extra = {} }: { mode: DebtMode; basePath: string; extra?: Record<string, string> }) {
  const href = (value: DebtMode) => {
    const params = new URLSearchParams({ ...extra, modo: value });
    return `${basePath}?${params.toString()}`;
  };
  const item = (value: DebtMode, label: string) => (
    <Link
      href={href(value)}
      replace
      scroll={false}
      aria-current={mode === value ? "true" : undefined}
      className={cn(
        "flex-1 rounded-md px-3 py-1.5 text-center text-sm font-medium transition-colors",
        mode === value ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent",
      )}
    >
      {label}
    </Link>
  );
  return (
    <div className="flex rounded-lg bg-secondary p-1" role="group" aria-label="Tipo de deudas">
      {item("simplificado", "Simplificadas")}
      {item("directo", "Directas")}
    </div>
  );
}
