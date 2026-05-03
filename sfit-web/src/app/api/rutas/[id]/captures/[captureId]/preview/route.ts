import { NextRequest } from "next/server";
import { isValidObjectId } from "mongoose";
import { connectDB } from "@/lib/db/mongoose";
import { Route } from "@/models/Route";
import { RouteCapture } from "@/models/RouteCapture";
import {
  apiResponse, apiError, apiForbidden, apiNotFound, apiUnauthorized,
} from "@/lib/api/response";
import { requireRole } from "@/lib/auth/guard";
import { canAccessMunicipality } from "@/lib/auth/rbac";
import { ROLES } from "@/lib/constants";

/**
 * GET /api/rutas/[id]/captures/[captureId]/preview
 *
 * Devuelve los puntos de una captura específica para que el dashboard
 * los superponga al mapa al inspeccionar el historial. Incluye los
 * waypoints actuales de la ruta para hacer comparación visual.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; captureId: string }> },
) {
  const auth = requireRole(request, [
    ROLES.SUPER_ADMIN, ROLES.ADMIN_MUNICIPAL, ROLES.ADMIN_PROVINCIAL, ROLES.OPERADOR, ROLES.FISCAL,
  ]);
  if ("error" in auth) return auth.error === "unauthorized" ? apiUnauthorized() : apiForbidden();

  const { id, captureId } = await params;
  if (!isValidObjectId(id) || !isValidObjectId(captureId)) {
    return apiError("ID inválido", 400);
  }

  await connectDB();
  const route = await Route.findById(id)
    .select("_id municipalityId waypoints code name")
    .lean<{ _id: unknown; municipalityId: unknown; waypoints?: Array<{ lat: number; lng: number; order: number }>; code: string; name: string } | null>();
  if (!route) return apiNotFound("Ruta no encontrada");
  if (!(await canAccessMunicipality(auth.session, String(route.municipalityId)))) return apiForbidden();

  const capture = await RouteCapture.findById(captureId)
    .select("_id routeId points pointCount avgAccuracy distanceMeters durationSeconds qualityScore status createdAt")
    .lean<{
      _id: unknown;
      routeId: unknown;
      points: Array<{ lat: number; lng: number; ts: Date; accuracy?: number; speed?: number }>;
      pointCount: number;
      avgAccuracy?: number;
      distanceMeters?: number;
      durationSeconds?: number;
      qualityScore: number;
      status: string;
      createdAt: Date;
    } | null>();
  if (!capture) return apiNotFound("Captura no encontrada");
  if (String(capture.routeId) !== String(route._id)) {
    return apiError("La captura no pertenece a esta ruta", 400);
  }

  return apiResponse({
    capture: {
      id: String(capture._id),
      pointCount: capture.pointCount,
      avgAccuracy: capture.avgAccuracy,
      distanceMeters: capture.distanceMeters,
      durationSeconds: capture.durationSeconds,
      qualityScore: capture.qualityScore,
      status: capture.status,
      createdAt: capture.createdAt,
      points: capture.points.map((p) => ({ lat: p.lat, lng: p.lng })),
    },
    route: {
      id: String(route._id),
      code: route.code,
      name: route.name,
      waypoints: (route.waypoints ?? []).map((w) => ({ lat: w.lat, lng: w.lng })),
    },
  });
}
