import { formatEuros, formatSignedEuros } from "@/lib/money";
import { cn } from "@/lib/utils";

/** Importe en euros. Con `signed`, verde si te deben (+) y rojo si debes (-). */
export function Money({
  cents,
  signed = false,
  className,
}: {
  cents: number;
  signed?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "tabular whitespace-nowrap",
        signed && cents > 0 && "text-success",
        signed && cents < 0 && "text-destructive",
        className,
      )}
    >
      {(signed ? formatSignedEuros(cents) : formatEuros(cents)).replace(/ /g, " ")}
    </span>
  );
}
