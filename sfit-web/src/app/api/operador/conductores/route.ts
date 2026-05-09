import { NextRequest } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db/mongoose";
import { Driver } from "@/models/Driver";
import { User } from "@/models/User";
import {
  apiResponse,
  apiError,
  apiForbidden,
  apiUnauthorized,
} from "@/lib/api/response";
import { requireRole } from "@/lib/auth/guard";
import { ROLES } from "@/lib/constants";
import { getOperatorCompanyId } from "@/lib/auth/operatorCompany";

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
  const departmentCode = url.searchParams.get("departmentCode");

  await connectDB();

  // Resolver la empresa del operador para excluir a sus propios conductores.
  const operatorUser = await User.findById(auth.session.userId)
    .select("municipalityId companyId")
    .lean<{ municipalityId?: unknown; companyId?: unknown } | null>();
  if (!operatorUser?.municipalityId) {
    return apiError("El operador no tiene municipio asignado", 400);
  }

  // Resolver companyId vía helper estándar (User.companyId con fallback a
  // Driver.userId). Si no se encuentra → error claro: no usamos heurísticas
  // de "primera empresa activa de la muni" que terminaban devolviendo
  // recursos de la competencia.
  const myCompanyIdStr = await getOperatorCompanyId(auth.session.userId);
  if (!myCompanyIdStr) {
    return apiError(
      "El operador no tiene empresa asignada. Contacta al administrador.",
      400,
    );
  }
  const myCompanyId: unknown = myCompanyIdStr;

  const filter: Record<string, unknown> = {
    municipalityId: operatorUser.municipalityId,
    active: true,
  };

  // Filtro por departamento (UBIGEO 2 dígitos): el operador busca
  // conductores cuya municipalidad está en ese departamento. Sustituye
  // el filtro de muni propia por un set de municipalityIds.
  if (departmentCode && /^\d{2}$/.test(departmentCode)) {
    const Municipality = mongoose.models.Municipality;
    if (Municipality) {
      const munis = await Municipality.find({
        ubigeoCode: { $regex: `^${departmentCode}` },
      })
        .select("_id")
        .lean<{ _id: mongoose.Types.ObjectId }[]>();
      filter.municipalityId = { $in: munis.map((m) => m._id) };
    }
  }
  if (onlyUnassigned) {
    filter.$or = [
      { companyId: { $exists: false } },
      { companyId: null },
      { companyId: { $ne: myCompanyId } },
    ];
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
