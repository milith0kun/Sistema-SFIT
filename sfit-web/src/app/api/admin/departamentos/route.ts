import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db/mongoose";
import { Province } from "@/models/Province";
import { Municipality } from "@/models/Municipality";
import {
  apiResponse,
  apiError,
  apiForbidden,
  apiUnauthorized,
} from "@/lib/api/response";
import { requireRole } from "@/lib/auth/guard";
import { ROLES } from "@/lib/constants";

/**
 * GET /api/admin/departamentos
 *
 * Lista los 25 departamentos del catálogo UBIGEO con conteos derivados:
 *   - provinceCount             : cuántas provincias UBIGEO tiene
 *   - totalMunicipalityCount    : cuántos distritos UBIGEO tiene
 *   - activeMunicipalityCount   : cuántos están incorporados al sistema
 *
 * Solo super_admin (vista nacional cross-tenant).
 */
export async function GET(request: NextRequest) {
  const auth = requireRole(request, [ROLES.SUPER_ADMIN]);
  if ("error" in auth) {
    return auth.error === "unauthorized" ? apiUnauthorized() : apiForbidden();
  }

  try {
    await connectDB();

    const [provinceAgg, muniAgg] = await Promise.all([
      Province.aggregate<{
        _id: string;
        departmentName: string;
        provinceCount: number;
      }>([
        { $match: { departmentCode: { $exists: true, $ne: null } } },
        {
          $group: {
            _id: "$departmentCode",
            departmentName: { $first: "$departmentName" },
            provinceCount: { $sum: 1 },
          },
        },
      ]),
      Municipality.aggregate<{
        _id: string;
        total: number;
        active: number;
      }>([
        { $match: { departmentCode: { $exists: true, $ne: null } } },
        {
          $group: {
            _id: "$departmentCode",
            total: { $sum: 1 },
            active: { $sum: { $cond: ["$active", 1, 0] } },
          },
        },
      ]),
    ]);

    const muniByCode = new Map(muniAgg.map((m) => [m._id, m]));

    const items = provinceAgg
      .map((p) => {
        const muni = muniByCode.get(p._id);
        return {
          code: p._id,
          name: p.departmentName ?? "(sin nombre)",
          provinceCount: p.provinceCount,
          totalMunicipalityCount: muni?.total ?? 0,
          activeMunicipalityCount: muni?.active ?? 0,
        };
      })
      .sort((a, b) => a.code.localeCompare(b.code));

    return apiResponse({ items, total: items.length });
  } catch (error) {
    console.error("[admin/departamentos GET]", error);
    return apiError("Error al listar departamentos", 500);
  }
}
