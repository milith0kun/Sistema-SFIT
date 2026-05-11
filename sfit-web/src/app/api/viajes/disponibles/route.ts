import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db/mongoose";
import { Trip } from "@/models/Trip";
import { Vehicle } from "@/models/Vehicle";
import {
  apiResponse, apiError, apiForbidden, apiUnauthorized,
} from "@/lib/api/response";
import { requireRole } from "@/lib/auth/guard";
import { resolveDriverFromSession } from "@/lib/auth/driverFromSession";
import { ROLES } from "@/lib/constants";

/**
 * GET /api/viajes/disponibles
 *
 * Catálogo PULL: lista los viajes que están en `pendiente_aceptacion`
 * SIN driver asignado, dentro de la municipalidad del conductor.
 *
 * Pensado para el flujo "conductor elige ruta del día" (autoservicio).
 * Los viajes que aparecen aquí los puede reclamar con
 * `POST /api/viajes/[id]/tomar`.
 *
 * Si el `Driver.companyId` está asignado, se filtra adicionalmente para que
 * el conductor SOLO vea viajes de vehículos de su empresa. Sin companyId
 * (conductor que no se asoció a empresa todavía) cae al filtro por
 * municipalidad para no romper el flujo legacy.
 */
export async function GET(request: NextRequest) {
  const auth = requireRole(request, [ROLES.CONDUCTOR]);
  if ("error" in auth) return auth.error === "unauthorized" ? apiUnauthorized() : apiForbidden();

  try {
    await connectDB();
    const driver = await resolveDriverFromSession(auth.session);
    if (!driver) return apiResponse({ items: [], total: 0 });

    const url = new URL(request.url);
    const limit = Math.min(50, Math.max(1, Number(url.searchParams.get("limit") ?? 20)));

    const filter: Record<string, unknown> = {
      municipalityId: driver.municipalityId,
      status: "pendiente_aceptacion",
      driverId: { $exists: false },
    };

    // Filtro por empresa: Trip no tiene `companyId` directo, pero sí tiene
    // vehicleId required. Resolvemos los vehículos de la empresa del
    // conductor y limitamos los Trips a ellos. Si el conductor todavía no
    // está asociado a empresa, mantenemos el filtro por municipalidad como
    // antes — fallback de compat.
    if (driver.companyId) {
      const vehicleIds = await Vehicle.find({ companyId: driver.companyId })
        .select("_id")
        .lean<Array<{ _id: unknown }>>();
      if (vehicleIds.length === 0) {
        return apiResponse({ items: [], total: 0 });
      }
      filter.vehicleId = { $in: vehicleIds.map((v) => v._id) };
    }

    const [items, total] = await Promise.all([
      Trip.find(filter)
        .populate("vehicleId", "plate brand model vehicleTypeKey")
        .populate("routeId", "code name direction siblingRouteId")
        .sort({ assignedAt: -1, startTime: -1 })
        .limit(limit)
        .lean(),
      Trip.countDocuments(filter),
    ]);

    return apiResponse({
      items: items.map((t) => ({
        id: String(t._id),
        startTime: t.startTime,
        expectedReturnTime: t.expectedReturnTime,
        direction: t.direction,
        vehicle: t.vehicleId,
        route: t.routeId,
        createdAt: t.createdAt,
      })),
      total,
    });
  } catch (error) {
    console.error("[viajes/disponibles GET]", error);
    return apiError("Error al listar viajes disponibles", 500);
  }
}
