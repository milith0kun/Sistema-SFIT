import { NextRequest } from "next/server";
import { apiResponse, apiError, apiUnauthorized, apiForbidden } from "@/lib/api/response";
import { requireRole } from "@/lib/auth/guard";
import { ROLES } from "@/lib/constants";
import { routeBetween, getRoutingMetrics } from "@/lib/routing/routingService";

/**
 * GET /api/admin/routing-test?from=lat,lng&to=lat,lng
 *
 * Endpoint de smoke test para verificar que Google Routes API esté
 * respondiendo correctamente. Requiere SUPER_ADMIN o ADMIN_MUNICIPAL.
 *
 * Defaults a un par de coordenadas de Cusco si no se pasan.
 *
 * Respuesta:
 *   {
 *     success: true,
 *     data: {
 *       hasApiKey: boolean,
 *       result: { coords: [...], distanceMeters, durationSeconds } | null,
 *       error: string | null,
 *       metrics: { ok, fail, cacheHit, cacheSize },
 *     }
 *   }
 */
export async function GET(request: NextRequest) {
  const auth = requireRole(request, [ROLES.SUPER_ADMIN, ROLES.ADMIN_MUNICIPAL]);
  if ("error" in auth) {
    return auth.error === "unauthorized" ? apiUnauthorized() : apiForbidden();
  }

  const url = new URL(request.url);
  const fromStr = url.searchParams.get("from") ?? "-13.5178,-71.9785"; // Plaza de Armas Cusco
  const toStr = url.searchParams.get("to") ?? "-13.5320,-71.9485";    // Wanchaq aprox.

  const parsePair = (s: string): { lat: number; lng: number } | null => {
    const parts = s.split(",").map((x) => Number(x.trim()));
    if (parts.length !== 2 || parts.some(Number.isNaN)) return null;
    const [lat, lng] = parts;
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
    return { lat, lng };
  };

  const from = parsePair(fromStr);
  const to = parsePair(toStr);
  if (!from || !to) {
    return apiError(
      "Coordenadas inválidas. Formato: from=lat,lng&to=lat,lng",
      400,
    );
  }

  const hasApiKey = Boolean(
    process.env.GOOGLE_ROUTES_API_KEY ||
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY,
  );

  const result = await routeBetween(from, to);

  return apiResponse({
    hasApiKey,
    keySource: process.env.GOOGLE_ROUTES_API_KEY
      ? "GOOGLE_ROUTES_API_KEY (server-side)"
      : process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY
        ? "NEXT_PUBLIC_GOOGLE_MAPS_KEY (fallback)"
        : null,
    from,
    to,
    result: result
      ? {
          // Limito coords mostrados para no hacer la respuesta enorme
          coordsCount: result.coords.length,
          firstCoords: result.coords.slice(0, 3),
          lastCoords: result.coords.slice(-3),
          distanceMeters: result.distanceMeters,
          durationSeconds: result.durationSeconds,
          durationMinutes: Math.round(result.durationSeconds / 60),
        }
      : null,
    error: result === null
      ? hasApiKey
        ? "Google Routes API devolvió error (revisar logs del servidor)"
        : "No hay API key configurada (GOOGLE_ROUTES_API_KEY o NEXT_PUBLIC_GOOGLE_MAPS_KEY)"
      : null,
    metrics: getRoutingMetrics(),
  });
}
