import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db/mongoose";
import { apiError, apiForbidden, apiUnauthorized } from "@/lib/api/response";
import { requireRole } from "@/lib/auth/guard";
import { ROLES } from "@/lib/constants";
import { rolesFor } from "@/lib/auth/roleMatrix";
import { canAccessMunicipality } from "@/lib/auth/rbac";
import { getOperatorCompanyId } from "@/lib/auth/operatorCompany";
import { generateConductoresExcel, type ConductorExportFilter } from "@/lib/exports/conductores";
import { type LicenseValidityState } from "@/lib/license-validity";

function sendExcel(buffer: Buffer, filename: string) {
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
}

export async function GET(request: NextRequest) {
  const auth = requireRole(request, [...rolesFor("conductores", "view")]);
  if ("error" in auth) return auth.error === "unauthorized" ? apiUnauthorized() : apiForbidden();

  try {
    await connectDB();
    const url = new URL(request.url);
    const statusParam = url.searchParams.get("status");
    const validityParam = url.searchParams.get("validity") as LicenseValidityState | "all" | null;
    const search = url.searchParams.get("q");

    const filter: ConductorExportFilter = {};

    // Resolver municipalityId según rol
    if (auth.session.role === ROLES.SUPER_ADMIN) {
      const muniParam = url.searchParams.get("municipalityId");
      if (muniParam) filter.municipalityId = muniParam;
    } else if (auth.session.role === ROLES.OPERADOR) {
      const companyId = await getOperatorCompanyId(auth.session.userId);
      if (!companyId) {
        // Sin empresa → export vacío
        const { buffer, filename } = await generateConductoresExcel(filter);
        return sendExcel(buffer, filename);
      }
      filter.companyId = companyId;
      filter.municipalityId = auth.session.municipalityId!;
    } else {
      const targetId = auth.session.municipalityId;
      if (!targetId || !(await canAccessMunicipality(auth.session, targetId))) return apiForbidden();
      filter.municipalityId = targetId;
    }

    if (statusParam) filter.status = statusParam;
    if (validityParam) filter.validity = validityParam;
    if (search) filter.search = search;

    const { buffer, filename } = await generateConductoresExcel(filter);
    return sendExcel(buffer, filename);
  } catch (error) {
    console.error("[conductores/export.xlsx GET]", error);
    return apiError("Error al generar el archivo Excel", 500);
  }
}
