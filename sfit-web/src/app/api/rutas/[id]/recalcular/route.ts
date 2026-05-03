import { NextRequest } from "next/server";
import { isValidObjectId } from "mongoose";
import { z } from "zod";
import { connectDB } from "@/lib/db/mongoose";
import { Route } from "@/models/Route";
import { RouteCapture } from "@/models/RouteCapture";
import {
  apiResponse, apiError, apiForbidden, apiNotFound, apiUnauthorized, apiValidationError,
} from "@/lib/api/response";
import { requireRole } from "@/lib/auth/guard";
import { canAccessMunicipality } from "@/lib/auth/rbac";
import { ROLES } from "@/lib/constants";
import { logAction } from "@/lib/audit/logAction";
import { convergeCaptures, type GpsPoint } from "@/lib/routes/converge";

const Body = z.object({
  /** Si true, devuelve el resultado pero NO actualiza Route.waypoints. */
  preview: z.boolean().optional(),
  /** Override del umbral mínimo de calidad. Default 60. */
  minQuality: z.number().min(0).max(100).optional(),
  /** Tolerancia de simplificación RDP en metros. Default 5. */
  rdpEpsilon: z.number().min(0.5).max(50).optional(),
  /** Cantidad de puntos del trazado resultante. Default 50. */
  resampleCount: z.number().int().min(10).max(200).optional(),
});

/**
 * POST /api/rutas/[id]/recalcular
 *
 * Ejecuta el algoritmo de convergencia sobre las capturas en status "raw"
 * de la ruta y opcionalmente actualiza `Route.waypoints` con el promedio
 * resultante. Las capturas usadas pasan a status "merged".
 *
 * Modo `preview: true`: solo devuelve el diff (waypoints antes/después)
 * sin persistir cambios. Útil para que el operador apruebe antes de
 * sobreescribir.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = requireRole(request, [ROLES.SUPER_ADMIN, ROLES.ADMIN_MUNICIPAL, ROLES.OPERADOR]);
  if ("error" in auth) return auth.error === "unauthorized" ? apiUnauthorized() : apiForbidden();

  const { id } = await params;
  if (!isValidObjectId(id)) return apiError("ID inválido", 400);

  const json = await request.json().catch(() => ({}));
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    const errors: Record<string, string[]> = {};
    for (const i of parsed.error.issues) {
      const k = i.path[0]?.toString() ?? "general";
      errors[k] = [...(errors[k] ?? []), i.message];
    }
    return apiValidationError(errors);
  }

  await connectDB();
  const route = await Route.findById(id);
  if (!route) return apiNotFound("Ruta no encontrada");
  if (!(await canAccessMunicipality(auth.session, String(route.municipalityId)))) return apiForbidden();

  // Capturas candidatas: status "raw" o "validated", ordenadas por calidad descendente.
  const captures = await RouteCapture.find({
    routeId: route._id,
    status: { $in: ["raw", "validated"] },
  })
    .select("_id points qualityScore")
    .sort({ qualityScore: -1 })
    .limit(50)
    .lean();

  if (captures.length === 0) {
    return apiError("No hay capturas disponibles para converger esta ruta", 400);
  }

  const currentWaypoints: GpsPoint[] = (route.waypoints ?? []).map((w) => ({ lat: w.lat, lng: w.lng }));

  const result = convergeCaptures({
    captures: captures.map((c) => ({
      id: String(c._id),
      points: c.points.map((p: { lat: number; lng: number }) => ({ lat: p.lat, lng: p.lng })),
      qualityScore: c.qualityScore,
    })),
    currentWaypoints,
    options: {
      minQuality: parsed.data.minQuality,
      rdpEpsilonMeters: parsed.data.rdpEpsilon,
      resampleCount: parsed.data.resampleCount,
    },
  });

  if (result.usedCaptureIds.length === 0) {
    return apiError(
      `Ninguna captura supera el umbral de calidad. Descartadas: ${result.discarded.length}`,
      400,
    );
  }

  // Modo preview: no persistir.
  if (parsed.data.preview) {
    return apiResponse({
      preview: true,
      before: currentWaypoints,
      after: result.waypoints,
      usedCaptures: result.usedCaptureIds.length,
      discardedCaptures: result.discarded.length,
      segmentStats: result.segmentStats,
    });
  }

  // Persistir: reescribir waypoints + marcar capturas como merged.
  route.waypoints = result.waypoints.map((p, i) => ({
    order: i,
    lat: p.lat,
    lng: p.lng,
  })) as typeof route.waypoints;
  await route.save();

  if (result.usedCaptureIds.length > 0) {
    await RouteCapture.updateMany(
      { _id: { $in: result.usedCaptureIds } },
      { $set: { status: "merged", mergedAt: new Date() } },
    );
  }

  void logAction({
    userId: auth.session.userId,
    action: "route.converged",
    resource: "route",
    resourceId: String(route._id),
    details: {
      usedCaptures: result.usedCaptureIds.length,
      discardedCaptures: result.discarded.length,
      previousPointCount: currentWaypoints.length,
      newPointCount: result.waypoints.length,
    },
    req: request,
    municipalityId: auth.session.municipalityId,
    role: auth.session.role,
  });

  return apiResponse({
    preview: false,
    routeId: String(route._id),
    before: currentWaypoints,
    after: result.waypoints,
    usedCaptures: result.usedCaptureIds.length,
    discardedCaptures: result.discarded.length,
    segmentStats: result.segmentStats,
  });
}
