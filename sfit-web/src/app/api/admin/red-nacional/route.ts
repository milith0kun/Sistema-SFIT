import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db/mongoose";
import { Province } from "@/models/Province";
import { Municipality } from "@/models/Municipality";
import { Company } from "@/models/Company";
import {
  apiResponse, apiError, apiForbidden, apiUnauthorized,
} from "@/lib/api/response";
import { requireRole } from "@/lib/auth/guard";
import { ROLES } from "@/lib/constants";

/**
 * GET /api/admin/red-nacional
 *
 * Devuelve la jerarquía Departamento → Provincia con conteos de distritos
 * activos y empresas por modalidad. Los distritos individuales se omiten;
 * se cargan vía /api/municipalidades?provinceId= cuando se expande la provincia.
 *
 * Solo super_admin.
 */
export async function GET(request: NextRequest) {
  const auth = requireRole(request, [ROLES.SUPER_ADMIN]);
  if ("error" in auth) {
    return auth.error === "unauthorized" ? apiUnauthorized() : apiForbidden();
  }

  try {
    await connectDB();

    const [provinces, muniByProvAgg, companiesAgg] = await Promise.all([
      Province.find({ ubigeoCode: { $exists: true, $ne: null } })
        .select("name ubigeoCode departmentCode departmentName active")
        .sort({ departmentCode: 1, name: 1 })
        .lean<Array<{
          _id: unknown; name: string; ubigeoCode?: string;
          departmentCode?: string; departmentName?: string; active?: boolean;
        }>>(),

      Municipality.aggregate<{ _id: string; total: number; active: number }>([
        { $match: { provinceCode: { $exists: true, $ne: null } } },
        {
          $group: {
            _id: "$provinceCode",
            total: { $sum: 1 },
            active: { $sum: { $cond: ["$active", 1, 0] } },
          },
        },
      ]),

      Company.aggregate<{ _id: { dept: string; scope: string }; n: number }>([
        { $match: { "coverage.departmentCodes": { $exists: true, $ne: [] } } },
        { $unwind: "$coverage.departmentCodes" },
        {
          $group: {
            _id: { dept: "$coverage.departmentCodes", scope: "$serviceScope" },
            n: { $sum: 1 },
          },
        },
      ]),
    ]);

    const muniByProv = new Map(muniByProvAgg.map((m) => [m._id, m]));
    const companiesByDept = new Map<string, Record<string, number>>();
    for (const c of companiesAgg) {
      const cur = companiesByDept.get(c._id.dept) ?? {};
      cur[c._id.scope] = (cur[c._id.scope] ?? 0) + c.n;
      companiesByDept.set(c._id.dept, cur);
    }

    // Agrupar provincias por departamento
    const deptMap = new Map<string, {
      code: string;
      name: string;
      provinces: Array<{
        id: string;
        code: string;
        name: string;
        active: boolean;
        totalMunicipalities: number;
        activeMunicipalities: number;
      }>;
      totalProvinces: number;
      totalMunicipalities: number;
      activeMunicipalities: number;
      companiesByScope: Record<string, number>;
    }>();

    for (const p of provinces) {
      if (!p.departmentCode) continue;
      let dept = deptMap.get(p.departmentCode);
      if (!dept) {
        dept = {
          code: p.departmentCode,
          name: p.departmentName ?? "(sin nombre)",
          provinces: [],
          totalProvinces: 0,
          totalMunicipalities: 0,
          activeMunicipalities: 0,
          companiesByScope: companiesByDept.get(p.departmentCode) ?? {},
        };
        deptMap.set(p.departmentCode, dept);
      }
      const muni = p.ubigeoCode ? muniByProv.get(p.ubigeoCode) : undefined;
      dept.provinces.push({
        id: String(p._id),
        code: p.ubigeoCode ?? "",
        name: p.name,
        active: !!p.active,
        totalMunicipalities: muni?.total ?? 0,
        activeMunicipalities: muni?.active ?? 0,
      });
      dept.totalProvinces++;
      dept.totalMunicipalities += muni?.total ?? 0;
      dept.activeMunicipalities += muni?.active ?? 0;
    }

    const departments = [...deptMap.values()].sort((a, b) => a.code.localeCompare(b.code));

    const totals = {
      departments: departments.length,
      provinces: provinces.length,
      municipalities: departments.reduce((s, d) => s + d.totalMunicipalities, 0),
      activeMunicipalities: departments.reduce((s, d) => s + d.activeMunicipalities, 0),
      coveredDepartments: departments.filter((d) => d.activeMunicipalities > 0).length,
    };

    return apiResponse({ departments, totals });
  } catch (error) {
    console.error("[admin/red-nacional GET]", error);
    return apiError("Error al cargar la red nacional", 500);
  }
}
