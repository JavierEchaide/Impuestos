/**
 * Reparto de un importe (en céntimos) entre participantes.
 *
 * Los cuatro tipos de reparto acaban en el mismo algoritmo: el método del
 * mayor resto (Hamilton) sobre unos pesos enteros. Garantiza que la suma de
 * las partes es EXACTAMENTE el total y que el resultado es determinista.
 */

import { MAX_AMOUNT_CENTS } from "./cents";

export const SPLIT_TYPES = ["equal", "exact", "percent", "shares"] as const;
export type SplitType = (typeof SPLIT_TYPES)[number];

/** Total de puntos básicos que debe sumar un reparto por porcentajes (100,00 %). */
export const PERCENT_TOTAL_BP = 10_000;

export type SplitErrorCode =
  | "NO_PARTICIPANTS"
  | "DUPLICATE_PARTICIPANT"
  | "INVALID_TOTAL"
  | "INVALID_VALUE"
  | "EXACT_SUM_MISMATCH"
  | "PERCENT_SUM_MISMATCH"
  | "ZERO_WEIGHT";

export class SplitError extends Error {
  constructor(
    public readonly code: SplitErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "SplitError";
  }
}

export interface SplitInput {
  userId: string;
  /**
   * - equal:   se ignora
   * - exact:   céntimos que paga esta persona
   * - percent: puntos básicos (33,33 % = 3333)
   * - shares:  centésimas de participación (1,5 = 150)
   */
  value?: number;
}

export interface SplitResult {
  userId: string;
  /** Parte final de esta persona, en céntimos. */
  amountCents: number;
  /** Peso/valor que se introdujo (para poder reeditar el gasto). */
  weight: number;
}

/** Hash FNV-1a de 32 bits: estable entre ejecuciones y plataformas. */
function hashSeed(seed: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

/**
 * Reparte `total` céntimos proporcionalmente a `weights` (enteros >= 0, al
 * menos uno > 0). El resto de céntimos se asigna a quienes tienen mayor parte
 * fraccionaria; los empates se resuelven según `order` (índices de menor a
 * mayor prioridad de recibir el céntimo extra).
 */
export function allocateByWeights(
  total: number,
  weights: number[],
  order: number[] = weights.map((_, i) => i),
): number[] {
  if (!Number.isSafeInteger(total) || total < 0 || total > MAX_AMOUNT_CENTS) {
    throw new SplitError("INVALID_TOTAL", "El importe no es válido.");
  }
  if (weights.length === 0) {
    throw new SplitError("NO_PARTICIPANTS", "Hace falta al menos un participante.");
  }
  let weightSum = 0;
  for (const w of weights) {
    if (!Number.isSafeInteger(w) || w < 0) {
      throw new SplitError("INVALID_VALUE", "Hay un valor de reparto no válido.");
    }
    weightSum += w;
  }
  if (weightSum === 0) {
    throw new SplitError("ZERO_WEIGHT", "Los pesos del reparto no pueden sumar cero.");
  }
  if (!Number.isSafeInteger(total * weightSum)) {
    throw new SplitError("INVALID_TOTAL", "Los valores del reparto son demasiado grandes.");
  }

  const base: number[] = [];
  const remainders: number[] = [];
  let distributed = 0;
  for (const w of weights) {
    const exact = total * w;
    const floor = Math.floor(exact / weightSum);
    base.push(floor);
    remainders.push(exact - floor * weightSum);
    distributed += floor;
  }

  let leftover = total - distributed;
  const rank = new Map(order.map((idx, position) => [idx, position]));
  const candidates = weights
    .map((w, index) => index)
    .filter((index) => weights[index] > 0)
    .sort(
      (a, b) =>
        remainders[b] - remainders[a] || (rank.get(a) ?? a) - (rank.get(b) ?? b),
    );

  for (const index of candidates) {
    if (leftover <= 0) break;
    base[index] += 1;
    leftover -= 1;
  }
  return base;
}

/**
 * Calcula la parte de cada participante.
 *
 * `seed` (p. ej. el id del gasto) rota quién recibe el céntimo sobrante, de
 * modo que no sea siempre la misma persona, pero siga siendo determinista.
 */
export function computeSplit(
  totalCents: number,
  type: SplitType,
  inputs: SplitInput[],
  seed?: string,
): SplitResult[] {
  if (inputs.length === 0) {
    throw new SplitError("NO_PARTICIPANTS", "Hace falta al menos un participante.");
  }
  if (!Number.isSafeInteger(totalCents) || totalCents < 0 || totalCents > MAX_AMOUNT_CENTS) {
    throw new SplitError("INVALID_TOTAL", "El importe no es válido.");
  }
  const ids = new Set<string>();
  for (const input of inputs) {
    if (ids.has(input.userId)) {
      throw new SplitError("DUPLICATE_PARTICIPANT", "Hay un participante repetido.");
    }
    ids.add(input.userId);
  }

  // Orden canónico por id, independiente del orden en que llegue la lista.
  const sorted = [...inputs].sort((a, b) => (a.userId < b.userId ? -1 : a.userId > b.userId ? 1 : 0));

  let weights: number[];
  switch (type) {
    case "equal":
      weights = sorted.map(() => 1);
      break;
    case "exact": {
      weights = sorted.map((i) => requireInt(i.value));
      const sum = weights.reduce((acc, w) => acc + w, 0);
      if (sum !== totalCents) {
        throw new SplitError(
          "EXACT_SUM_MISMATCH",
          "Los importes exactos deben sumar el total del gasto.",
        );
      }
      // El reparto exacto se respeta tal cual: no hay nada que redondear.
      return sorted.map((i, idx) => ({
        userId: i.userId,
        amountCents: weights[idx],
        weight: weights[idx],
      }));
    }
    case "percent": {
      weights = sorted.map((i) => requireInt(i.value));
      const sum = weights.reduce((acc, w) => acc + w, 0);
      if (sum !== PERCENT_TOTAL_BP) {
        throw new SplitError("PERCENT_SUM_MISMATCH", "Los porcentajes deben sumar 100 %.");
      }
      break;
    }
    case "shares":
      weights = sorted.map((i) => requireInt(i.value));
      break;
    default: {
      const never: never = type;
      throw new SplitError("INVALID_VALUE", `Tipo de reparto desconocido: ${String(never)}`);
    }
  }

  const n = sorted.length;
  const rotation = seed ? hashSeed(seed) % n : 0;
  const order = Array.from({ length: n }, (_, i) => (i + rotation) % n);

  const amounts = allocateByWeights(totalCents, weights, order);
  return sorted.map((input, idx) => ({
    userId: input.userId,
    amountCents: amounts[idx],
    weight: type === "equal" ? 1 : weights[idx],
  }));
}

function requireInt(value: number | undefined): number {
  if (value === undefined || !Number.isSafeInteger(value) || value < 0) {
    throw new SplitError("INVALID_VALUE", "Hay un valor de reparto no válido.");
  }
  return value;
}
