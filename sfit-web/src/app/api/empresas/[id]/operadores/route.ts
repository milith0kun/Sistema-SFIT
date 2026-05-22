import { NextRequest } from "next/server";
import { isValidObjectId } from "mongoose";
import { connectDB } from "@/lib/db/mongoose";
import { User } from "@/models/User";
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
import { canAccessMunicipality } from "@/lib/auth/rbac";

/**
 * GET /api/empresas/[id]/operadores
 *
 * Lista los usuarios con rol `operador` cuyo `companyId` apunta a esta
 * empresa. Sirve la tab "Operadores que administran" en el detalle de
 * empresa para que el admin_municipal sepa quién maneja cada empresa.
 *
 * Scope: super_admin sin restricciones. admin_municipal: solo empresas de
 * su muni.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = requireRole(request, [ROLES.SUPER_ADMIN, ROLES.ADMIN_MUNICIPAL]);
  if ("error" in auth) {
    return auth.error === "unauthorized" ? apiUnauthorized() : apiForbidden();
  }

  try {
    const { id } = await params;
    if (!isValidObjectId(id)) return apiError("ID inválido", 400);

    await connectDB();

    const company = await Company.findById(id)
      .select("municipalityId")
      .lean<{ municipalityId?: unknown } | null>();
    if (!company) return apiNotFound("Empresa no encontrada");

    if (!(await canAccessMunicipality(auth.session, String(company.municipalityId)))) {
      return apiForbidden();
    }

    const operadores = await User.find({
      role: ROLES.OPERADOR,
      companyId: id,
    })
      .select("name email phone status createdAt lastLoginAt")
      .sort({ createdAt: -1 })
      .lean();

    return apiResponse({
      items: operadores.map((u) => ({
        id: String(u._id),
        name: u.name,
        email: u.email,
        phone: u.phone ?? null,
        status: u.status,
        createdAt: u.createdAt,
        lastLoginAt: u.lastLoginAt ?? null,
      })),
      total: operadores.length,
    });
  } catch (error) {
    console.error("[empresas/:id/operadores GET]", error);
    return apiError("Error al listar operadores", 500);
  }
}
