import { NextRequest } from "next/server";
import { isValidObjectId } from "mongoose";
import { connectDB } from "@/lib/db/mongoose";
import { RouteCapture } from "@/models/RouteCapture";
import { FleetEntry } from "@/models/FleetEntry";
import { Driver } from "@/models/Driver";
import { Vehicle } from "@/models/Vehicle";
import {
  apiResponse, apiError, apiForbidden, apiNotFound, apiUnauthorized,
} from "@/lib/api/response";
import { requireRole } from "@/lib/auth/guard";
import { canAccessMunicipality } from "@/lib/auth/rbac";
import { ROLES } from "@/lib/constants";
import { getOperatorCompanyId } from "@/lib/auth/operatorCompany";

/**
 * GET /api/rutas/candidatas/[id]
 *
 * Detalle completo de una captura — incluye TODOS los puntos GPS para
 * dibujar la polilínea exacta en el mapa del operador. La metadata del
 * conductor, vehículo y turno asociado va populated para evitar otra ronda.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = requireRole(request, [
    ROLES.SUPER_ADMIN, ROLES.ADMIN_MUNICIPAL, ROLES.OPERADOR,
  ]);
  if ("error" in auth) return auth.error === "unauthorized" ? apiUnauthorized() : apiForbidden();

  const { id } = await params;
  if (!isValidObjectId(id)) return apiError("ID inválido", 400);

  await connectDB();
  const cap = await RouteCapture.findById(id)
    .populate("driverId", "name dni phone companyId")
    .populate("vehicleId", "plate brand model companyId")
    .lean();
  if (!cap) return apiNotFound("Captura no encontrada");
  if (!(await canAccessMunicipality(auth.session, String(cap.municipalityId)))) return apiForbidden();

  // Operador: scope por empresa.
  if (auth.session.role === ROLES.OPERADOR) {
    const companyId = await getOperatorCompanyId(auth.session.userId);
    if (!companyId) return apiForbidden();
    const driverCompany = (cap.driverId as { companyId?: unknown } | null)?.companyId;
    const vehicleCompany = (cap.vehicleId as { companyId?: unknown } | null)?.companyId;
    const matches =
      (driverCompany && String(driverCompany) === companyId) ||
      (vehicleCompany && String(vehicleCompany) === companyId);
    if (!matches) return apiForbidden();
  }

  let fleetEntry: Record<string, unknown> | null = null;
  if (cap.fleetEntryId) {
    const fe = await FleetEntry.findById(cap.fleetEntryId)
      .select("date departureTime returnTime status startLocation endLocation distanceMeters durationSeconds")
      .lean();
    if (fe) {
      fleetEntry = {
        id: String(fe._id),
        date: fe.date,
        departureTime: fe.departureTime,
        returnTime: fe.returnTime,
        status: fe.status,
        startLocation: fe.startLocation,
        endLocation: fe.endLocation,
        distanceMeters: fe.distanceMeters,
        durationSeconds: fe.durationSeconds,
      };
    }
  }

  const points = (cap.points ?? []).map((p) => ({
    lat: p.lat,
    lng: p.lng,
    ts: p.ts,
    accuracy: p.accuracy,
    speed: p.speed,
  }));

  const driver = cap.driverId as { _id?: unknown; name?: string; dni?: string; phone?: string } | null;
  const vehicle = cap.vehicleId as { _id?: unknown; plate?: string; brand?: string; model?: string } | null;

  return apiResponse({
    id: String(cap._id),
    routeId: cap.routeId ? String(cap.routeId) : null,
    fleetEntryId: cap.fleetEntryId ? String(cap.fleetEntryId) : null,
    municipalityId: String(cap.municipalityId),
    status: cap.status,
    pointCount: cap.pointCount,
    avgAccuracy: cap.avgAccuracy ?? null,
    distanceMeters: cap.distanceMeters ?? null,
    durationSeconds: cap.durationSeconds ?? null,
    qualityScore: cap.qualityScore,
    proposedName: cap.proposedName ?? null,
    proposedCode: cap.proposedCode ?? null,
    proposedCompanyId: cap.proposedCompanyId ? String(cap.proposedCompanyId) : null,
    proposedOriginLabel: cap.proposedOriginLabel ?? null,
    proposedDestinationLabel: cap.proposedDestinationLabel ?? null,
    promotedToRouteId: cap.promotedToRouteId ? String(cap.promotedToRouteId) : null,
    driver: driver ? {
      id: driver._id ? String(driver._id) : null,
      name: driver.name ?? null,
      dni: driver.dni ?? null,
      phone: driver.phone ?? null,
    } : null,
    vehicle: vehicle ? {
      id: vehicle._id ? String(vehicle._id) : null,
      plate: vehicle.plate ?? null,
      brand: vehicle.brand ?? null,
      model: vehicle.model ?? null,
    } : null,
    fleetEntry,
    points,
    createdAt: cap.createdAt,
    updatedAt: cap.updatedAt,
  });
}

/**
 * DELETE /api/rutas/candidatas/[id]
 *
 * Borra DEFINITIVAMENTE una captura de ruta. Distinto al endpoint
 * `/descartar` que solo cambia el `status` a "rejected" — éste borra el
 * documento de Mongo y libera la asociación.
 *
 * No se puede borrar si la captura ya fue promovida a una Route oficial
 * (`promotedToRouteId != null`): primero hay que desvincular o eliminar la
 * Route. Permisos idénticos al GET (admin/operador con scope geográfico y
 * de empresa).
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = requireRole(request, [
    ROLES.SUPER_ADMIN,
    ROLES.ADMIN_REGIONAL,
    ROLES.ADMIN_PROVINCIAL,
    ROLES.ADMIN_MUNICIPAL,
    ROLES.OPERADOR,
  ]);
  if ("error" in auth) {
    return auth.error === "unauthorized" ? apiUnauthorized() : apiForbidden();
  }

  const { id } = await params;
  if (!isValidObjectId(id)) return apiError("ID inválido", 400);

  await connectDB();
  const cap = await RouteCapture.findById(id);
  if (!cap) return apiNotFound("Captura no encontrada");

  if (!(await canAccessMunicipality(auth.session, String(cap.municipalityId)))) {
    return apiForbidden();
  }

  // Operador: scope por empresa (mismo cálculo que GET).
  if (auth.session.role === ROLES.OPERADOR) {
    const companyId = await getOperatorCompanyId(auth.session.userId);
    if (!companyId) return apiForbidden();
    const driverDoc = cap.driverId
      ? await Driver.findById(cap.driverId).select("companyId").lean()
      : null;
    const vehicleDoc = cap.vehicleId
      ? await Vehicle.findById(cap.vehicleId).select("companyId").lean()
      : null;
    const matches =
      (driverDoc?.companyId && String(driverDoc.companyId) === companyId) ||
      (vehicleDoc?.companyId && String(vehicleDoc.companyId) === companyId);
    if (!matches) return apiForbidden();
  }

  if (cap.promotedToRouteId) {
    return apiError(
      "Esta captura ya fue promovida a una ruta oficial. Elimina o desvincula la ruta primero.",
      409,
    );
  }

  await cap.deleteOne();
  return apiResponse({ deleted: true, id: String(cap._id) });
}
