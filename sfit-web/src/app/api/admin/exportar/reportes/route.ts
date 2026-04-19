import { NextRequest, NextResponse } from "next/server";
import { isValidObjectId } from "mongoose";
import { connectDB } from "@/lib/db/mongoose";
import { CitizenReport } from "@/models/CitizenReport";
import { Municipality } from "@/models/Municipality";
import { apiForbidden, apiUnauthorized, apiError } from "@/lib/api/response";
import { requireRole } from "@/lib/auth/guard";
import { ROLES } from "@/lib/constants";

/**
 * GET /api/admin/exportar/reportes
 * Exporta reportes ciudadanos en formato CSV.
 * Query params: desde (ISO), hasta (ISO), municipalityId.
 * Columnas: fecha, ciudadano, categoría, descripción, estado, municipio.
 */
export async function GET(request: NextRequest) {
  const auth = requireRole(request, [
    ROLES.SUPER_ADMIN,
    ROLES.ADMIN_PROVINCIAL,
    ROLES.ADMIN_MUNICIPAL,
    ROLES.FISCAL,
  ]);
  if ("error" in auth) {
    return auth.error === "unauthorized" ? apiUnauthorized() : apiForbidden();
  }

  try {
    await connectDB();

    const url = new URL(request.url);
    const desdeParam = url.searchParams.get("desde");
    const hastaParam = url.searchParams.get("hasta");
    const municipalityIdParam = url.searchParams.get("municipalityId");

    const filter: Record<string, unknown> = {};

    // Scope por rol
    if (auth.session.role === ROLES.SUPER_ADMIN) {
      if (municipalityIdParam && isValidObjectId(municipalityIdParam)) {
        filter.municipalityId = municipalityIdParam;
      }
    } else {
      const targetId = municipalityIdParam ?? auth.session.municipalityId;
      if (!targetId || !isValidObjectId(targetId)) return apiForbidden();
      filter.municipalityId = targetId;
    }

    if (desdeParam || hastaParam) {
      const range: Record<string, Date> = {};
      if (desdeParam) {
        const d = new Date(desdeParam);
        if (!Number.isNaN(d.getTime())) range.$gte = d;
      }
      if (hastaParam) {
        const d = new Date(hastaParam);
        if (!Number.isNaN(d.getTime())) range.$lte = d;
      }
      if (Object.keys(range).length) filter.createdAt = range;
    }

    const items = await CitizenReport.find(filter)
      .populate("citizenId", "name")
      .populate("municipalityId", "name")
      .sort({ createdAt: -1 })
      .limit(10000)
      .lean();

    // Construcción CSV sin dependencias externas
    const HEADER = ["fecha", "ciudadano", "categoria", "descripcion", "estado", "municipio"];

    function escapeField(val: unknown): string {
      const str = val == null ? "" : String(val);
      if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    }

    const rows = items.map((r) => {
      const citizen = r.citizenId as unknown as { name?: string } | null;
      const muni = r.municipalityId as unknown as { name?: string } | null;
      return [
        new Date(r.createdAt).toISOString(),
        citizen?.name ?? "Anónimo",
        r.category,
        r.description,
        r.status,
        muni?.name ?? "",
      ].map(escapeField).join(",");
    });

    const csv = [HEADER.join(","), ...rows].join("\r\n");
    const fecha = new Date().toISOString().slice(0, 10);

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename=reportes-${fecha}.csv`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("[exportar/reportes GET]", error);
    return apiError("Error al exportar reportes", 500);
  }
}
