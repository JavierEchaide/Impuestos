import { cn } from "@/lib/utils";

/** Marca de Cuentas Claras: un euro partido en dos mitades. */
export function Logo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={cn("size-12", className)} role="img" aria-label="Cuentas Claras">
      <rect width="64" height="64" rx="14" fill="#282828" />
      <path d="M32 12a20 20 0 0 0 0 40z" fill="#fabd2f" />
      <path d="M32 12a20 20 0 0 1 0 40z" fill="#b8bb26" />
      <path d="M22 28h18M22 36h18" stroke="#282828" strokeWidth="3.5" strokeLinecap="round" />
      <path d="M44 24.5a12.5 12.5 0 1 0 0 15" fill="none" stroke="#282828" strokeWidth="3.5" strokeLinecap="round" />
    </svg>
  );
}
