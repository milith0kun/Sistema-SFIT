import { NextRequest } from "next/server";
import { isValidObjectId } from "mongoose";
import { connectDB } from "@/lib/db/mongoose";
import { Vehicle } from "@/models/Vehicle";
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
 * Centro de aprobaciones — verifica un vehículo. Los vehículos se crean con
 * `verified: false`; el admin_municipal los marca verificados tras revisar
 * SOAT, revisión técnica y placa.
 *
 * Idempotente: verificar un vehículo ya verificado devuelve 200.
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

    const vehicle = await Vehicle.findById(id);
    if (!vehicle) return apiNotFound("Vehículo no encontrado");

    if (
      !(await canAccessMunicipality(
        auth.session,
        String(vehicle.municipalityId),
      ))
    ) {
      return apiForbidden();
    }

    if (vehicle.verified && vehicle.verifiedAt) {
      return apiResponse({
        id: String(vehicle._id),
        plate: vehicle.plate,
        verified: true,
        verifiedAt: vehicle.verifiedAt,
        alreadyVerified: true,
      });
    }

    vehicle.verified = true;
    vehicle.verifiedAt = new Date();
    vehicle.verifiedBy = isValidObjectId(auth.session.userId)
      ? (auth.session.userId as unknown as typeof vehicle.verifiedBy)
      : undefined;
    await vehicle.save();

    await logAudit(request, auth.session, {
      action: "vehicle.verified",
      resourceType: "vehicle",
      resourceId: String(vehicle._id),
      metadata: {
        plate: vehicle.plate,
        companyId: vehicle.companyId ? String(vehicle.companyId) : null,
      },
    });

    return apiResponse({
      id: String(vehicle._id),
      plate: vehicle.plate,
      verified: true,
      verifiedAt: vehicle.verifiedAt,
    });
  } catch (error) {
    console.error("[vehiculos/:id/verificar POST]", error);
    return apiError("Error al verificar vehículo", 500);
  }
}
