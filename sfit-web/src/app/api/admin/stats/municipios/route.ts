import { NextRequest } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db/mongoose";
import { Inspection } from "@/models/Inspection";
import { CitizenReport } from "@/models/CitizenReport";
import { Sanction } from "@/models/Sanction";
import { Municipality } from "@/models/Municipality";
import { apiResponse, apiError, apiForbidden, apiUnauthorized } from "@/lib/api/response";
import { requireRole } from "@/lib/auth/guard";
import { ROLES } from "@/lib/constants";

type MunicipioRow = {
  municipioId: string;
  municipioNombre: string;
  inspecciones: number;
  aprobadas: number;
  aprobadasPct: number;
  reportes: number;
  sanciones: number;
};

/**
 * GET /api/admin/stats/municipios
 * Agrega métricas por municipalidad usando $group.
 * Roles: super_admin, admin_provincial
 */
export async function GET(request: NextRequest) {
  const auth = requireRole(request, [ROLES.SUPER_ADMIN, ROLES.ADMIN_PROVINCIAL]);
  if ("error" in auth) {
    return auth.error === "unauthorized" ? apiUnauthorized() : apiForbidden();
  }

  try {
    await connectDB();

    // Build optional province scope for admin_provincial
    let municipioIds: mongoose.Types.ObjectId[] | null = null;
    if (auth.session.role === ROLES.ADMIN_PROVINCIAL && auth.session.provinceId) {
      const munis = await Municipality.find({ provinceId: auth.session.provinceId })
        .select("_id")
        .lean();
      municipioIds = munis.map((m) => m._id as mongoose.Types.ObjectId);
    }

    const muniMatch = municipioIds
      ? { municipalityId: { $in: municipioIds } }
      : {};

    const [inspAgg, reportAgg, sanctAgg, municipios] = await Promise.all([
      // Inspecciones agrupadas por municipio
      Inspection.aggregate([
        { $match: muniMatch },
        {
          $group: {
            _id: "$municipalityId",
            total: { $sum: 1 },
            aprobadas: { $sum: { $cond: [{ $eq: ["$result", "aprobada"] }, 1, 0] } },
          },
        },
      ]),
      // Reportes agrupados por municipio
      CitizenReport.aggregate([
        { $match: muniMatch },
        { $group: { _id: "$municipalityId", total: { $sum: 1 } } },
      ]),
      // Sanciones agrupadas por municipio
      Sanction.aggregate([
        { $match: muniMatch },
        { $group: { _id: "$municipalityId", total: { $sum: 1 } } },
      ]),
      // Todos los municipios del scope
      Municipality.find(municipioIds ? { _id: { $in: municipioIds } } : {})
        .select("_id name")
        .lean(),
    ]);

    // Build lookup maps
    const inspMap = new Map<string, { total: number; aprobadas: number }>();
    for (const row of inspAgg) {
      inspMap.set(String(row._id), { total: row.total as number, aprobadas: row.aprobadas as number });
    }
    const reportMap = new Map<string, number>();
    for (const row of reportAgg) {
      reportMap.set(String(row._id), row.total as number);
    }
    const sanctMap = new Map<string, number>();
    for (const row of sanctAgg) {
      sanctMap.set(String(row._id), row.total as number);
    }

    const rows: MunicipioRow[] = municipios.map((m) => {
      const id = String(m._id);
      const insp = inspMap.get(id) ?? { total: 0, aprobadas: 0 };
      const reportes = reportMap.get(id) ?? 0;
      const sanciones = sanctMap.get(id) ?? 0;
      const aprobadasPct = insp.total > 0 ? Math.round((insp.aprobadas / insp.total) * 100) : 0;
      return {
        municipioId: id,
        municipioNombre: m.name,
        inspecciones: insp.total,
        aprobadas: insp.aprobadas,
        aprobadasPct,
        reportes,
        sanciones,
      };
    });

    // Sort by inspecciones desc
    rows.sort((a, b) => b.inspecciones - a.inspecciones);

    return apiResponse({ rows });
  } catch (error) {
    console.error("[admin/stats/municipios GET]", error);
    return apiError("Error al obtener estadísticas por municipio", 500);
  }
}
