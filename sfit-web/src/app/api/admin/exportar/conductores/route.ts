import { NextRequest, NextResponse } from "next/server";
import { isValidObjectId } from "mongoose";
import { connectDB } from "@/lib/db/mongoose";
import { Driver } from "@/models/Driver";
import { apiForbidden, apiUnauthorized } from "@/lib/api/response";
import { requireRole } from "@/lib/auth/guard";
import { ROLES } from "@/lib/constants";

export async function GET(request: NextRequest) {
  const auth = requireRole(request, [
    ROLES.SUPER_ADMIN,
    ROLES.ADMIN_MUNICIPAL,
    ROLES.FISCAL,
    ROLES.OPERADOR,
  ]);
  if ("error" in auth) {
    return auth.error === "unauthorized" ? apiUnauthorized() : apiForbidden();
  }

  try {
    await connectDB();

    const url = new URL(request.url);
    const municipalityIdParam = url.searchParams.get("municipalityId");
    const statusParam = url.searchParams.get("status");

    const filter: Record<string, unknown> = { active: true };

    if (auth.session.role === ROLES.SUPER_ADMIN) {
      if (municipalityIdParam && isValidObjectId(municipalityIdParam)) {
        filter.municipalityId = municipalityIdParam;
      }
    } else {
      const targetId = municipalityIdParam ?? auth.session.municipalityId;
      if (!targetId || !isValidObjectId(targetId)) return apiForbidden();
      filter.municipalityId = targetId;
    }

    if (statusParam) {
      filter.status = statusParam;
    }

    const drivers = await Driver.find(filter)
      .populate("companyId", "razonSocial")
      .sort({ name: 1 })
      .lean();

    const escapeCSV = (v: unknown) => {
      const s = String(v ?? "");
      if (s.includes(",") || s.includes('"') || s.includes("\n")) {
        return `"${s.replace(/"/g, '""')}"`;
      }
      return s;
    };

    const header = [
      "ID", "Nombre", "DNI", "Licencia", "Categoría",
      "Teléfono", "Estado", "Reputación", "Verificado",
      "Empresa", "Municipalidad",
    ].map(escapeCSV).join(",");

    const rows = drivers.map((d) => {
      const company = d.companyId as unknown as { razonSocial?: string } | null;
      return [
        String(d._id),
        d.name,
        d.dni,
        d.licenseNumber,
        d.licenseCategory,
        d.phone ?? "",
        d.status,
        d.reputationScore,
        d.verified ? "Sí" : "No",
        company?.razonSocial ?? "",
        String(d.municipalityId),
      ].map(escapeCSV).join(",");
    });

    const csv = [header, ...rows].join("\n");

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="conductores.csv"',
      },
    });
  } catch (error) {
    console.error("[admin/exportar/conductores GET]", error);
    return NextResponse.json({ success: false, error: "Error al exportar conductores" }, { status: 500 });
  }
}