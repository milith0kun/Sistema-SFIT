import { NextRequest } from "next/server";
import { isValidObjectId } from "mongoose";
import { connectDB } from "@/lib/db/mongoose";
import { FleetEntry } from "@/models/FleetEntry";
import "@/models/Vehicle";
import "@/models/Driver";
import { apiResponse, apiError, apiForbidden, apiUnauthorized } from "@/lib/api/response";
import { requireRole } from "@/lib/auth/guard";
import { ROLES } from "@/lib/constants";
import { canAccessMunicipality } from "@/lib/auth/rbac";
import type { ICurrentLocation } from "@/models/FleetEntry";

/**
 * GET /api/flota/active-locations
 * Retorna todos los vehículos con status=en_ruta que tienen posición GPS registrada.
 * Usado por el dashboard de admin_municipal para mostrar el mapa de flota activa.
 */
export async function GET(request: NextRequest) {
  const auth = requireRole(request, [
    ROLES.SUPER_ADMIN, ROLES.ADMIN_PROVINCIAL, ROLES.ADMIN_MUNICIPAL, ROLES.OPERADOR,
  ]);
  if ("error" in auth) return auth.error === "unauthorized" ? apiUnauthorized() : apiForbidden();

  await connectDB();

  const url = new URL(request.url);
  const municipalityIdParam = url.searchParams.get("municipalityId");

  const filter: Record<string, unknown> = { status: "en_ruta" };

  if (auth.session.role === ROLES.SUPER_ADMIN) {
    if (municipalityIdParam) {
      if (!isValidObjectId(municipalityIdParam)) return apiError("municipalityId inválido", 400);
      filter.municipalityId = municipalityIdParam;
    }
  } else {
    const targetId = municipalityIdParam ?? auth.session.municipalityId;
    if (!targetId || !isValidObjectId(targetId)) return apiForbidden();
    if (!(await canAccessMunicipality(auth.session, targetId))) return apiForbidden();
    filter.municipalityId = targetId;
  }

  const entries = await FleetEntry.find(filter)
    .populate("vehicleId", "plate brand model")
    .populate("driverId", "name")
    .populate("routeId", "code name")
    .select("vehicleId driverId routeId currentLocation departureTime status")
    .lean();

  const items = entries
    .filter((e) => {
      const loc = e.currentLocation as ICurrentLocation | undefined;
      return loc?.lat != null && loc?.lng != null;
    })
    .map((e) => {
      const loc = e.currentLocation as ICurrentLocation;
      const vehicle = e.vehicleId as { plate?: string; brand?: string; model?: string } | null;
      const driver = e.driverId as { name?: string } | null;
      const route = e.routeId as { code?: string; name?: string } | null;
      return {
        id: String(e._id),
        plate: vehicle?.plate ?? "—",
        vehicleLabel: vehicle ? `${vehicle.brand ?? ""} ${vehicle.model ?? ""}`.trim() : "—",
        driverName: driver?.name ?? "—",
        routeCode: route?.code ?? null,
        routeName: route?.name ?? null,
        lat: loc.lat,
        lng: loc.lng,
        locationUpdatedAt: loc.updatedAt,
        departureTime: e.departureTime ?? null,
      };
    });

  return apiResponse({ items, total: items.length });
}
