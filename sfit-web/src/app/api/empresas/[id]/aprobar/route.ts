import { NextRequest } from "next/server";
import mongoose, { isValidObjectId } from "mongoose";
import { connectDB } from "@/lib/db/mongoose";
import { Company } from "@/models/Company";
import { User } from "@/models/User";
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
import { logAudit } from "@/lib/audit/log";
import { createNotification } from "@/lib/notifications/create";

/**
 * Centro de aprobaciones — RF-04: el admin_municipal aprueba empresas que
 * fueron registradas por un operador vía autoservicio (active: false al
 * crearse). Aprobar la empresa:
 *   - activa la empresa (`active: true`, limpia `suspendedAt`)
 *   - registra `approvedAt` y `approvedBy` para auditoría posterior
 *   - notifica al operador para que pueda continuar con su flujo
 *
 * Es idempotente: aprobar una empresa ya activa devuelve 200 sin cambios.
 */
export async function POST(
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

    const company = await Company.findById(id);
    if (!company) return apiNotFound("Empresa no encontrada");

    if (
      !(await canAccessMunicipality(auth.session, String(company.municipalityId)))
    ) {
      return apiForbidden();
    }

    if (company.active && company.approvedAt) {
      return apiResponse({
        id: String(company._id),
        razonSocial: company.razonSocial,
        active: true,
        approvedAt: company.approvedAt,
        alreadyApproved: true,
      });
    }

    company.active = true;
    company.suspendedAt = undefined;
    company.approvedAt = new Date();
    company.approvedBy = isValidObjectId(auth.session.userId)
      ? new mongoose.Types.ObjectId(auth.session.userId)
      : undefined;
    await company.save();

    await logAudit(request, auth.session, {
      action: "company.approved",
      resourceType: "company",
      resourceId: String(company._id),
      metadata: {
        razonSocial: company.razonSocial,
        ruc: company.ruc,
        municipalityId: String(company.municipalityId),
      },
    });

    // Notificar a los operadores de esta empresa para que sepan que ya
    // pueden crear conductores, vehículos y rutas.
    const operadores = await User.find({
      role: ROLES.OPERADOR,
      companyId: company._id,
    })
      .select("_id")
      .lean();
    for (const op of operadores) {
      await createNotification({
        userId: String(op._id),
        title: "Empresa aprobada",
        body: `Tu empresa "${company.razonSocial}" fue aprobada. Ya puedes registrar conductores y vehículos.`,
        type: "success",
        category: "aprobacion",
        metadata: { companyId: String(company._id) },
      });
    }

    return apiResponse({
      id: String(company._id),
      razonSocial: company.razonSocial,
      active: true,
      approvedAt: company.approvedAt,
      operadoresNotificados: operadores.length,
    });
  } catch (error) {
    console.error("[empresas/:id/aprobar POST]", error);
    return apiError("Error al aprobar empresa", 500);
  }
}
