import { NextRequest, NextResponse } from "next/server";
import { isValidObjectId } from "mongoose";
import { connectDB } from "@/lib/db/mongoose";
import { apiError, apiForbidden, apiUnauthorized } from "@/lib/api/response";
import { requireRole } from "@/lib/auth/guard";
import { ROLES } from "@/lib/constants";
import { rolesFor } from "@/lib/auth/roleMatrix";
import { canAccessMunicipality, scopedCompanyFilter } from "@/lib/auth/rbac";
import { getOperatorCompanyId } from "@/lib/auth/operatorCompany";
import { generateRutasExcel, type RutaExportFilter } from "@/lib/exports/rutas";

export async function GET(request: NextRequest) {
  const auth = requireRole(request, [...rolesFor("rutas", "view")]);
  if ("error" in auth) return auth.error === "unauthorized" ? apiUnauthorized() : apiForbidden();

  try {
    await connectDB();
    const url = new URL(request.url);
    const typeParam = url.searchParams.get("type");
    const statusParam = url.searchParams.get("status");
    const departmentCode = url.searchParams.get("departmentCode");
    const companyIdParam = url.searchParams.get("companyId");

    const filter: RutaExportFilter = {};

    if (auth.session.role === ROLES.SUPER_ADMIN) {
      const muniParam = url.searchParams.get("municipalityId");
      if (muniParam && isValidObjectId(muniParam)) filter.municipalityId = muniParam;
    } else {
      const targetId = auth.session.municipalityId;
      if (!targetId || !isValidObjectId(targetId)) return apiForbidden();
      if (!(await canAccessMunicipality(auth.session, targetId))) return apiForbidden();
      filter.municipalityId = targetId;
    }

    if (auth.session.role === ROLES.OPERADOR) {
      const companyId = await getOperatorCompanyId(auth.session.userId);
      if (!companyId) return apiError("Sin empresa asignada", 400);
      filter.companyId = companyId;
    } else if (companyIdParam && isValidObjectId(companyIdParam)) {
      const scopeFilter = await scopedCompanyFilter(auth.session);
      const { default: mongoose } = await import("mongoose");
      if (!mongoose.isValidObjectId(companyIdParam)) return apiError("companyId inválido", 400);
      const { Company } = await import("@/models/Company");
      const match = await Company.findOne({ _id: companyIdParam, ...scopeFilter }).select("_id").lean();
      if (!match) return apiForbidden();
      filter.companyId = companyIdParam;
    }

    if (typeParam === "ruta" || typeParam === "zona") filter.type = typeParam;
    if (statusParam === "activa" || statusParam === "suspendida") filter.status = statusParam;
    if (departmentCode && /^\d{2}$/.test(departmentCode)) filter.departmentCode = departmentCode;

    const { buffer, filename } = await generateRutasExcel(filter);

    const body = new ArrayBuffer(buffer.byteLength);
    new Uint8Array(body).set(
      new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength),
    );

    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("[rutas/export.xlsx GET]", error);
    return apiError("Error al generar el archivo Excel", 500);
  }
}
