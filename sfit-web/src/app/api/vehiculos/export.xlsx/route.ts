import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db/mongoose";
import { apiError, apiForbidden, apiUnauthorized } from "@/lib/api/response";
import { requireRole } from "@/lib/auth/guard";
import { ROLES } from "@/lib/constants";
import { rolesFor } from "@/lib/auth/roleMatrix";
import { canAccessMunicipality, scopedCompanyFilter } from "@/lib/auth/rbac";
import { getOperatorCompanyId } from "@/lib/auth/operatorCompany";
import { generateVehiclesExcel, type VehicleExportFilter } from "@/lib/exports/vehicles";

export async function GET(request: NextRequest) {
  const auth = requireRole(request, [...rolesFor("vehiculos", "view")]);
  if ("error" in auth) return auth.error === "unauthorized" ? apiUnauthorized() : apiForbidden();

  try {
    await connectDB();
    const url = new URL(request.url);
    const typeParam = url.searchParams.get("type");
    const statusParam = url.searchParams.get("status");
    const verifiedParam = url.searchParams.get("verified");
    const search = url.searchParams.get("q");
    const companyIdParam = url.searchParams.get("companyId");
    const incluirInactivos = url.searchParams.get("incluirInactivos") === "true";

    const filter: VehicleExportFilter = {};
    if (incluirInactivos) filter.incluirInactivos = true;

    // Resolver municipalityId
    if (auth.session.role === ROLES.SUPER_ADMIN) {
      const muniParam = url.searchParams.get("municipalityId");
      if (muniParam) filter.municipalityId = muniParam;
    } else {
      const targetId = auth.session.municipalityId;
      if (!targetId || !(await canAccessMunicipality(auth.session, targetId))) return apiForbidden();
      filter.municipalityId = targetId;
    }

    // Operador: forzar su empresa
    if (auth.session.role === ROLES.OPERADOR) {
      const companyId = await getOperatorCompanyId(auth.session.userId);
      if (!companyId) return apiError("Sin empresa asignada", 400);
      filter.companyId = companyId;
    } else if (companyIdParam) {
      const scopeFilter = await scopedCompanyFilter(auth.session);
      const { default: mongoose } = await import("mongoose");
      if (!mongoose.isValidObjectId(companyIdParam)) return apiError("companyId inválido", 400);
      const Company = (await import("@/models/Company")).Company;
      const match = await Company.findOne({ _id: companyIdParam, ...scopeFilter }).select("_id").lean();
      if (!match) return apiForbidden();
      filter.companyId = companyIdParam;
    }

    if (typeParam) filter.vehicleTypeKey = typeParam;
    if (statusParam) filter.status = statusParam;
    if (verifiedParam === "true") filter.verified = true;
    else if (verifiedParam === "false") filter.verified = false;
    if (search) filter.search = search;

    const { buffer, filename } = await generateVehiclesExcel(filter, auth.session);

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
    console.error("[vehiculos/export.xlsx GET]", error);
    return apiError("Error al generar el archivo Excel", 500);
  }
}
