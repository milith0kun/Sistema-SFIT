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
 * RF-02-07: Dashboard global del Super Admin / Admin Provincial.
 * super_admin     → métricas de toda la plataforma
 * admin_provincial→ métricas acotadas a su provincia
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

    const { role, provinceId, municipalityId } = auth.session;

    const roleList = [
      ROLES.SUPER_ADMIN,
      ROLES.ADMIN_PROVINCIAL,
      ROLES.ADMIN_MUNICIPAL,
      ROLES.FISCAL,
      ROLES.OPERADOR,
      ROLES.CONDUCTOR,
      ROLES.CIUDADANO,
    ];

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    // Calcular scope de municipios para admin_provincial
    let scopedMuniIds: string[] | null = null;
    if (role === ROLES.ADMIN_PROVINCIAL && provinceId) {
      const munis = await Municipality.find({ provinceId }).select("_id").lean();
      scopedMuniIds = munis.map((m) => String(m._id));
    }

    // Filtros base según rol
    const muniFilter = municipalityId
      ? { municipalityId }
      : scopedMuniIds
      ? { municipalityId: { $in: scopedMuniIds } }
      : {};

    const provinceFilter = scopedMuniIds ? { provinceId } : {};

    const userScopeFilter = municipalityId
      ? { municipalityId }
      : scopedMuniIds
      ? { provinceId }
      : {};

    const sanctionFilter = { ...muniFilter, createdAt: { $gte: monthStart, $lte: monthEnd } };
    const reportFilter = { ...muniFilter, status: { $in: ["pendiente", "revision"] } };

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
      Municipality.countDocuments(scopedMuniIds ? { provinceId } : {}),
      Municipality.countDocuments(scopedMuniIds ? { provinceId, active: true } : { active: true }),
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
