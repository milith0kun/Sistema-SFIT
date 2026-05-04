import { NextRequest } from "next/server";
import { isValidObjectId } from "mongoose";
import { z } from "zod";
import { connectDB } from "@/lib/db/mongoose";
import { Vehicle } from "@/models/Vehicle";
import {
  apiResponse, apiError, apiForbidden, apiNotFound, apiUnauthorized, apiValidationError,
} from "@/lib/api/response";
import { requireRole } from "@/lib/auth/guard";
import { canAccessMunicipality } from "@/lib/auth/rbac";
import { ROLES } from "@/lib/constants";
import { logAction } from "@/lib/audit/logAction";

const Schema = z.object({
  reason: z.string().trim().min(5, "El motivo debe tener al menos 5 caracteres").max(500),
});

/**
 * PATCH /api/vehiculos/[id]/suspender
 *
 * Pone un vehículo "fuera_de_servicio" por motivo de fiscalización.
 * Útil cuando el fiscal detecta una irregularidad grave que requiere sacar
 * de circulación al vehículo. Reservado a super_admin, admin_municipal y
 * fiscal con scope de la muni del vehículo.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = requireRole(request, [ROLES.SUPER_ADMIN, ROLES.ADMIN_MUNICIPAL, ROLES.FISCAL]);
  if ("error" in auth) return auth.error === "unauthorized" ? apiUnauthorized() : apiForbidden();

  const { id } = await params;
  if (!isValidObjectId(id)) return apiError("ID inválido", 400);

  const body = await request.json().catch(() => ({}));
  const parsed = Schema.safeParse(body);
  if (!parsed.success) {
    const errors: Record<string, string[]> = {};
    for (const issue of parsed.error.issues) {
      const k = issue.path[0]?.toString() ?? "general";
      errors[k] = [...(errors[k] ?? []), issue.message];
    }
    return apiValidationError(errors);
  }

  try {
    await connectDB();
    const vehicle = await Vehicle.findById(id);
    if (!vehicle) return apiNotFound("Vehículo no encontrado");

    if (!(await canAccessMunicipality(auth.session, String(vehicle.municipalityId)))) {
      return apiForbidden();
    }

    if (vehicle.status === "fuera_de_servicio") {
      return apiError("El vehículo ya está fuera de servicio", 422);
    }

    const prevStatus = vehicle.status;
    vehicle.status = "fuera_de_servicio";
    await vehicle.save();

    void logAction({
      userId: auth.session.userId,
      action: "vehicle.suspended",
      resource: "vehicle",
      resourceId: String(vehicle._id),
      details: {
        prevStatus,
        reason: parsed.data.reason,
        municipalityId: String(vehicle.municipalityId),
      },
      req: request,
      municipalityId: auth.session.municipalityId,
      role: auth.session.role,
    });

    return apiResponse({
      id: String(vehicle._id),
      plate: vehicle.plate,
      status: vehicle.status,
      reason: parsed.data.reason,
    });
  } catch (error) {
    console.error("[vehiculos/:id/suspender PATCH]", error);
    return apiError("Error al suspender vehículo", 500);
  }
}
