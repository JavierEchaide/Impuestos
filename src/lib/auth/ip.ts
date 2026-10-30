import "server-only";
import { headers } from "next/headers";

/** IP del cliente. En Vercel, x-forwarded-for / x-real-ip los pone la plataforma. */
export async function getClientIp(): Promise<string> {
  const h = await headers();
  const real = h.get("x-real-ip");
  if (real) return real.trim();
  const forwarded = h.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim();
  return "desconocida";
}
