/**
 * Esquemas Zod compartidos entre cliente y servidor. Los importes viajan ya
 * como enteros (céntimos / puntos básicos / centésimas de participación).
 */
import { z } from "zod";
import { EXPENSE_CATEGORY_KEYS, USER_CATEGORY_KEYS } from "@/lib/categories";
import { MAX_AMOUNT_CENTS, SPLIT_TYPES, SplitError, computeSplit } from "@/lib/money";

export const MIN_PASSWORD = 10;
export const MAX_PASSWORD = 128;

const id = z.string().trim().min(1, "Falta un identificador").max(64);
const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha no válida")
  .refine((value) => {
    const d = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
  }, "Fecha no válida");
const cents = z
  .number({ error: "Importe no válido" })
  .int("Importe no válido")
  .min(1, "El importe debe ser mayor que 0")
  .max(MAX_AMOUNT_CENTS, "El importe es demasiado grande");
const optionalNote = z
  .string()
  .trim()
  .max(500, "Máximo 500 caracteres")
  .optional()
  .transform((v) => (v ? v : undefined));

/* ------------------------------ autenticación ----------------------------- */

export const loginSchema = z.object({
  username: z.string().trim().min(1, "Escribe tu usuario").max(30),
  password: z.string().min(1, "Escribe tu contraseña").max(MAX_PASSWORD),
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Escribe tu contraseña actual").max(MAX_PASSWORD),
    newPassword: z
      .string()
      .min(MIN_PASSWORD, `Mínimo ${MIN_PASSWORD} caracteres`)
      .max(MAX_PASSWORD, `Máximo ${MAX_PASSWORD} caracteres`),
    confirmPassword: z.string(),
  })
  .refine((v) => v.newPassword === v.confirmPassword, {
    path: ["confirmPassword"],
    message: "Las contraseñas no coinciden",
  })
  .refine((v) => v.newPassword !== v.currentPassword, {
    path: ["newPassword"],
    message: "La nueva contraseña debe ser distinta de la actual",
  });

/* --------------------------------- gastos --------------------------------- */

const participantSchema = z.object({
  userId: id,
  /** exact: céntimos · percent: puntos básicos · shares: centésimas · equal: ignorado */
  value: z.number().int().min(0).max(MAX_AMOUNT_CENTS * 10).optional(),
});

const expenseBase = z.object({
  sectionId: id,
  title: z.string().trim().min(1, "Pon un título").max(80, "Máximo 80 caracteres"),
  amountCents: cents,
  date: isoDate,
  category: z.enum(USER_CATEGORY_KEYS, { error: "Elige una categoría" }),
  paidBy: id,
  splitType: z.enum(SPLIT_TYPES),
  participants: z.array(participantSchema).min(1, "Elige al menos un participante").max(50),
  note: optionalNote,
});

/** Comprueba que el reparto es válido ejecutando el mismo cálculo que el servidor. */
function refineSplit(
  value: { amountCents: number; splitType: (typeof SPLIT_TYPES)[number]; participants: { userId: string; value?: number }[] },
  ctx: z.RefinementCtx,
) {
  try {
    computeSplit(value.amountCents, value.splitType, value.participants);
  } catch (error) {
    if (error instanceof SplitError) {
      ctx.addIssue({ code: "custom", path: ["participants"], message: error.message });
    } else {
      throw error;
    }
  }
}

export const expenseSchema = expenseBase.superRefine(refineSplit);
export type ExpenseInput = z.infer<typeof expenseSchema>;

export const expenseUpdateSchema = expenseBase
  .extend({
    id,
    // Los gastos de "Deuda inicial" conservan su categoría al editarlos.
    category: z.enum(EXPENSE_CATEGORY_KEYS, { error: "Elige una categoría" }),
  })
  .superRefine(refineSplit);
export type ExpenseUpdateInput = z.infer<typeof expenseUpdateSchema>;

export const idSchema = z.object({ id });

/* ---------------------------------- pagos --------------------------------- */

export const paymentSchema = z
  .object({
    sectionId: id,
    fromUserId: id,
    toUserId: id,
    amountCents: cents,
    date: isoDate,
    note: optionalNote,
  })
  .refine((v) => v.fromUserId !== v.toUserId, {
    path: ["toUserId"],
    message: "Quien paga y quien cobra deben ser personas distintas",
  });
export type PaymentInput = z.infer<typeof paymentSchema>;

/* ------------------------------- comentarios ------------------------------ */

export const commentSchema = z.object({
  expenseId: id,
  body: z.string().trim().min(1, "Escribe un comentario").max(1000, "Máximo 1000 caracteres"),
});

/* -------------------------------- secciones ------------------------------- */

export const sectionSchema = z.object({
  name: z.string().trim().min(2, "Mínimo 2 caracteres").max(60, "Máximo 60 caracteres"),
  description: z
    .string()
    .trim()
    .max(200, "Máximo 200 caracteres")
    .optional()
    .transform((v) => (v ? v : undefined)),
});

export const sectionUpdateSchema = sectionSchema.extend({ id });
export const sectionArchiveSchema = z.object({ id, archived: z.boolean() });

/* ----------------------------------- admin -------------------------------- */

export const USERNAME_REGEX = /^[a-z0-9_.]{3,30}$/;

export const createUserSchema = z.object({
  name: z.string().trim().min(2, "Mínimo 2 caracteres").max(40, "Máximo 40 caracteres"),
  username: z
    .string()
    .trim()
    .toLowerCase()
    .regex(USERNAME_REGEX, "3-30 caracteres: letras minúsculas, números, punto o guion bajo"),
  role: z.enum(["admin", "member"]),
});

export const setUserActiveSchema = z.object({ id, active: z.boolean() });

export const initialDebtsSchema = z
  .object({
    sectionId: id.optional(),
    newSectionName: z.string().trim().min(2).max(60).optional(),
    creditorId: id,
    title: z.string().trim().min(1, "Pon un concepto").max(80),
    debts: z
      .array(z.object({ debtorId: id, amountCents: cents }))
      .min(1, "Añade al menos una deuda")
      .max(20),
  })
  .refine((v) => Boolean(v.sectionId) !== Boolean(v.newSectionName), {
    path: ["sectionId"],
    message: "Elige una sección existente o escribe el nombre de una nueva",
  })
  .refine((v) => new Set(v.debts.map((d) => d.debtorId)).size === v.debts.length, {
    path: ["debts"],
    message: "Hay un deudor repetido",
  })
  .refine((v) => v.debts.every((d) => d.debtorId !== v.creditorId), {
    path: ["debts"],
    message: "El deudor no puede ser el propio acreedor",
  });
export type InitialDebtsInput = z.infer<typeof initialDebtsSchema>;

/* ---------------------------------- filtros -------------------------------- */

export const movementFiltersSchema = z.object({
  q: z.string().trim().max(80).optional(),
  section: z.string().max(64).optional(),
  person: z.string().max(64).optional(),
  category: z.string().max(32).optional(),
  from: isoDate.optional(),
  to: isoDate.optional(),
});
export type MovementFilters = z.infer<typeof movementFiltersSchema>;
