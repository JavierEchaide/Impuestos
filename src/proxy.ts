import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Comprobación OPTIMISTA: si no hay cookie de sesión, manda al login sin
 * tocar la base de datos. La autorización real se hace en el servidor, en
 * cada página y en cada acción (ver src/lib/auth/session.ts).
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname === "/login" || pathname === "/offline") return NextResponse.next();

  const cookie = getSessionCookie(request, { cookiePrefix: "cuentas" });
  if (!cookie) {
    const url = new URL("/login", request.url);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|icons/|.*\\.(?:png|svg|jpg|jpeg|webp|ico)$).*)"],
};
