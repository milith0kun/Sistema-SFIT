import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db/mongoose";
import { Driver } from "@/models/Driver";
import { User } from "@/models/User";
import { Company } from "@/models/Company";
import {
  apiResponse,
  apiError,
  apiForbidden,
  apiUnauthorized,
} from "@/lib/api/response";
import { requireRole } from "@/lib/auth/guard";
import { ROLES } from "@/lib/constants";

/**
 * GET /api/operador/conductores?q=<texto>&onlyUnassigned=<bool>&limit=<n>
 *
 * Listado de conductores activos para que el OPERADOR los pueda invitar a
 * su empresa. El operador solo puede ver conductores de su misma muni
 * (multi-tenant) y por defecto solo los que NO tienen empresa o tienen
 * una distinta a la suya.
 *
 * Filtros:
 *   - `q`: substring case-insensitive en `name` o `dni`.
 *   - `onlyUnassigned`: true por defecto. false para ver todos.
 */
export async function GET(request: NextRequest) {
  const auth = requireRole(request, [ROLES.OPERADOR]);
  if ("error" in auth) {
    return auth.error === "unauthorized" ? apiUnauthorized() : apiForbidden();
  }

  const url = new URL(request.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  const onlyUnassigned =
    (url.searchParams.get("onlyUnassigned") ?? "true").toLowerCase() !== "false";
  const limit = Math.min(50, Math.max(1, Number(url.searchParams.get("limit") ?? 30)));

  await connectDB();

  // Resolver la empresa del operador para excluir a sus propios conductores.
  const operatorUser = await User.findById(auth.session.userId)
    .select("municipalityId companyId")
    .lean<{ municipalityId?: unknown; companyId?: unknown } | null>();
  if (!operatorUser?.municipalityId) {
    return apiError("El operador no tiene municipio asignado", 400);
  }

  // Si el operador no tiene companyId en su user, lo intentamos vía Company.
  let myCompanyId: unknown = operatorUser.companyId;
  if (!myCompanyId) {
    const myCompany = await Company.findOne({
      municipalityId: operatorUser.municipalityId,
      // Heurística: tomamos la primera empresa activa de su muni. En un
      // modelo más estricto el operador debería tener companyId explícito.
    }).select("_id").lean();
    myCompanyId = myCompany?._id;
  }

  const filter: Record<string, unknown> = {
    municipalityId: operatorUser.municipalityId,
    active: true,
  };
  if (onlyUnassigned && myCompanyId) {
    filter.$or = [
      { companyId: { $exists: false } },
      { companyId: null },
      { companyId: { $ne: myCompanyId } },
    ];
  } else if (onlyUnassigned) {
    filter.$or = [{ companyId: { $exists: false } }, { companyId: null }];
  }
  if (q.length > 0) {
    const isAllDigits = /^\d+$/.test(q);
    if (isAllDigits) {
      filter.dni = { $regex: `^${q}` };
    } else {
      const safe = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      filter.name = { $regex: safe, $options: "i" };
    }
  }

  const drivers = await Driver.find(filter)
    .populate("companyId", "razonSocial")
    .select("name dni licenseNumber licenseCategory phone status companyId")
    .sort({ name: 1 })
    .limit(limit)
    .lean();

  const items = drivers.map((d) => {
    const company = d.companyId as { _id?: unknown; razonSocial?: string } | null;
    return {
      id: String(d._id),
      name: d.name,
      dni: d.dni,
      licenseNumber: d.licenseNumber,
      licenseCategory: d.licenseCategory,
      phone: d.phone ?? null,
      status: d.status,
      companyId: company?._id ? String(company._id) : null,
      companyName: company?.razonSocial ?? null,
      isMine: company?._id ? String(company._id) === String(myCompanyId) : false,
    };
  });

  return apiResponse({
    items,
    total: items.length,
    myCompanyId: myCompanyId ? String(myCompanyId) : null,
  });
}
