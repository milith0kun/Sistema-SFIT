import { NextRequest } from "next/server";
import { verifyAccessToken, type JwtPayload } from "./jwt";
import type { Role } from "@/lib/constants";

/**
 * Extrae el payload del access token desde el header Authorization
 * o desde la cookie `sfit_access_token`. Devuelve null si no hay sesión válida.
 */
export function getSession(request: NextRequest): JwtPayload | null {
  // 1. Header Authorization (apps móviles y fetch autenticado)
  const authHeader = request.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    try {
      return verifyAccessToken(authHeader.slice(7));
    } catch {
      // token inválido o expirado
    }
  }

  // 2. Cookie (navegador web)
  const cookieToken = request.cookies.get("sfit_access_token")?.value;
  if (cookieToken) {
    try {
      return verifyAccessToken(cookieToken);
    } catch {
      // token inválido
    }
  }

  return null;
}

/** Exige sesión autenticada. Devuelve el payload o null si no lo está. */
export function requireAuth(request: NextRequest): JwtPayload | null {
  return getSession(request);
}

/** Exige sesión autenticada y un rol permitido. */
export function requireRole(
  request: NextRequest,
  allowed: Role[],
): { session: JwtPayload } | { error: "unauthorized" | "forbidden" } {
  const session = getSession(request);
  if (!session) return { error: "unauthorized" };
  if (!allowed.includes(session.role)) return { error: "forbidden" };
  return { session };
}
