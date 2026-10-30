import { and, eq, inArray, isNull, lt, or } from "drizzle-orm";
import type { Db } from "@/lib/db/client";
import { loginThrottle } from "@/lib/db/schema";

/** Intentos fallidos permitidos por ventana, según el tipo de clave. */
export const THROTTLE_LIMITS = {
  user: 5,
  ip: 20,
  password: 5,
} as const;
export const THROTTLE_WINDOW_MS = 15 * 60 * 1000;
export const THROTTLE_LOCK_MS = 15 * 60 * 1000;

export type ThrottleKind = keyof typeof THROTTLE_LIMITS;

export function throttleKey(kind: ThrottleKind, value: string): string {
  return `${kind}:${value.trim().toLowerCase()}`;
}

/** Devuelve los segundos que faltan para que se libere el bloqueo, o null si no hay bloqueo. */
export async function lockedSeconds(db: Db, keys: string[], now = new Date()): Promise<number | null> {
  if (keys.length === 0) return null;
  const rows = await db.select().from(loginThrottle).where(inArray(loginThrottle.key, keys));
  let longest = 0;
  for (const row of rows) {
    if (row.lockedUntil && row.lockedUntil > now) {
      longest = Math.max(longest, row.lockedUntil.getTime() - now.getTime());
    }
  }
  return longest > 0 ? Math.ceil(longest / 1000) : null;
}

/** Registra un fallo. Al llegar al límite dentro de la ventana, bloquea la clave. */
export async function recordFailure(db: Db, key: string, max: number, now = new Date()) {
  // Limpieza oportunista de filas antiguas (más de un día y sin bloqueo vigente).
  const cutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  await db
    .delete(loginThrottle)
    .where(
      and(
        lt(loginThrottle.windowStartedAt, cutoff),
        or(isNull(loginThrottle.lockedUntil), lt(loginThrottle.lockedUntil, now)),
      ),
    );

  await db.transaction(async (tx) => {
    await tx
      .insert(loginThrottle)
      .values({ key, failures: 0, windowStartedAt: now })
      .onConflictDoNothing();
    const [row] = await tx
      .select()
      .from(loginThrottle)
      .where(eq(loginThrottle.key, key))
      .for("update");

    const windowExpired = now.getTime() - row.windowStartedAt.getTime() > THROTTLE_WINDOW_MS;
    const failures = windowExpired ? 1 : row.failures + 1;
    const locked = failures >= max;

    await tx
      .update(loginThrottle)
      .set({
        failures: locked ? 0 : failures,
        windowStartedAt: windowExpired || locked ? now : row.windowStartedAt,
        lockedUntil: locked ? new Date(now.getTime() + THROTTLE_LOCK_MS) : row.lockedUntil,
      })
      .where(eq(loginThrottle.key, key));
  });
}

export async function clearFailures(db: Db, key: string) {
  await db.delete(loginThrottle).where(eq(loginThrottle.key, key));
}

export function formatWait(seconds: number): string {
  const minutes = Math.ceil(seconds / 60);
  return minutes <= 1 ? "1 minuto" : `${minutes} minutos`;
}
