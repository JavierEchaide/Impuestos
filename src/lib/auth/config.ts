import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { admin, username } from "better-auth/plugins";
import { hash, verify } from "@node-rs/argon2";
import type { Db } from "@/lib/db/client";
import { account, session, user, verification } from "@/lib/db/schema";

export const ROLES = { admin: "admin", member: "member" } as const;
export type Role = (typeof ROLES)[keyof typeof ROLES];

export const MIN_PASSWORD_LENGTH = 10;
export const MAX_PASSWORD_LENGTH = 128;

/** Argon2id con los parámetros mínimos recomendados por OWASP (19 MiB, t=2, p=1). */
const ARGON2_OPTIONS = { memoryCost: 19_456, timeCost: 2, parallelism: 1 } as const;

function resolveBaseUrl(): string {
  if (process.env.BETTER_AUTH_URL) return process.env.BETTER_AUTH_URL;
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

/**
 * Better Auth se usa SOLO desde el servidor (server actions): no se monta
 * ningún handler HTTP en /api/auth, así que no hay superficie pública de
 * registro ni de inicio de sesión fuera de nuestras acciones, que son las que
 * aplican el límite de intentos.
 */
export function createAuth(db: Db, options: { nextCookies?: boolean } = {}) {
  return betterAuth({
    appName: "Cuentas Claras",
    baseURL: resolveBaseUrl(),
    secret: process.env.BETTER_AUTH_SECRET,
    database: drizzleAdapter(db, {
      provider: "pg",
      schema: { user, session, account, verification },
    }),
    emailAndPassword: {
      enabled: true,
      disableSignUp: true,
      minPasswordLength: MIN_PASSWORD_LENGTH,
      maxPasswordLength: MAX_PASSWORD_LENGTH,
      password: {
        hash: (password) => hash(password, ARGON2_OPTIONS),
        verify: ({ hash: stored, password }) => verify(stored, password),
      },
    },
    session: {
      expiresIn: 60 * 60 * 24 * 30, // 30 días
      updateAge: 60 * 60 * 24, // renueva como mucho una vez al día
    },
    user: {
      additionalFields: {
        color: { type: "string", required: false, input: false },
        mustChangePassword: { type: "boolean", required: false, input: false },
      },
    },
    advanced: {
      cookiePrefix: "cuentas",
    },
    plugins: [
      username({
        minUsernameLength: 3,
        maxUsernameLength: 30,
        displayUsername: false,
      }),
      admin({
        defaultRole: ROLES.member,
        adminRoles: [ROLES.admin],
      }),
      ...(options.nextCookies === false ? [] : [nextCookies()]), // debe ir el último
    ],
  });
}

export type Auth = ReturnType<typeof createAuth>;
