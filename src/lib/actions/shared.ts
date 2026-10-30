import "server-only";
import { randomUUID } from "node:crypto";
import type { z } from "zod";
import { activityLog } from "@/lib/db";
import type { Db } from "@/lib/db/client";

export interface Failure {
  ok: false;
  error: string;
  fieldErrors?: Record<string, string[]>;
}

export type ActionResult<T extends object = object> = ({ ok: true } & T) | Failure;

export function fail(error: string, fieldErrors?: Record<string, string[]>): Failure {
  return { ok: false, error, fieldErrors };
}

/** Error de negocio con mensaje apto para mostrar al usuario. */
export class ActionError extends Error {}

export function newId(): string {
  return randomUUID();
}

/** Convierte un error de Zod en el formato de respuesta de las acciones. */
export function zodFail(error: z.ZodError) {
  const fieldErrors: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_";
    (fieldErrors[key] ??= []).push(issue.message);
  }
  const first = error.issues[0]?.message ?? "Datos no válidos";
  return fail(first, fieldErrors);
}

type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

export async function logActivity(
  tx: Tx | Db,
  entry: {
    actorId: string;
    action: "created" | "updated" | "deleted" | "restored" | "archived" | "unarchived" | "password_reset" | "activated" | "deactivated" | "password_changed";
    entityType: "expense" | "payment" | "comment" | "section" | "user";
    entityId: string;
    sectionId?: string | null;
    summary: string;
    details?: unknown;
    adminOnly?: boolean;
  },
) {
  await tx.insert(activityLog).values({
    id: newId(),
    actorId: entry.actorId,
    action: entry.action,
    entityType: entry.entityType,
    entityId: entry.entityId,
    sectionId: entry.sectionId ?? null,
    summary: entry.summary,
    details: entry.details ?? null,
    adminOnly: entry.adminOnly ?? false,
  });
}

/** Ejecuta una acción convirtiendo los ActionError en respuestas de fallo. */
export async function guard<R extends { ok: true }>(run: () => Promise<R | Failure>): Promise<R | Failure> {
  try {
    return await run();
  } catch (error) {
    if (error instanceof ActionError) return fail(error.message);
    // Los redirect() de Next lanzan un error especial que debe propagarse.
    throw error;
  }
}
