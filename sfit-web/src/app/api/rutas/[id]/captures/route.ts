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
import {
  polylineLengthMeters,
  computeQualityScore,
  type GpsPoint,
} from "@/lib/routes/converge";

const PointSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  ts: z.string().datetime().optional(),
  accuracy: z.number().min(0).max(10000).optional(),
  speed: z.number().min(0).max(100).optional(),
});

const CreateSchema = z.object({
  tripId: z.string().refine(isValidObjectId).optional(),
  driverId: z.string().refine(isValidObjectId).optional(),
  vehicleId: z.string().refine(isValidObjectId).optional(),
  points: z.array(PointSchema).min(4, "Se requieren al menos 4 puntos GPS"),
});

/**
 * POST /api/rutas/[id]/captures
 *
 * Persiste una nueva captura GPS asociada a una Ruta. Llamado por:
 *   - El sistema cuando un Trip con `routeId` pasa a "completado"
 *     (hook en PATCH /api/viajes/[id]).
 *   - Manualmente por un operador para subir una captura externa.
 *
 * Calcula automáticamente: avgAccuracy, distanceMeters, durationSeconds
 * y qualityScore (0-100). La captura queda en status "raw" para revisión
 * antes de incluirla en una convergencia.
 *
 * GET /api/rutas/[id]/captures — Lista las capturas de una ruta.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = requireRole(request, [
    ROLES.SUPER_ADMIN, ROLES.ADMIN_MUNICIPAL, ROLES.OPERADOR, ROLES.CONDUCTOR,
  ]);
  if ("error" in auth) return auth.error === "unauthorized" ? apiUnauthorized() : apiForbidden();

  const { id } = await params;
  if (!isValidObjectId(id)) return apiError("ID inválido", 400);

  const json = await request.json().catch(() => ({}));
  const parsed = CreateSchema.safeParse(json);
  if (!parsed.success) {
    const errors: Record<string, string[]> = {};
    for (const i of parsed.error.issues) {
      const k = i.path[0]?.toString() ?? "general";
      errors[k] = [...(errors[k] ?? []), i.message];
    }
    return apiValidationError(errors);
  }

  await connectDB();
  const route = await Route.findById(id).select("_id municipalityId").lean();
  if (!route) return apiNotFound("Ruta no encontrada");
  if (!(await canAccessMunicipality(auth.session, String(route.municipalityId)))) return apiForbidden();

  const points = parsed.data.points.map((p) => ({
    lat: p.lat,
    lng: p.lng,
    ts: p.ts ? new Date(p.ts) : new Date(),
    accuracy: p.accuracy,
    speed: p.speed,
  }));

  // Métricas derivadas.
  const accuracies = points.map((p) => p.accuracy).filter((x): x is number => typeof x === "number");
  const avgAccuracy = accuracies.length > 0
    ? accuracies.reduce((s, a) => s + a, 0) / accuracies.length
    : undefined;

  const distanceMeters = polylineLengthMeters(points as GpsPoint[]);

  const sorted = [...points].sort((a, b) => a.ts.getTime() - b.ts.getTime());
  const durationSeconds = sorted.length >= 2
    ? Math.round((sorted[sorted.length - 1].ts.getTime() - sorted[0].ts.getTime()) / 1000)
    : undefined;

  const qualityScore = computeQualityScore({
    avgAccuracy,
    pointCount: points.length,
    durationSeconds,
    distanceMeters,
  });

  // Validar consistencia: el primer punto debería estar razonablemente
  // cerca del primer waypoint de la ruta (si tiene). Sino, es probable
  // que sea un trazado de otra ruta.
  // Heurística suave: si hay waypoints y el primer punto está a >2km del
  // primer waypoint, marcar status "raw" igualmente pero loguear.

  const doc = await RouteCapture.create({
    routeId: route._id,
    tripId: parsed.data.tripId,
    driverId: parsed.data.driverId,
    vehicleId: parsed.data.vehicleId,
    municipalityId: route.municipalityId,
    points,
    pointCount: points.length,
    avgAccuracy,
    distanceMeters,
    durationSeconds,
    qualityScore,
    status: "raw",
  });

  return apiResponse({
    id: String(doc._id),
    routeId: String(doc.routeId),
    pointCount: doc.pointCount,
    avgAccuracy: doc.avgAccuracy,
    distanceMeters: doc.distanceMeters,
    durationSeconds: doc.durationSeconds,
    qualityScore: doc.qualityScore,
    status: doc.status,
    createdAt: doc.createdAt,
  }, 201);
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = requireRole(request, [
    ROLES.SUPER_ADMIN, ROLES.ADMIN_MUNICIPAL, ROLES.ADMIN_PROVINCIAL, ROLES.OPERADOR, ROLES.FISCAL,
  ]);
  if ("error" in auth) return auth.error === "unauthorized" ? apiUnauthorized() : apiForbidden();

  const { id } = await params;
  if (!isValidObjectId(id)) return apiError("ID inválido", 400);

  await connectDB();
  const route = await Route.findById(id).select("_id municipalityId").lean();
  if (!route) return apiNotFound("Ruta no encontrada");
  if (!(await canAccessMunicipality(auth.session, String(route.municipalityId)))) return apiForbidden();

  const url = new URL(request.url);
  const status = url.searchParams.get("status"); // raw | validated | rejected | merged
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit") ?? 30)));

  const filter: Record<string, unknown> = { routeId: route._id };
  if (status && ["raw", "validated", "rejected", "merged"].includes(status)) {
    filter.status = status;
  }

  const items = await RouteCapture.find(filter)
    .select("_id routeId tripId driverId vehicleId pointCount avgAccuracy distanceMeters durationSeconds qualityScore status createdAt mergedAt")
    .populate("driverId", "name")
    .populate("vehicleId", "plate")
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();

  return apiResponse({
    items: items.map((c) => ({
      id: String(c._id),
      routeId: String(c.routeId),
      tripId: c.tripId ? String(c.tripId) : null,
      driver: c.driverId,
      vehicle: c.vehicleId,
      pointCount: c.pointCount,
      avgAccuracy: c.avgAccuracy,
      distanceMeters: c.distanceMeters,
      durationSeconds: c.durationSeconds,
      qualityScore: c.qualityScore,
      status: c.status,
      mergedAt: c.mergedAt,
      createdAt: c.createdAt,
    })),
  });
}

