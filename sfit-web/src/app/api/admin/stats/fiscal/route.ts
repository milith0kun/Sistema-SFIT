import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db/mongoose";
import { Inspection } from "@/models/Inspection";
import { CitizenReport } from "@/models/CitizenReport";
import {
  apiResponse,
  apiError,
  apiForbidden,
  apiUnauthorized,
} from "@/lib/api/response";
import { requireRole } from "@/lib/auth/guard";
import { ROLES } from "@/lib/constants";

/**
 * GET /api/admin/stats/fiscal
 * Estadísticas de inspecciones y reportes para el rol Fiscal.
 * Filtra por municipalidad del usuario autenticado.
 */
export async function GET(request: NextRequest) {
  const auth = requireRole(request, [
    ROLES.FISCAL,
    ROLES.ADMIN_MUNICIPAL,
    ROLES.ADMIN_PROVINCIAL,
    ROLES.SUPER_ADMIN,
  ]);
  if ("error" in auth) {
    return auth.error === "unauthorized" ? apiUnauthorized() : apiForbidden();
  }

  const { municipalityId, role } = auth.session;
  // super_admin y admin_provincial no tienen municipalityId — devuelven totales globales
  const isSuperScope =
    role === ROLES.SUPER_ADMIN || role === ROLES.ADMIN_PROVINCIAL;
  if (!municipalityId && !isSuperScope) {
    return apiError("Sin municipalidad asignada", 400);
  }

  try {
    await connectDB();

    // Rango del mes en curso
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    // Para super_admin / admin_provincial sin municipio: totales globales
    const muniFilter = isSuperScope ? {} : { municipalityId };

    const [
      inspectionsThisMonth,
      inspectionsPending,
      reportsPending,
      reportsNewThisMonth,
    ] = await Promise.all([
      Inspection.countDocuments({
        ...muniFilter,
        date: { $gte: monthStart, $lte: monthEnd },
      }),
      Inspection.countDocuments({
        ...muniFilter,
        result: "observada",
      }),
      CitizenReport.countDocuments({
        ...muniFilter,
        status: { $in: ["pendiente", "revision"] },
      }),
      CitizenReport.countDocuments({
        ...muniFilter,
        createdAt: { $gte: monthStart, $lte: monthEnd },
      }),
    ]);

    return apiResponse({
      inspectionsThisMonth,
      inspectionsPending,
      reportsPending,
      reportsNewThisMonth,
    });
  } catch (error) {
    console.error("[admin/stats/fiscal GET]", error);
    return apiError("Error al obtener estadísticas de fiscal", 500);
  }
}
