import "server-only";
import { db } from "@/lib/db";
import { createAuth, type Auth } from "./config";

const globalForAuth = globalThis as unknown as { __cuentasAuth?: Auth };

function getAuth(): Auth {
  if (!globalForAuth.__cuentasAuth) globalForAuth.__cuentasAuth = createAuth(db);
  return globalForAuth.__cuentasAuth;
}

/** Instancia perezosa de Better Auth (evita tocar la BD al importar). */
export const auth: Auth = new Proxy({} as Auth, {
  get(_target, prop, receiver) {
    return Reflect.get(getAuth(), prop, receiver);
  },
});
