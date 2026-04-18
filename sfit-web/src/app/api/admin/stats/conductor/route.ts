import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db/mongoose";
import { Driver } from "@/models/Driver";
import { Trip } from "@/models/Trip";
import { User } from "@/models/User";
import {
  apiResponse,
  apiError,
  apiForbidden,
  apiNotFound,
  apiUnauthorized,
} from "@/lib/api/response";
import { requireRole } from "@/lib/auth/guard";
import { ROLES } from "@/lib/constants";

/**
 * GET /api/admin/stats/conductor
 * Estadísticas de fatiga y viajes para el conductor autenticado.
 */
export async function GET(request: NextRequest) {
  const auth = requireRole(request, [
    ROLES.CONDUCTOR,
    ROLES.ADMIN_MUNICIPAL,
    ROLES.SUPER_ADMIN,
  ]);
  if ("error" in auth) {
    return auth.error === "unauthorized" ? apiUnauthorized() : apiForbidden();
  }

  try {
    await connectDB();

    // Resolver el registro de conductor por DNI del usuario
    const user = await User.findById(auth.session.userId).lean();
    if (!user) return apiUnauthorized();

    let driver = null;

    if (user.dni) {
      driver = await Driver.findOne({ dni: user.dni, active: true }).lean();
    }

    if (!driver && user.name) {
      const nameParts = user.name.trim().split(/\s+/).filter(Boolean);
      const searchTerm = nameParts.slice(0, 2).join(" ");
      driver = await Driver.findOne({
        name: { $regex: searchTerm, $options: "i" },
        active: true,
      }).lean();
    }

    if (!driver) {
      return apiNotFound("No se encontró registro de conductor asociado a tu cuenta");
    }

    // Viajes del día
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const tripsToday = await Trip.countDocuments({
      driverId: driver._id,
      startTime: { $gte: todayStart, $lte: todayEnd },
    });

    return apiResponse({
      status: driver.status,
      continuousHours: driver.continuousHours,
      restHours: driver.restHours,
      reputationScore: driver.reputationScore,
      tripsToday,
      currentVehicleId: driver.currentVehicleId ? String(driver.currentVehicleId) : undefined,
    });
  } catch (error) {
    console.error("[admin/stats/conductor GET]", error);
    return apiError("Error al obtener estadísticas del conductor", 500);
  }
}
