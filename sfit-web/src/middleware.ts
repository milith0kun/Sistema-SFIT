import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifyAccessToken } from "@/lib/auth/jwt";

const PUBLIC_ROUTES = ["/", "/login", "/register", "/reset-password"];
const PUBLIC_API = ["/api/auth", "/api/public", "/api/health"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Archivos estáticos
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  const isPublicRoute = PUBLIC_ROUTES.some(
    (r) => pathname === r || pathname.startsWith(r + "/")
  );
  const isPublicApi = PUBLIC_API.some((r) => pathname.startsWith(r));

  if (isPublicRoute || isPublicApi) return NextResponse.next();

  // Verificar JWT (RF-01-11: aislamiento por tenant)
  const authHeader = request.headers.get("Authorization");
  const cookieToken = request.cookies.get("sfit_access_token")?.value;
  const token = authHeader?.replace("Bearer ", "") ?? cookieToken;

  if (!token) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { success: false, error: "No autorizado" },
        { status: 401 }
      );
    }
    return NextResponse.redirect(new URL("/login", request.url));
  }

  try {
    const payload = verifyAccessToken(token);
    const response = NextResponse.next();
    // Propagar contexto del usuario a los headers para Server Components y Route Handlers
    response.headers.set("x-user-id", payload.userId);
    response.headers.set("x-user-role", payload.role);
    if (payload.municipalityId) {
      response.headers.set("x-municipality-id", payload.municipalityId);
    }
    if (payload.provinceId) {
      response.headers.set("x-province-id", payload.provinceId);
    }
    return response;
  } catch {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { success: false, error: "Token inválido o expirado" },
        { status: 401 }
      );
    }
    return NextResponse.redirect(new URL("/login", request.url));
  }
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
