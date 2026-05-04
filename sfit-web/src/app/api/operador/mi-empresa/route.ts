/**
 * GET /api/operador/mi-empresa
 *
 * Devuelve la empresa (Company) del operador autenticado. Es un endpoint
 * de conveniencia para el frontend (Track B), construido encima del
 * helper `getOperatorCompanyId` agregado en Track A.
 *
 * El operador necesita poder cargar su empresa sin conocer su companyId
 * (no se expone en el JSON de sesión). Este endpoint resuelve la
 * indirección y delega el GET al modelo Company directamente, devolviendo
 * un payload alineado con `/api/empresas/[id]` para reusar tipos.
 */
import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db/mongoose";
import { Company } from "@/models/Company";
import {
  apiResponse,
  apiError,
  apiForbidden,
  apiNotFound,
  apiUnauthorized,
} from "@/lib/api/response";
import { requireRole } from "@/lib/auth/guard";
import { ROLES } from "@/lib/constants";
import { getOperatorCompanyId } from "@/lib/auth/operatorCompany";

export async function GET(request: NextRequest) {
  const auth = requireRole(request, [
    ROLES.OPERADOR,
    ROLES.SUPER_ADMIN,
    ROLES.ADMIN_MUNICIPAL,
  ]);
  if ("error" in auth) {
    return auth.error === "unauthorized" ? apiUnauthorized() : apiForbidden();
  }

  try {
    const companyId = await getOperatorCompanyId(auth.session.userId);
    if (!companyId) {
      return apiNotFound("Sin empresa asignada al operador");
    }

    await connectDB();

    const company = await Company.findById(companyId).lean<{
      _id: unknown;
      municipalityId: unknown;
      razonSocial: string;
      ruc: string;
      representanteLegal: { name: string; dni: string; phone?: string };
      vehicleTypeKeys: string[];
      documents: { name: string; url: string }[];
      active: boolean;
      suspendedAt?: Date;
      reputationScore: number;
      serviceScope?: string;
      coverage?: {
        departmentCodes: string[];
        provinceCodes: string[];
        districtCodes: string[];
      };
      createdAt: Date;
      updatedAt: Date;
    } | null>();
    if (!company) return apiNotFound("Empresa no encontrada");

    return apiResponse({
      id: String(company._id),
      municipalityId: String(company.municipalityId),
      razonSocial: company.razonSocial,
      ruc: company.ruc,
      representanteLegal: company.representanteLegal,
      vehicleTypeKeys: company.vehicleTypeKeys,
      documents: company.documents,
      active: company.active,
      suspendedAt: company.suspendedAt,
      reputationScore: company.reputationScore,
      serviceScope: company.serviceScope ?? "urbano_distrital",
      coverage: company.coverage ?? { departmentCodes: [], provinceCodes: [], districtCodes: [] },
      createdAt: company.createdAt,
      updatedAt: company.updatedAt,
    });
  } catch (error) {
    console.error("[operador/mi-empresa GET]", error);
    return apiError("Error al obtener la empresa del operador", 500);
  }
}
