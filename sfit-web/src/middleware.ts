import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PUBLIC_ROUTES = ["/", "/login", "/register", "/reset-password"];
const PUBLIC_API = ["/api/auth", "/api/public", "/api/health"];

/**
 * El middleware corre en Edge runtime — sin acceso a bibliotecas Node como
 * `jsonwebtoken`. Aquí sólo verificamos que el token EXISTA como cookie o
 * header. La validación criptográfica ocurre en los API routes y en los
 * server components (que sí corren en Node runtime).
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  const isPublicRoute = PUBLIC_ROUTES.some(
    (r) => pathname === r || pathname.startsWith(r + "/"),
  );
  const isPublicApi = PUBLIC_API.some((r) => pathname.startsWith(r));

  if (isPublicRoute || isPublicApi) return NextResponse.next();

  const authHeader = request.headers.get("Authorization");
  const cookieToken = request.cookies.get("sfit_access_token")?.value;
  const token = authHeader?.replace("Bearer ", "") ?? cookieToken;

  if (!token) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { success: false, error: "No autorizado" },
        { status: 401 },
      );
    }
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
