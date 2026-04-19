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
 * RF-02-07: Dashboard global del Super Admin / Admin Provincial / Admin Municipal.
 * Devuelve métricas agregadas de toda la plataforma.
 */
export async function GET(request: NextRequest) {
  const auth = requireRole(request, [
    ROLES.SUPER_ADMIN,
    ROLES.ADMIN_PROVINCIAL,
    ROLES.ADMIN_MUNICIPAL,
  ]);
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

    // Rango del mes en curso
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    // Para admin_provincial y admin_municipal, filtrar por su scope
    const sanctionFilter =
      auth.session.role === ROLES.SUPER_ADMIN
        ? { createdAt: { $gte: monthStart, $lte: monthEnd } }
        : auth.session.municipalityId
        ? { municipalityId: auth.session.municipalityId, createdAt: { $gte: monthStart, $lte: monthEnd } }
        : { createdAt: { $gte: monthStart, $lte: monthEnd } };

    const reportFilter =
      auth.session.role === ROLES.SUPER_ADMIN
        ? { status: { $in: ["pendiente", "revision"] } }
        : auth.session.municipalityId
        ? { municipalityId: auth.session.municipalityId, status: { $in: ["pendiente", "revision"] } }
        : { status: { $in: ["pendiente", "revision"] } };

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
      Province.countDocuments({}),
      Municipality.countDocuments({}),
      Municipality.countDocuments({ active: true }),
      User.countDocuments({ status: USER_STATUS.PENDIENTE }),
      Company.countDocuments({}),
      VehicleType.countDocuments({}),
      Sanction.countDocuments(sanctionFilter),
      CitizenReport.countDocuments(reportFilter),
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
      sanctionsThisMonth,
      reportsPending,
    });
  } catch (error) {
    console.error("[admin/stats/global GET]", error);
    return apiError("Error al obtener estadísticas globales", 500);
  }
}
