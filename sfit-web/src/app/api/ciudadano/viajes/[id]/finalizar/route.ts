/**
 * POST /api/ciudadano/viajes/[id]/finalizar
 *
 * Finaliza el registro del ciudadano sobre un viaje. El `id` corresponde al
 * `CitizenTripRegistration._id`, NO al Trip — porque varios ciudadanos
 * pueden estar en el mismo Trip y cada uno finaliza su propio registro de
 * forma independiente.
 *
 * Si tras cerrar este registro:
 *   - El Trip no tiene driver asignado Y no quedan más registros activos,
 *     el Trip se cierra automáticamente (`status=completado`, `endTime=now`,
 *     `closedAt=now`). Esto cubre el caso "ciudadano creó Trip auto sin
 *     que un conductor llegue a operarlo".
 *   - Si hay driver, NO tocamos el Trip — solo el conductor o el sistema
 *     pueden cerrarlo. El ciudadano simplemente "se bajó".
 */
import { NextRequest } from "next/server";
import { isValidObjectId } from "mongoose";
import { connectDB } from "@/lib/db/mongoose";
import { CitizenTripRegistration } from "@/models/CitizenTripRegistration";
import { Trip } from "@/models/Trip";
import {
  apiResponse,
  apiError,
  apiUnauthorized,
  apiForbidden,
  apiNotFound,
} from "@/lib/api/response";
import { requireAuth } from "@/lib/auth/guard";
import { ROLES } from "@/lib/constants";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = requireAuth(request);
  if (!session) return apiUnauthorized();
  if (session.role !== ROLES.CIUDADANO) return apiForbidden();

  const { id } = await params;
  if (!isValidObjectId(id)) return apiError("ID de registro inválido", 400);

  await connectDB();

  const registration = await CitizenTripRegistration.findById(id);
  if (!registration) return apiNotFound("Registro no encontrado");
  if (String(registration.userId) !== String(session.userId)) {
    return apiForbidden();
  }
  if (registration.endedAt) {
    // Idempotente — si ya estaba cerrado, devolvemos el estado actual.
    return apiResponse({
      registrationId: String(registration._id),
      endedAt: registration.endedAt,
      endReason: registration.endReason ?? "by_citizen",
      tripClosed: false,
    });
  }

  registration.endedAt = new Date();
  registration.endReason = "by_citizen";
  await registration.save();

  // Auto-cierre del Trip si quedó "huérfano" (sin conductor y sin más
  // ciudadanos activos). Si tiene driver, lo dejamos vivo: el conductor
  // sigue operando y otros pasajeros pueden seguir en el bus.
  let tripClosed = false;
  if (registration.tripId) {
    const trip = await Trip.findById(registration.tripId);
    if (
      trip &&
      !trip.driverId &&
      trip.status !== "completado" &&
      trip.status !== "auto_cierre"
    ) {
      const otherActive = await CitizenTripRegistration.countDocuments({
        tripId: trip._id,
        endedAt: { $exists: false },
      });
      if (otherActive === 0) {
        trip.status = "completado";
        trip.endTime = registration.endedAt;
        trip.closedAt = registration.endedAt;
        trip.autoClosedReason = "no_driver_no_passengers";
        await trip.save();
        tripClosed = true;
      }
    }
  }

  return apiResponse({
    registrationId: String(registration._id),
    endedAt: registration.endedAt,
    endReason: registration.endReason,
    tripClosed,
  });
}
