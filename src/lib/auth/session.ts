import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "./index";
import { ROLES, type Role } from "./config";

export interface AppUser {
  id: string;
  name: string;
  username: string;
  role: Role;
  color: string;
  mustChangePassword: boolean;
}

/** Lee la sesión de la cookie y comprueba en BD que el usuario sigue activo. Una vez por petición. */
export const getCurrentUser = cache(async (): Promise<AppUser | null> => {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;
  const u = session.user as typeof session.user & {
    username?: string | null;
    role?: string | null;
    banned?: boolean | null;
    color?: string | null;
    mustChangePassword?: boolean | null;
  };
  if (u.banned) return null;
  return {
    id: u.id,
    name: u.name,
    username: u.username ?? "",
    role: u.role === ROLES.admin ? ROLES.admin : ROLES.member,
    color: u.color ?? "#d79921",
    mustChangePassword: u.mustChangePassword ?? false,
  };
});

/**
 * Exige sesión iniciada. Si el usuario aún no ha cambiado su contraseña
 * temporal, lo manda a cambiarla (salvo en la propia pantalla de cambio).
 */
export async function requireUser(options: { allowMustChange?: boolean } = {}): Promise<AppUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.mustChangePassword && !options.allowMustChange) redirect("/cambiar-contrasena");
  return user;
}

/** Exige rol de administrador; un miembro que entra aquí vuelve a la pantalla principal. */
export async function requireAdmin(): Promise<AppUser> {
  const user = await requireUser();
  if (user.role !== ROLES.admin) redirect("/");
  return user;
}

export function isAdmin(user: Pick<AppUser, "role">): boolean {
  return user.role === ROLES.admin;
}
