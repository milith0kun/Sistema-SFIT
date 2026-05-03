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
import { createNotification } from "@/lib/notifications/create";
import { User } from "@/models/User";

/**
 * POST /api/viajes/[id]/aceptar
 *
 * El conductor confirma una asignación. Solo es válido si el viaje está
 * en `pendiente_aceptacion` Y el `driverId` del viaje coincide con el
 * driver del usuario autenticado.
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
  if (trip.status !== "pendiente_aceptacion") {
    return apiError(`No se puede aceptar un viaje en estado "${trip.status}"`, 409);
  }

  trip.status = "aceptado";
  trip.acceptedAt = new Date();
  trip.rejectedAt = undefined;
  trip.rejectionReason = undefined;
  await trip.save();

  // Notificar a quien lo asignó (best-effort).
  // Buscamos el AuditLog de "trip.assigned" para saber el operador, pero por
  // simplicidad creamos notif para todos los operadores/admin del muni.
  try {
    const operadores = await User.find({
      municipalityId: trip.municipalityId,
      role: { $in: [ROLES.OPERADOR, ROLES.ADMIN_MUNICIPAL] },
      status: "activo",
    }).select("_id").lean();
    await Promise.all(
      operadores.map((op) =>
        createNotification({
          userId: String(op._id),
          title: "Viaje aceptado",
          body: "El conductor confirmó la asignación.",
          type: "success",
          category: "asignacion",
          link: `/viajes`,
          metadata: { tripId: String(trip._id) },
        }),
      ),
    );
  } catch (e) {
    console.error("[viajes/aceptar] notif operador", e);
  }

  void logAction({
    userId: auth.session.userId,
    action: "trip.accepted",
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
    acceptedAt: trip.acceptedAt,
  });
}
