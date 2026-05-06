import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db/mongoose";
import { Company } from "@/models/Company";
import "@/models/Municipality";
import { apiResponse } from "@/lib/api/response";

/**
 * GET /api/public/empresas?q=<texto>&limit=<n>
 *
 * Endpoint público (sin auth) para que conductores y ciudadanos busquen
 * empresas de transporte activas. El conductor lo usa en el onboarding
 * "Mi empresa" para asociarse a una; el ciudadano podría usarlo para ver
 * info pública de la operadora de un bus.
 *
 * Solo expone campos seguros: id, RUC, razón social, sede municipal,
 * tipo de servicio. NUNCA representante legal, contactos privados o
 * documentos.
 *
 * Filtros:
 *   - `q`: substring case-insensitive contra `razonSocial` o `ruc`.
 *          Si está vacío, devuelve las primeras N por orden alfabético.
 *   - `limit`: máximo 50, default 30.
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  const limit = Math.min(50, Math.max(1, Number(url.searchParams.get("limit") ?? 30)));

  await connectDB();

  const filter: Record<string, unknown> = { status: "activo" };
  if (q.length > 0) {
    // Si q es solo dígitos, prioridad RUC; si tiene letras, prefijo razón social.
    const isAllDigits = /^\d+$/.test(q);
    if (isAllDigits) {
      filter.ruc = { $regex: `^${q}` };
    } else {
      const safe = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      filter.razonSocial = { $regex: safe, $options: "i" };
    }
  }

  const companies = await Company.find(filter)
    .populate("municipalityId", "name ubigeoCode")
    .select("ruc razonSocial municipalityId serviceScope")
    .sort({ razonSocial: 1 })
    .limit(limit)
    .lean();

  const items = companies.map((c) => {
    const muni = c.municipalityId as { _id?: unknown; name?: string } | null;
    return {
      id: String(c._id),
      ruc: c.ruc,
      razonSocial: c.razonSocial,
      municipalityName: muni?.name ?? null,
      serviceScope: c.serviceScope ?? null,
    };
  });

  return apiResponse({ items, total: items.length });
}
