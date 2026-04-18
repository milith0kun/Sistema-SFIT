import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db/mongoose";
import { User } from "@/models/User";
import { Province } from "@/models/Province";
import { Municipality } from "@/models/Municipality";
import { Company } from "@/models/Company";
import { VehicleType } from "@/models/VehicleType";
import {
  apiResponse,
  apiError,
  apiForbidden,
  apiUnauthorized,
} from "@/lib/api/response";
import { requireRole } from "@/lib/auth/guard";
import { ROLES, USER_STATUS } from "@/lib/constants";

/**
 * RF-02-07: Dashboard global del Super Admin.
 * Devuelve métricas agregadas de toda la plataforma.
 *
 * Nota: `sanctionsThisMonth` y `reportsPending` son placeholders — aún
 * no existen los modelos de Sanción / Reporte ciudadano (RF-12 / RF-13).
 */
export async function GET(request: NextRequest) {
  const auth = requireRole(request, [ROLES.SUPER_ADMIN]);
  if ("error" in auth) {
    return auth.error === "unauthorized" ? apiUnauthorized() : apiForbidden();
  }

  try {
    await connectDB();

    const roleList = [
      ROLES.SUPER_ADMIN,
      ROLES.ADMIN_PROVINCIAL,
      ROLES.ADMIN_MUNICIPAL,
      ROLES.FISCAL,
      ROLES.OPERADOR,
      ROLES.CONDUCTOR,
      ROLES.CIUDADANO,
    ];

    const [
      provincesCount,
      municipalitiesCount,
      activeMunicipalities,
      usersPendingApproval,
      companiesCount,
      vehicleTypesCount,
      ...roleCounts
    ] = await Promise.all([
      Province.countDocuments({}),
      Municipality.countDocuments({}),
      Municipality.countDocuments({ active: true }),
      User.countDocuments({ status: USER_STATUS.PENDIENTE }),
      Company.countDocuments({}),
      VehicleType.countDocuments({}),
      ...roleList.map((r) => User.countDocuments({ role: r })),
    ]);

    const usersByRole = roleList.reduce<Record<string, number>>(
      (acc, role, idx) => {
        acc[role] = roleCounts[idx] ?? 0;
        return acc;
      },
      {},
    );

    return apiResponse({
      provincesCount,
      municipalitiesCount,
      activeMunicipalities,
      usersByRole,
      usersPendingApproval,
      companiesCount,
      vehicleTypesCount,
      // TODO: poblar cuando existan los modelos de Sanción y Reporte.
      sanctionsThisMonth: 0,
      reportsPending: 0,
    });
  } catch (error) {
    console.error("[admin/stats/global GET]", error);
    return apiError("Error al obtener estadísticas globales", 500);
  }
}
