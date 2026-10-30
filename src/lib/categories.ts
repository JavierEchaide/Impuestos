/** Categorías fijas de la primera versión. */
export const USER_CATEGORIES = [
  { key: "comida", label: "Comida" },
  { key: "casa", label: "Casa" },
  { key: "viaje", label: "Viaje" },
  { key: "ocio", label: "Ocio" },
  { key: "transporte", label: "Transporte" },
  { key: "otros", label: "Otros" },
] as const;

/** Categorías de sistema: no se eligen al crear un gasto normal. */
export const SYSTEM_CATEGORIES = [
  { key: "deuda_inicial", label: "Deuda inicial" },
  { key: "pago", label: "Pago" },
] as const;

export const ALL_CATEGORIES = [...USER_CATEGORIES, ...SYSTEM_CATEGORIES] as const;

export type UserCategoryKey = (typeof USER_CATEGORIES)[number]["key"];
export type CategoryKey = (typeof ALL_CATEGORIES)[number]["key"];

export const USER_CATEGORY_KEYS = USER_CATEGORIES.map((c) => c.key) as [
  UserCategoryKey,
  ...UserCategoryKey[],
];
/** Gastos: las categorías de usuario más "deuda_inicial" (solo la crea el admin). */
export const EXPENSE_CATEGORY_KEYS = [...USER_CATEGORY_KEYS, "deuda_inicial"] as [
  UserCategoryKey | "deuda_inicial",
  ...(UserCategoryKey | "deuda_inicial")[],
];

export const INITIAL_DEBT_CATEGORY = "deuda_inicial" as const;
export const PAYMENT_CATEGORY = "pago" as const;

export function categoryLabel(key: string): string {
  return ALL_CATEGORIES.find((c) => c.key === key)?.label ?? key;
}
