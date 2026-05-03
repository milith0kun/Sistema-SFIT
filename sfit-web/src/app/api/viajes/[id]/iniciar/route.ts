import { NextRequest } from "next/server";
import { isValidObjectId } from "mongoose";
import { connectDB } from "@/lib/db/mongoose";
import { Trip } from "@/models/Trip";
import {
  apiResponse, apiError, apiForbidden, apiNotFound, apiUnauthorized,
} from "@/lib/api/response";
import { requireRole } from "@/lib/auth/guard";
import { resolveDriverFromSession } from "@/lib/auth/driverFromSession";
import { ROLES } from "@/lib/constants";
import { logAction } from "@/lib/audit/logAction";

/**
 * POST /api/viajes/[id]/iniciar
 *
 * El conductor marca el inicio efectivo del recorrido. De `aceptado`
 * pasa a `en_curso`. Setea `startTime: now` y deja al cliente comenzar
 * a enviar GPS al `FleetEntry` asociado.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = requireRole(request, [ROLES.CONDUCTOR]);
  if ("error" in auth) return auth.error === "unauthorized" ? apiUnauthorized() : apiForbidden();

  const { id } = await params;
  if (!isValidObjectId(id)) return apiError("ID inválido", 400);

  await connectDB();
  const driver = await resolveDriverFromSession(auth.session);
  if (!driver) return apiForbidden("Tu cuenta no tiene un registro de conductor asociado");

  const trip = await Trip.findById(id);
  if (!trip) return apiNotFound("Viaje no encontrado");

  if (!trip.driverId || String(trip.driverId) !== String(driver._id)) {
    return apiForbidden("Este viaje no está asignado a ti");
  }
  if (trip.status !== "aceptado") {
    return apiError(`Solo se puede iniciar un viaje en estado "aceptado" (actual: ${trip.status})`, 409);
  }

  trip.status = "en_curso";
  trip.startTime = new Date();
  await trip.save();

  void logAction({
    userId: auth.session.userId,
    action: "trip.started",
    resource: "trip",
    resourceId: String(trip._id),
    details: { driverId: String(driver._id) },
    req: request,
    municipalityId: auth.session.municipalityId,
    role: auth.session.role,
  });

  return apiResponse({
    id: String(trip._id),
    status: trip.status,
    startTime: trip.startTime,
  });
}
