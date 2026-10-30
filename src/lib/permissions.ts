/**
 * Reglas de permisos en un único sitio, sin dependencias de React ni de la BD.
 * Las usan las server actions (que son las que de verdad protegen) y las páginas
 * (solo para decidir qué botones mostrar).
 */
import { INITIAL_DEBT_CATEGORY } from "./categories";

export interface Actor {
  id: string;
  role: "admin" | "member";
}

export const isAdminActor = (actor: Actor) => actor.role === "admin";

/**
 * Miembro: solo los gastos que ha creado él. Admin: cualquiera.
 * Las deudas iniciales solo las modifica el admin, aunque las haya creado otra persona.
 */
export function canModifyExpense(actor: Actor, expense: { createdBy: string; category: string }): boolean {
  if (isAdminActor(actor)) return true;
  if (expense.category === INITIAL_DEBT_CATEGORY) return false;
  return expense.createdBy === actor.id;
}

/** Registrar un pago: quien paga, quien cobra o el admin. */
export function canRegisterPayment(actor: Actor, payment: { fromUserId: string; toUserId: string }): boolean {
  return isAdminActor(actor) || payment.fromUserId === actor.id || payment.toUserId === actor.id;
}

/** Deshacer un pago: quien lo registró o el admin. */
export function canDeletePayment(actor: Actor, payment: { createdBy: string }): boolean {
  return isAdminActor(actor) || payment.createdBy === actor.id;
}

/** Renombrar o archivar una sección: quien la creó o el admin. */
export function canEditSection(actor: Actor, section: { createdBy: string }): boolean {
  return isAdminActor(actor) || section.createdBy === actor.id;
}

/** Borrar un comentario: su autor o el admin. */
export function canDeleteComment(actor: Actor, comment: { userId: string }): boolean {
  return isAdminActor(actor) || comment.userId === actor.id;
}

/** Restaurar gastos, gestionar usuarios y cargar deudas iniciales. */
export function canAdminister(actor: Actor): boolean {
  return isAdminActor(actor);
}
