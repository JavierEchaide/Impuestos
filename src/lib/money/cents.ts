/**
 * Utilidades de dinero. Todos los importes son enteros en céntimos de euro.
 * Nunca se usan floats para calcular: solo para mostrar con Intl.
 */

/** Importe máximo aceptado por operación (1.000.000,00 €) para evitar desbordes. */
export const MAX_AMOUNT_CENTS = 100_000_000;

const euroFormatter = new Intl.NumberFormat("es-ES", {
  style: "currency",
  currency: "EUR",
});

export function isValidCents(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value);
}

/** 1250 -> "12,50 €" */
export function formatEuros(cents: number): string {
  return euroFormatter.format(cents / 100);
}

/** 1250 -> "+12,50 €", -1250 -> "-12,50 €", 0 -> "0,00 €" */
export function formatSignedEuros(cents: number): string {
  if (cents === 0) return formatEuros(0);
  return `${cents > 0 ? "+" : "-"}${formatEuros(Math.abs(cents))}`;
}

/** 1250 -> "12,50" (para rellenar inputs) */
export function centsToInput(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  const euros = Math.floor(abs / 100);
  const rest = String(abs % 100).padStart(2, "0");
  return `${sign}${euros},${rest}`;
}

/**
 * Convierte texto decimal a un entero escalado a `decimals` cifras decimales,
 * sin pasar por floats. Acepta coma o punto decimal y el punto como separador
 * de miles (formato es-ES). Devuelve null si no es válido.
 */
function parseDecimalToScaled(input: string, decimals: number): number | null {
  const text = input.replace(/[\s€% ]/g, "");
  if (text === "" || text.startsWith("-") || text.startsWith("+")) return null;

  const lastComma = text.lastIndexOf(",");
  const lastDot = text.lastIndexOf(".");

  let intPart: string;
  let fracPart = "";

  if (lastComma !== -1) {
    // La coma es el separador decimal; los puntos anteriores son miles.
    intPart = text.slice(0, lastComma);
    fracPart = text.slice(lastComma + 1);
    if (intPart.includes(",")) return null;
    intPart = intPart.replace(/\./g, "");
  } else if (lastDot !== -1) {
    const dots = text.split(".").length - 1;
    const after = text.slice(lastDot + 1);
    // "1.234" o "1.234.567" -> miles; "12.5" o "12.50" -> decimal.
    const looksLikeThousands = dots > 1 || after.length === 3;
    if (looksLikeThousands) {
      intPart = text.replace(/\./g, "");
    } else {
      intPart = text.slice(0, lastDot);
      fracPart = after;
    }
  } else {
    intPart = text;
  }

  if (!/^\d+$/.test(intPart === "" ? "0" : intPart)) return null;
  if (fracPart !== "" && !/^\d+$/.test(fracPart)) return null;
  if (fracPart.length > decimals) return null;

  const scale = 10 ** decimals;
  const intValue = Number(intPart === "" ? "0" : intPart);
  const fracValue = Number(fracPart.padEnd(decimals, "0") || "0");
  const total = intValue * scale + fracValue;
  return Number.isSafeInteger(total) ? total : null;
}

/** "12,50" | "12.5" | "1.234,56" -> céntimos. null si es inválido o negativo. */
export function parseEuros(input: string): number | null {
  return parseDecimalToScaled(input, 2);
}

/** "33,33" -> 3333 (centésimas de porcentaje, "puntos básicos"). */
export function parsePercentToBp(input: string): number | null {
  return parseDecimalToScaled(input, 2);
}

/** 3333 -> "33,33"; 5000 -> "50" */
export function bpToInput(bp: number): string {
  return centiSharesToInput(bp);
}

/** "1,5" -> 150 (centésimas de participación). */
export function parseSharesToCenti(input: string): number | null {
  return parseDecimalToScaled(input, 2);
}

/** 150 -> "1,5"; 200 -> "2" */
export function centiSharesToInput(centi: number): string {
  const whole = Math.floor(centi / 100);
  const frac = String(centi % 100).padStart(2, "0").replace(/0+$/, "");
  return frac === "" ? String(whole) : `${whole},${frac}`;
}
