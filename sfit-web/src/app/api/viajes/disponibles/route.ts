import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db/mongoose";
import { Trip } from "@/models/Trip";
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
 * Si el operador filtra por empresa al crear el viaje (vehicleId/routeId
 * vinculan a una empresa), aquí se podría filtrar por la empresa del
 * conductor — TODO cuando exista campo `Driver.companyId`.
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
