import { NextRequest } from "next/server";
import { isValidObjectId } from "mongoose";
import { z } from "zod";
import { connectDB } from "@/lib/db/mongoose";
import { Trip } from "@/models/Trip";
import {
  apiResponse, apiError, apiForbidden, apiNotFound, apiUnauthorized, apiValidationError,
} from "@/lib/api/response";
import { requireRole } from "@/lib/auth/guard";
import { resolveDriverFromSession } from "@/lib/auth/driverFromSession";
import { ROLES } from "@/lib/constants";
import { logAction } from "@/lib/audit/logAction";

const Body = z.object({
  direction: z.enum(["ida", "vuelta", "circular"]).optional(),
});

/**
 * POST /api/viajes/[id]/tomar
 *
 * Flujo PULL: el conductor reclama un viaje del catálogo público
 * (`/api/viajes/disponibles`). Solo válido si:
 *   - El viaje está en `pendiente_aceptacion` SIN driverId asignado.
 *   - El conductor pertenece a la misma municipalidad del viaje.
 *
 * Pasa directamente a `aceptado` (ya que el conductor lo eligió, no hay
 * paso de aceptación adicional).
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = requireRole(request, [ROLES.CONDUCTOR]);
  if ("error" in auth) return auth.error === "unauthorized" ? apiUnauthorized() : apiForbidden();

  const { id } = await params;
  if (!isValidObjectId(id)) return apiError("ID inválido", 400);

  const json = await request.json().catch(() => ({}));
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    const errors: Record<string, string[]> = {};
    for (const i of parsed.error.issues) {
      const k = i.path[0]?.toString() ?? "general";
      errors[k] = [...(errors[k] ?? []), i.message];
    }
    return apiValidationError(errors);
  }

  await connectDB();
  const driver = await resolveDriverFromSession(auth.session);
  if (!driver) return apiForbidden("Tu cuenta no tiene un registro de conductor asociado");

  const trip = await Trip.findById(id);
  if (!trip) return apiNotFound("Viaje no encontrado");

  if (String(trip.municipalityId) !== String(driver.municipalityId)) {
    return apiForbidden("Este viaje no pertenece a tu municipalidad");
  }
  if (trip.status !== "pendiente_aceptacion") {
    return apiError(`Este viaje ya no está disponible (estado: ${trip.status})`, 409);
  }
  if (trip.driverId && String(trip.driverId) !== String(driver._id)) {
    return apiError("Este viaje ya fue tomado por otro conductor", 409);
  }

  // Asignación atómica con findOneAndUpdate para evitar race conditions
  // cuando dos conductores intentan tomar el mismo viaje al mismo tiempo.
  const claimed = await Trip.findOneAndUpdate(
    { _id: id, status: "pendiente_aceptacion", driverId: { $exists: false } },
    {
      $set: {
        driverId: driver._id,
        status: "aceptado",
        acceptedAt: new Date(),
        ...(parsed.data.direction && { direction: parsed.data.direction }),
      },
    },
    { returnDocument: "after" },
  );

  if (!claimed) {
    return apiError("Este viaje ya fue tomado por otro conductor", 409);
  }

  void logAction({
    userId: auth.session.userId,
    action: "trip.claimed",
    resource: "trip",
    resourceId: String(claimed._id),
    details: { driverId: String(driver._id), direction: parsed.data.direction },
    req: request,
    municipalityId: auth.session.municipalityId,
    role: auth.session.role,
  });

  return apiResponse({
    id: String(claimed._id),
    status: claimed.status,
    driverId: String(claimed.driverId),
    acceptedAt: claimed.acceptedAt,
  });
}
