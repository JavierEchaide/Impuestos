import "server-only";
import { asc } from "drizzle-orm";
import { db, user } from "@/lib/db";

export interface PublicUser {
  id: string;
  name: string;
  username: string;
  color: string;
  role: "admin" | "member";
  active: boolean;
  mustChangePassword: boolean;
  createdAt: Date;
}

/** Todos los perfiles del grupo (activos e inactivos), ordenados por nombre. */
export async function listUsers(): Promise<PublicUser[]> {
  const rows = await db.select().from(user).orderBy(asc(user.name));
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    username: row.username ?? "",
    color: row.color,
    role: row.role === "admin" ? "admin" : "member",
    active: !row.banned,
    mustChangePassword: row.mustChangePassword,
    createdAt: row.createdAt,
  }));
}

export function userMap(users: PublicUser[]): Map<string, PublicUser> {
  return new Map(users.map((u) => [u.id, u]));
}
