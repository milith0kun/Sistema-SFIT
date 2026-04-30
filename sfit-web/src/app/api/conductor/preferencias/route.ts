import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db/mongoose";
import { Driver } from "@/models/Driver";
import { Vehicle } from "@/models/Vehicle";
import { Route as RouteModel } from "@/models/Route";
import { apiResponse, apiError, apiUnauthorized, apiForbidden } from "@/lib/api/response";
import { requireRole } from "@/lib/auth/guard";
import { ROLES } from "@/lib/constants";

/**
 * GET /api/conductor/preferencias
 * Devuelve el último vehículo y la última ruta operada por el conductor.
 * Si el vehículo dejó de estar disponible, lo omite.
 * Sirve para pre-seleccionar opciones al iniciar turno (RF: "el sistema sugiere lo que ya usé").
 */
export async function GET(request: NextRequest) {
  const auth = requireRole(request, [ROLES.CONDUCTOR]);
  if ("error" in auth) return auth.error === "unauthorized" ? apiUnauthorized() : apiForbidden();

  try {
    await connectDB();

    const driver = await Driver.findOne({ userId: auth.session.userId })
      .select("currentVehicleId lastRouteId")
      .lean();
    if (!driver) {
      return apiResponse({ vehicle: null, route: null });
    }

    const [vehicle, route] = await Promise.all([
      driver.currentVehicleId
        ? Vehicle.findOne({ _id: driver.currentVehicleId, active: true })
            .select("plate brand model vehicleTypeKey status")
            .lean()
        : Promise.resolve(null),
      driver.lastRouteId
        ? RouteModel.findOne({ _id: driver.lastRouteId })
            .select("code name type stops length status")
            .lean()
        : Promise.resolve(null),
    ]);

    return apiResponse({
      vehicle: vehicle
        ? {
            id: String(vehicle._id),
            plate: vehicle.plate,
            brand: vehicle.brand,
            model: vehicle.model,
            vehicleTypeKey: vehicle.vehicleTypeKey,
            status: vehicle.status,
          }
        : null,
      route: route
        ? {
            id: String(route._id),
            code: route.code,
            name: route.name,
            type: route.type,
            stops: route.stops,
            length: route.length,
            status: route.status,
          }
        : null,
    });
  } catch (error) {
    console.error("[conductor/preferencias GET]", error);
    return apiError("Error al cargar tus preferencias", 500);
  }
}
