import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db/mongoose";
import { Vehicle } from "@/models/Vehicle";
import { Driver } from "@/models/Driver";
import {
  apiResponse,
  apiError,
  apiForbidden,
  apiUnauthorized,
} from "@/lib/api/response";
import { requireRole } from "@/lib/auth/guard";
import { ROLES, VEHICLE_STATUS, DRIVER_STATUS } from "@/lib/constants";

/**
 * GET /api/admin/stats/operador
 * Estadísticas de flota para el rol Operador.
 * Filtra por municipalidad del usuario autenticado.
 */
export async function GET(request: NextRequest) {
  const auth = requireRole(request, [
    ROLES.OPERADOR,
    ROLES.ADMIN_MUNICIPAL,
    
    ROLES.SUPER_ADMIN,
  ]);
  if ("error" in auth) {
    return auth.error === "unauthorized" ? apiUnauthorized() : apiForbidden();
  }

  const { municipalityId, role } = auth.session;
  // super_admin no tiene municipalityId — devuelve totales globales
  const isSuperScope = role === ROLES.SUPER_ADMIN;
  if (!municipalityId && !isSuperScope) {
    return apiError("Sin municipalidad asignada", 400);
  }

  try {
    await connectDB();

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    // Para super_admin sin municipio: totales globales
    const muniFilter = isSuperScope ? {} : { municipalityId };

    const [
      totalVehicles,
      activeVehicles,
      vehiclesEnRuta,
      activeDrivers,
    ] = await Promise.all([
      Vehicle.countDocuments({ ...muniFilter, active: true }),
      Vehicle.countDocuments({
        ...muniFilter,
        active: true,
        status: { $in: [VEHICLE_STATUS.DISPONIBLE, VEHICLE_STATUS.EN_RUTA] },
      }),
      Vehicle.countDocuments({
        ...muniFilter,
        active: true,
        status: VEHICLE_STATUS.EN_RUTA,
      }),
      Driver.countDocuments({
        ...muniFilter,
        active: true,
        status: DRIVER_STATUS.APTO,
      }),
    ]);

    return apiResponse({
      totalVehicles,
      activeVehicles,
      vehiclesEnRuta,
      activeDrivers,
    });
  } catch (error) {
    console.error("[admin/stats/operador GET]", error);
    return apiError("Error al obtener estadísticas de operador", 500);
  }
}
