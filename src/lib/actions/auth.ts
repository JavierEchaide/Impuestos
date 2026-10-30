"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getClientIp } from "@/lib/auth/ip";
import { requireUser } from "@/lib/auth/session";
import {
  THROTTLE_LIMITS,
  clearFailures,
  formatWait,
  lockedSeconds,
  recordFailure,
  throttleKey,
} from "@/lib/auth/throttle";
import { db, user } from "@/lib/db";
import { changePasswordSchema, loginSchema } from "@/lib/validation/schemas";
import { fail, guard, logActivity, zodFail, type ActionResult } from "./shared";

const GENERIC_LOGIN_ERROR = "Usuario o contraseña incorrectos.";

function tooManyAttempts(seconds: number) {
  return fail(`Demasiados intentos fallidos. Vuelve a probar en ${formatWait(seconds)}.`);
}

/**
 * Inicio de sesión con límite de intentos por usuario (5 por 15 min) y por IP
 * (20 por 15 min). Es la única vía de entrada: no hay handler HTTP de Better Auth.
 */
export async function loginAction(input: unknown): Promise<ActionResult> {
  return guard(async () => {
    const parsed = loginSchema.safeParse(input);
    if (!parsed.success) return zodFail(parsed.error);
    const { username, password } = parsed.data;

    const userKey = throttleKey("user", username);
    const ipKey = throttleKey("ip", await getClientIp());

    const wait = await lockedSeconds(db, [userKey, ipKey]);
    if (wait) return tooManyAttempts(wait);

    try {
      await auth.api.signInUsername({
        body: { username: username.toLowerCase(), password },
        headers: await headers(),
      });
    } catch (error) {
      await recordFailure(db, userKey, THROTTLE_LIMITS.user);
      await recordFailure(db, ipKey, THROTTLE_LIMITS.ip);
      const code = (error as { body?: { code?: string } })?.body?.code;
      if (code === "BANNED_USER") {
        return fail("Tu cuenta está desactivada. Habla con el administrador.");
      }
      return fail(GENERIC_LOGIN_ERROR);
    }

    await clearFailures(db, userKey);
    redirect("/");
  });
}

export async function logoutAction(): Promise<void> {
  try {
    await auth.api.signOut({ headers: await headers() });
  } catch {
    // Si la sesión ya no existe no pasa nada: igualmente volvemos al login.
  }
  redirect("/login");
}

/** Cambio de contraseña. Es obligatorio tras el primer inicio de sesión con la temporal. */
export async function changePasswordAction(input: unknown): Promise<ActionResult> {
  return guard(async () => {
    const actor = await requireUser({ allowMustChange: true });
    const parsed = changePasswordSchema.safeParse(input);
    if (!parsed.success) return zodFail(parsed.error);

    const key = throttleKey("password", actor.id);
    const wait = await lockedSeconds(db, [key]);
    if (wait) return tooManyAttempts(wait);

    try {
      await auth.api.changePassword({
        body: {
          currentPassword: parsed.data.currentPassword,
          newPassword: parsed.data.newPassword,
          revokeOtherSessions: true,
        },
        headers: await headers(),
      });
    } catch {
      await recordFailure(db, key, THROTTLE_LIMITS.password);
      return fail("La contraseña actual no es correcta.");
    }

    await clearFailures(db, key);
    await db.update(user).set({ mustChangePassword: false, updatedAt: new Date() }).where(eq(user.id, actor.id));
    await logActivity(db, {
      actorId: actor.id,
      action: "password_changed",
      entityType: "user",
      entityId: actor.id,
      summary: `${actor.name} cambió su contraseña`,
      adminOnly: true,
    });

    revalidatePath("/", "layout");
    return { ok: true as const };
  });
}
