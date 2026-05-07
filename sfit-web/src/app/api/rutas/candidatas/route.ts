import { NextRequest } from "next/server";
import { isValidObjectId } from "mongoose";
import { connectDB } from "@/lib/db/mongoose";
import { RouteCapture } from "@/models/RouteCapture";
import { Driver } from "@/models/Driver";
import { Vehicle } from "@/models/Vehicle";
import {
  apiResponse, apiError, apiForbidden, apiUnauthorized,
} from "@/lib/api/response";
import { requireRole } from "@/lib/auth/guard";
import { canAccessMunicipality } from "@/lib/auth/rbac";
import { ROLES } from "@/lib/constants";
import { getOperatorCompanyId } from "@/lib/auth/operatorCompany";
import { samplePolyline } from "@/lib/routes/sample";

const VALID_STATUS = ["candidate", "raw", "validated", "rejected", "merged"] as const;
type CaptureStatus = (typeof VALID_STATUS)[number];

/**
 * GET /api/rutas/candidatas
 *
 * Lista capturas GPS para que el operador las revise y promueva (o descarte).
 * Por defecto devuelve sólo `status="candidate"` — capturas creadas al cerrar
 * un turno SIN routeId. El operador desde el panel decide:
 *   - validar  → crear una nueva Route con esos waypoints (POST [id]/validar)
 *   - asignar  → vincularla a una Route existente (POST [id]/asignar)
 *   - descartar → marcarla como rejected (POST [id]/descartar)
 *
 * Query:
 *   - municipalityId (opcional, scope override para super_admin)
 *   - status         (opcional, default "candidate")
 *   - limit          (opcional, default 30, max 100)
 *
 * Cada item incluye un `samplePolyline` (hasta 30 puntos uniformemente
 * muestreados) para previsualización en mapa sin enviar el array completo.
 */
export async function GET(request: NextRequest) {
  const auth = requireRole(request, [
    ROLES.SUPER_ADMIN, ROLES.ADMIN_MUNICIPAL, ROLES.OPERADOR,
  ]);
  if ("error" in auth) return auth.error === "unauthorized" ? apiUnauthorized() : apiForbidden();

  await connectDB();

  const url = new URL(request.url);
  const muniParam = url.searchParams.get("municipalityId");
  const statusParam = url.searchParams.get("status") ?? "candidate";
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit") ?? 30)));

  if (!VALID_STATUS.includes(statusParam as CaptureStatus)) {
    return apiError("status inválido", 400);
  }

  // Scope por rol.
  const filter: Record<string, unknown> = { status: statusParam };

  if (auth.session.role === ROLES.SUPER_ADMIN) {
    if (muniParam) {
      if (!isValidObjectId(muniParam)) return apiError("municipalityId inválido", 400);
      filter.municipalityId = muniParam;
    }
  } else {
    const target = muniParam ?? auth.session.municipalityId;
    if (!target || !isValidObjectId(target)) return apiForbidden();
    if (!(await canAccessMunicipality(auth.session, target))) return apiForbidden();
    filter.municipalityId = target;
  }

  // Operador: acotar al subset cuya empresa coincide (via vehicle/driver).
  // Si no tiene empresa devolvemos lista vacía.
  if (auth.session.role === ROLES.OPERADOR) {
    const companyId = await getOperatorCompanyId(auth.session.userId);
    if (!companyId) return apiResponse({ items: [], total: 0 });
    const drivers = await Driver.find({ companyId }).select("_id").lean();
    const vehicles = await Vehicle.find({ companyId }).select("_id").lean();
    const driverIds = drivers.map((d) => d._id);
    const vehicleIds = vehicles.map((v) => v._id);
    if (driverIds.length === 0 && vehicleIds.length === 0) {
      return apiResponse({ items: [], total: 0 });
    }
    const orClauses: Record<string, unknown>[] = [];
    if (driverIds.length) orClauses.push({ driverId: { $in: driverIds } });
    if (vehicleIds.length) orClauses.push({ vehicleId: { $in: vehicleIds } });
    filter.$or = orClauses;
  }

  const captures = await RouteCapture.find(filter)
    .populate("driverId", "name")
    .populate("vehicleId", "plate")
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();

  const total = await RouteCapture.countDocuments(filter);

  const items = captures.map((c) => {
    const points = (c.points ?? []) as Array<{ lat: number; lng: number }>;
    return {
      id: String(c._id),
      fleetEntryId: c.fleetEntryId ? String(c.fleetEntryId) : null,
      driverId: c.driverId ? String((c.driverId as { _id?: unknown })._id ?? c.driverId) : null,
      driverName: (c.driverId as { name?: string } | null)?.name ?? null,
      vehicleId: c.vehicleId ? String((c.vehicleId as { _id?: unknown })._id ?? c.vehicleId) : null,
      vehiclePlate: (c.vehicleId as { plate?: string } | null)?.plate ?? null,
      distanceMeters: c.distanceMeters ?? null,
      durationSeconds: c.durationSeconds ?? null,
      pointCount: c.pointCount,
      qualityScore: c.qualityScore,
      samplePolyline: samplePolyline(points, 30),
      status: c.status,
      proposedName: c.proposedName ?? null,
      proposedCode: c.proposedCode ?? null,
      createdAt: c.createdAt,
    };
  });

  return apiResponse({ items, total });
}

