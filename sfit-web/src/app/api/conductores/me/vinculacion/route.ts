/**
 * GET /api/conductores/me/vinculacion
 *
 * Endpoint liviano para que la app móvil del conductor sepa rápido si está
 * vinculado a una empresa. Devuelve:
 *
 *   {
 *     hasCompany: boolean,
 *     company: { id, razonSocial, ruc, active } | null,
 *     suggestedCompanies: Array<{ id, razonSocial, ruc }>,  // top 5 activas de su muni
 *     driverVerified: boolean,
 *   }
 *
 * `suggestedCompanies` permite mostrar un nudge "elige tu empresa" con un
 * picker directo si el conductor todavía no tiene companyId. La selección
 * se hace con PATCH /api/conductores/me { companyId }.
 */
import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db/mongoose";
import { Driver } from "@/models/Driver";
import { Company } from "@/models/Company";
import { apiResponse, apiError, apiUnauthorized, apiForbidden } from "@/lib/api/response";
import { requireRole } from "@/lib/auth/guard";
import { ROLES } from "@/lib/constants";

export async function GET(request: NextRequest) {
  const auth = requireRole(request, [ROLES.CONDUCTOR]);
  if ("error" in auth) {
    return auth.error === "unauthorized" ? apiUnauthorized() : apiForbidden();
  }

  await connectDB();

  const driver = await Driver.findOne({ userId: auth.session.userId })
    .select("companyId municipalityId verified")
    .lean<{ companyId?: unknown; municipalityId?: unknown; verified?: boolean } | null>();

  if (!driver) {
    return apiResponse({
      hasCompany: false,
      company: null,
      suggestedCompanies: [],
      driverVerified: false,
    });
  }

  let company: { id: string; razonSocial: string; ruc: string; active: boolean } | null = null;
  if (driver.companyId) {
    const c = await Company.findById(driver.companyId)
      .select("razonSocial ruc active")
      .lean<{ _id: unknown; razonSocial?: string; ruc?: string; active?: boolean } | null>();
    if (c) {
      company = {
        id: String(c._id),
        razonSocial: c.razonSocial ?? "",
        ruc: c.ruc ?? "",
        active: !!c.active,
      };
    }
  }

  // Sugeridas: top 5 empresas APROBADAS por el admin (active + approvedAt).
  // No filtramos por muni — el modelo mono-muni administrativo opera sobre
  // una sola Provincial (Cotabambas) y el conductor ve todas las empresas
  // válidas sin importar el código UBIGEO de su sede.
  const suggested = await Company.find({
    active: true,
    approvedAt: { $exists: true, $ne: null },
  })
    .select("razonSocial ruc")
    .sort({ reputationScore: -1, createdAt: -1 })
    .limit(5)
    .lean<Array<{ _id: unknown; razonSocial?: string; ruc?: string }>>();

  return apiResponse({
    hasCompany: !!company,
    company,
    suggestedCompanies: suggested.map((c) => ({
      id: String(c._id),
      razonSocial: c.razonSocial ?? "",
      ruc: c.ruc ?? "",
    })),
    driverVerified: !!driver.verified,
  });
}
