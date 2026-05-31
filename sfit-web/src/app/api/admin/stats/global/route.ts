import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db/mongoose";
import { User } from "@/models/User";
import { Province } from "@/models/Province";
import { Municipality } from "@/models/Municipality";
import { Company } from "@/models/Company";
import { VehicleType } from "@/models/VehicleType";
import { Sanction } from "@/models/Sanction";
import { CitizenReport } from "@/models/CitizenReport";
import {
  apiResponse,
  apiError,
  apiForbidden,
  apiUnauthorized,
} from "@/lib/api/response";
import { requireRole } from "@/lib/auth/guard";
import { ROLES, USER_STATUS } from "@/lib/constants";

/**
 * RF-02-07: Dashboard global del Super Admin / Admin Municipal.
 * super_admin     → métricas de toda la plataforma
 * admin_municipal → métricas acotadas a su municipalidad
 */
export async function GET(request: NextRequest) {
  const auth = requireRole(request, [
    ROLES.SUPER_ADMIN,
    ROLES.ADMIN_MUNICIPAL,
  ]);
  if ("error" in auth) {
    return auth.error === "unauthorized" ? apiUnauthorized() : apiForbidden();
  }

  try {
    await connectDB();

    const { municipalityId } = auth.session;

    const roleList = [
      ROLES.SUPER_ADMIN,
      ROLES.ADMIN_MUNICIPAL,
      ROLES.FISCAL,
      ROLES.OPERADOR,
      ROLES.CONDUCTOR,
      ROLES.CIUDADANO,
    ];

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    // Filtros base según rol: super_admin → globales; admin_municipal → su muni
    const muniFilter = municipalityId ? { municipalityId } : {};
    const provinceFilter = {};
    const userScopeFilter = municipalityId ? { municipalityId } : {};

    const sanctionFilter = { ...muniFilter, createdAt: { $gte: monthStart, $lte: monthEnd } };
    const reportFilter = { ...muniFilter, status: { $in: ["pendiente", "revision"] as const } };

    const [
      provincesCount,
      municipalitiesCount,
      activeMunicipalities,
      usersPendingApproval,
      companiesCount,
      vehicleTypesCount,
      sanctionsThisMonth,
      reportsPending,
      ...roleCounts
    ] = await Promise.all([
      Province.countDocuments(provinceFilter),
      Municipality.countDocuments({}),
      Municipality.countDocuments({ active: true }),
      User.countDocuments({ ...userScopeFilter, status: USER_STATUS.PENDIENTE }),
      Company.countDocuments(muniFilter),
      VehicleType.countDocuments({}),
      Sanction.countDocuments(sanctionFilter),
      CitizenReport.countDocuments(reportFilter),
      ...roleList.map((r) => User.countDocuments({ role: r, ...userScopeFilter })),
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
      sanctionsThisMonth,
      reportsPending,
    });
  } catch (error) {
    console.error("[admin/stats/global GET]", error);
    return apiError("Error al obtener estadísticas globales", 500);
  }
}
