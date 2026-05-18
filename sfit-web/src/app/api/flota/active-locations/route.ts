import { NextRequest } from "next/server";
import { isValidObjectId } from "mongoose";
import { connectDB } from "@/lib/db/mongoose";
import { FleetEntry } from "@/models/FleetEntry";
import { Vehicle } from "@/models/Vehicle";
import { Company } from "@/models/Company";
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
    ROLES.SUPER_ADMIN, ROLES.ADMIN_MUNICIPAL, ROLES.OPERADOR,
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
    .populate("vehicleId", "plate brand model companyId")
    .populate("driverId", "name")
    .populate("routeId", "code name")
    .select("vehicleId driverId routeId currentLocation departureTime status")
    .lean();

  // Resolver `serviceScope` por entry: lo necesitamos para que el mapa admin
  // pueda filtrar por modalidad (urbano/interprov). El scope vive en
  // `Company`, así que hacemos un lookup en bulk y mapeamos por vehicleId.
  const companyIdsRaw = entries
    .map((e) => {
      const v = e.vehicleId as { companyId?: unknown } | null;
      return v?.companyId ? String(v.companyId) : null;
    })
    .filter((x): x is string => x != null);
  const companyIds = Array.from(new Set(companyIdsRaw));
  const scopeByCompany = new Map<string, string>();
  if (companyIds.length > 0) {
    const companies = await Company.find({ _id: { $in: companyIds } })
      .select("_id serviceScope")
      .lean<Array<{ _id: unknown; serviceScope?: string }>>();
    for (const c of companies) {
      scopeByCompany.set(String(c._id), c.serviceScope ?? "urbano");
    }
  }
  // Marcador del modelo Vehicle también, por consistencia (devolvemos el
  // `vehicleTypeKey` para que el frontend pueda colorear distinto sin
  // depender solo del scope).
  void Vehicle;

  const items = entries
    .filter((e) => {
      const loc = e.currentLocation as ICurrentLocation | undefined;
      return loc?.lat != null && loc?.lng != null;
    })
    .map((e) => {
      const loc = e.currentLocation as ICurrentLocation;
      const vehicle = e.vehicleId as {
        plate?: string;
        brand?: string;
        model?: string;
        companyId?: unknown;
      } | null;
      const driver = e.driverId as { name?: string } | null;
      const route = e.routeId as { code?: string; name?: string } | null;
      const companyKey = vehicle?.companyId ? String(vehicle.companyId) : null;
      const serviceScope = companyKey
        ? scopeByCompany.get(companyKey) ?? "urbano"
        : "urbano";
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
        serviceScope,
      };
    });

  return apiResponse({ items, total: items.length });
}
