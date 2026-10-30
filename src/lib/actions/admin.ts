"use server";

import { and, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { generateTempPassword } from "@/lib/auth/passwords";
import { requireAdmin } from "@/lib/auth/session";
import { INITIAL_DEBT_CATEGORY } from "@/lib/categories";
import { db, expenseSplits, expenses, sections, session, user } from "@/lib/db";
import {
  createUserSchema,
  initialDebtsSchema,
  setUserActiveSchema,
  idSchema,
} from "@/lib/validation/schemas";
import { activeUserNames, money } from "./guards";
import { ActionError, fail, guard, logActivity, newId, zodFail, type ActionResult } from "./shared";

/** Colores Gruvbox para los avatares, en orden de asignación. */
const AVATAR_COLORS = ["#d79921", "#cc241d", "#98971a", "#458588", "#b16286", "#689d6a", "#d65d0e", "#fb4934"];

export async function createUserAction(
  input: unknown,
): Promise<ActionResult<{ id: string; username: string; tempPassword: string }>> {
  return guard(async () => {
    const actor = await requireAdmin();
    const parsed = createUserSchema.safeParse(input);
    if (!parsed.success) return zodFail(parsed.error);
    const data = parsed.data;

    const [taken] = await db.select({ id: user.id }).from(user).where(eq(user.username, data.username)).limit(1);
    if (taken) return fail("Ese nombre de usuario ya está en uso.");

    const existing = await db.select({ id: user.id }).from(user);
    const tempPassword = generateTempPassword();

    const created = await auth.api.createUser({
      body: {
        // Better Auth exige un email; usamos uno interno que nunca se envía a nadie.
        email: `${data.username}@cuentas-claras.local`,
        password: tempPassword,
        name: data.name,
        data: {
          role: data.role,
          username: data.username,
          color: AVATAR_COLORS[existing.length % AVATAR_COLORS.length],
          mustChangePassword: true,
        },
      },
    });

    await logActivity(db, {
      actorId: actor.id,
      action: "created",
      entityType: "user",
      entityId: created.user.id,
      summary: `${actor.name} creó el usuario ${data.name} (@${data.username}, ${data.role === "admin" ? "admin" : "miembro"})`,
      adminOnly: true,
    });

    revalidatePath("/admin/usuarios");
    return { ok: true as const, id: created.user.id, username: data.username, tempPassword };
  });
}

/** Genera una contraseña temporal nueva, cierra las sesiones de esa persona y la obliga a cambiarla. */
export async function resetPasswordAction(
  input: unknown,
): Promise<ActionResult<{ tempPassword: string }>> {
  return guard(async () => {
    const actor = await requireAdmin();
    const parsed = idSchema.safeParse(input);
    if (!parsed.success) return zodFail(parsed.error);
    if (parsed.data.id === actor.id) {
      return fail("Para cambiar tu propia contraseña usa Ajustes > Cambiar contraseña.");
    }

    const [target] = await db.select().from(user).where(eq(user.id, parsed.data.id)).limit(1);
    if (!target) return fail("El usuario no existe.");

    const tempPassword = generateTempPassword();
    const ctx = await auth.$context;
    await ctx.internalAdapter.updatePassword(target.id, await ctx.password.hash(tempPassword));
    await db.transaction(async (tx) => {
      await tx.update(user).set({ mustChangePassword: true, updatedAt: new Date() }).where(eq(user.id, target.id));
      await tx.delete(session).where(eq(session.userId, target.id));
      await logActivity(tx, {
        actorId: actor.id,
        action: "password_reset",
        entityType: "user",
        entityId: target.id,
        summary: `${actor.name} restableció la contraseña de ${target.name}`,
        adminOnly: true,
      });
    });

    revalidatePath("/admin/usuarios");
    return { ok: true as const, tempPassword };
  });
}

/** Desactivar impide iniciar sesión y cierra sus sesiones; su historial se conserva. */
export async function setUserActiveAction(input: unknown): Promise<ActionResult> {
  return guard(async () => {
    const actor = await requireAdmin();
    const parsed = setUserActiveSchema.safeParse(input);
    if (!parsed.success) return zodFail(parsed.error);
    if (parsed.data.id === actor.id) return fail("No puedes desactivar tu propia cuenta.");

    const [target] = await db.select().from(user).where(eq(user.id, parsed.data.id)).limit(1);
    if (!target) return fail("El usuario no existe.");

    await db.transaction(async (tx) => {
      await tx
        .update(user)
        .set({
          banned: !parsed.data.active,
          banReason: parsed.data.active ? null : "Desactivado por el administrador",
          updatedAt: new Date(),
        })
        .where(eq(user.id, target.id));
      if (!parsed.data.active) await tx.delete(session).where(eq(session.userId, target.id));
      await logActivity(tx, {
        actorId: actor.id,
        action: parsed.data.active ? "activated" : "deactivated",
        entityType: "user",
        entityId: target.id,
        summary: `${actor.name} ${parsed.data.active ? "activó" : "desactivó"} a ${target.name}`,
        adminOnly: true,
      });
    });

    revalidatePath("/admin/usuarios");
    return { ok: true as const };
  });
}

/**
 * Carga deudas ya existentes como gastos normales: pagados por el acreedor y
 * repartidos al 100 % al deudor, con la categoría «Deuda inicial». Así entran
 * en exactamente el mismo cálculo de saldos que cualquier otro gasto.
 */
export async function createInitialDebtsAction(
  input: unknown,
): Promise<ActionResult<{ sectionId: string; created: number }>> {
  return guard(async () => {
    const actor = await requireAdmin();
    const parsed = initialDebtsSchema.safeParse(input);
    if (!parsed.success) return zodFail(parsed.error);
    const data = parsed.data;

    const names = await activeUserNames([data.creditorId, ...data.debts.map((d) => d.debtorId)]);
    const today = new Date().toISOString().slice(0, 10);

    const result = await db.transaction(async (tx) => {
      let sectionId = data.sectionId;
      let sectionName: string;
      if (sectionId) {
        const [section] = await tx
          .select()
          .from(sections)
          .where(and(eq(sections.id, sectionId), isNull(sections.archivedAt)))
          .limit(1);
        if (!section) throw new ActionError("La sección no existe o está archivada.");
        sectionName = section.name;
      } else {
        sectionId = newId();
        sectionName = data.newSectionName!;
        await tx.insert(sections).values({ id: sectionId, name: sectionName, createdBy: actor.id });
        await logActivity(tx, {
          actorId: actor.id,
          action: "created",
          entityType: "section",
          entityId: sectionId,
          sectionId,
          summary: `${actor.name} creó la sección «${sectionName}»`,
        });
      }

      for (const debt of data.debts) {
        const id = newId();
        await tx.insert(expenses).values({
          id,
          sectionId,
          title: data.title,
          amountCents: debt.amountCents,
          expenseDate: today,
          category: INITIAL_DEBT_CATEGORY,
          paidBy: data.creditorId,
          splitType: "exact",
          createdBy: actor.id,
        });
        await tx.insert(expenseSplits).values({
          expenseId: id,
          userId: debt.debtorId,
          amountCents: debt.amountCents,
          weight: debt.amountCents,
        });
        await logActivity(tx, {
          actorId: actor.id,
          action: "created",
          entityType: "expense",
          entityId: id,
          sectionId,
          summary: `Deuda inicial «${data.title}»: ${names.get(debt.debtorId)} debe ${money(debt.amountCents)} a ${names.get(data.creditorId)} en ${sectionName}`,
          details: {
            after: {
              creditorId: data.creditorId,
              debtorId: debt.debtorId,
              amountCents: debt.amountCents,
            },
          },
        });
      }
      return { sectionId, created: data.debts.length };
    });

    revalidatePath("/", "layout");
    return { ok: true as const, ...result };
  });
}
