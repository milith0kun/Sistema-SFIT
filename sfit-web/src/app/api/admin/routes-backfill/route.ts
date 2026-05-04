import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db/mongoose";
import { Route } from "@/models/Route";
import { apiResponse, apiUnauthorized, apiForbidden } from "@/lib/api/response";
import { requireRole } from "@/lib/auth/guard";
import { ROLES } from "@/lib/constants";
import { routeAlongWaypoints } from "@/lib/routing/routingService";

/**
 * POST /api/admin/routes-backfill?force=true
 *
 * Recomputa polylineGeometry de TODAS las rutas existentes con Google
 * Routes API. Útil para backfill después de habilitar Google Routes en
 * un sistema con rutas previas (todas sin geometría cacheada).
 *
 * - Por default solo procesa rutas SIN polylineGeometry (incremental).
 * - Con `?force=true` recomputa todas (incluso las que ya tienen geometría).
 *
 * Usa pacing de 200ms entre llamadas para no saturar Google y respetar
 * los rate limits del free tier (100 req/s nominal pero conservador).
 *
 * Solo super_admin (afecta múltiples municipalidades).
 */
export async function POST(request: NextRequest) {
  const auth = requireRole(request, [ROLES.SUPER_ADMIN]);
  if ("error" in auth) {
    return auth.error === "unauthorized" ? apiUnauthorized() : apiForbidden();
  }

  const url = new URL(request.url);
  const force = url.searchParams.get("force") === "true";

  await connectDB();

  // Selecciona rutas con al menos 2 waypoints. Si no es force, filtra las
  // que ya tienen polylineGeometry para no recomputar.
  const filter: Record<string, unknown> = {
    "waypoints.1": { $exists: true },  // hay al menos 2 waypoints (índice 1)
  };
  if (!force) {
    filter.polylineGeometry = { $in: [null, undefined] };
  }

  const routes = await Route.find(filter)
    .select("_id code name waypoints")
    .lean();

  let ok = 0;
  let failed = 0;
  let skipped = 0;
  const failures: Array<{ id: string; code: string; reason: string }> = [];

  for (const r of routes) {
    if (!r.waypoints || r.waypoints.length < 2) {
      skipped++;
      continue;
    }
    try {
      const geom = await routeAlongWaypoints(
        r.waypoints.map(w => ({ lat: w.lat, lng: w.lng })),
      );
      if (!geom) {
        failed++;
        failures.push({ id: String(r._id), code: r.code, reason: "Google Routes returned null" });
        continue;
      }
      await Route.findByIdAndUpdate(r._id, {
        polylineGeometry: {
          coords: geom.coords,
          distanceMeters: geom.distanceMeters,
          durationSecondsBaseline: geom.durationSeconds,
          computedAt: new Date(),
        },
      });
      ok++;
      // Pacing — 200ms entre calls para no saturar Google
      await new Promise(resolve => setTimeout(resolve, 200));
    } catch (err) {
      failed++;
      failures.push({
        id: String(r._id),
        code: r.code,
        reason: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return apiResponse({
    total: routes.length,
    ok,
    failed,
    skipped,
    force,
    failures: failures.slice(0, 20),  // primeras 20 fallas para diagnóstico
  });
}
