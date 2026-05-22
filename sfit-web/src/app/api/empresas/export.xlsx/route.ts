import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db/mongoose";
import { apiError, apiForbidden, apiUnauthorized } from "@/lib/api/response";
import { requireRole } from "@/lib/auth/guard";
import { ROLES } from "@/lib/constants";
import { rolesFor } from "@/lib/auth/roleMatrix";
import { canAccessMunicipality } from "@/lib/auth/rbac";
import { generateCompaniesExcel, type CompanyExportFilter } from "@/lib/exports/companies";

export async function GET(request: NextRequest) {
  const auth = requireRole(request, [...rolesFor("empresas", "view")]);
  if ("error" in auth) return auth.error === "unauthorized" ? apiUnauthorized() : apiForbidden();

  try {
    await connectDB();
    const url = new URL(request.url);
    const typeParam = url.searchParams.get("type");
    const activeParam = url.searchParams.get("active");
    const search = url.searchParams.get("q");

    const filter: CompanyExportFilter = {};

    // Resolver municipalityId
    if (auth.session.role === ROLES.SUPER_ADMIN) {
      const muniParam = url.searchParams.get("municipalityId");
      if (muniParam) filter.municipalityId = muniParam;
    } else {
      const targetId = auth.session.municipalityId;
      if (!targetId || !(await canAccessMunicipality(auth.session, targetId))) return apiForbidden();
      filter.municipalityId = targetId;
    }

    if (typeParam) filter.vehicleTypeKey = typeParam;
    if (activeParam === "true") filter.active = true;
    else if (activeParam === "false") filter.active = false;

    if (search) filter.search = search;

    const { buffer, filename } = await generateCompaniesExcel(filter, auth.session);

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
    console.error("[empresas/export.xlsx GET]", error);
    return apiError("Error al generar el archivo Excel", 500);
  }
}
