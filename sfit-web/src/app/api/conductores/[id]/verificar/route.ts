import { NextRequest } from "next/server";
import { isValidObjectId } from "mongoose";
import { connectDB } from "@/lib/db/mongoose";
import { Driver } from "@/models/Driver";
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

/**
 * Centro de aprobaciones — verifica un conductor. Los conductores se crean
 * con `verified: false` (defensa contra registros sin revisión); el
 * admin_municipal los marca como verificados desde el centro de aprobaciones
 * tras revisar licencia, foto y antecedentes.
 *
 * Idempotente: verificar un conductor ya verificado devuelve 200.
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

    const driver = await Driver.findById(id);
    if (!driver) return apiNotFound("Conductor no encontrado");

    if (
      !(await canAccessMunicipality(auth.session, String(driver.municipalityId)))
    ) {
      return apiForbidden();
    }

    if (driver.verified && driver.verifiedAt) {
      return apiResponse({
        id: String(driver._id),
        name: driver.name,
        verified: true,
        verifiedAt: driver.verifiedAt,
        alreadyVerified: true,
      });
    }

    driver.verified = true;
    driver.verifiedAt = new Date();
    driver.verifiedBy = isValidObjectId(auth.session.userId)
      ? (auth.session.userId as unknown as typeof driver.verifiedBy)
      : undefined;
    await driver.save();

    await logAudit(request, auth.session, {
      action: "driver.verified",
      resourceType: "driver",
      resourceId: String(driver._id),
      metadata: {
        name: driver.name,
        dni: driver.dni,
        companyId: driver.companyId ? String(driver.companyId) : null,
      },
    });

    return apiResponse({
      id: String(driver._id),
      name: driver.name,
      verified: true,
      verifiedAt: driver.verifiedAt,
    });
  } catch (error) {
    console.error("[conductores/:id/verificar POST]", error);
    return apiError("Error al verificar conductor", 500);
  }
}
