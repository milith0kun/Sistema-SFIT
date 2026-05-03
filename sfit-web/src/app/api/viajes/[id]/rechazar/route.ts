import { NextRequest } from "next/server";
import { isValidObjectId } from "mongoose";
import { z } from "zod";
import { connectDB } from "@/lib/db/mongoose";
import { Trip } from "@/models/Trip";
import { User } from "@/models/User";
import {
  apiResponse, apiError, apiForbidden, apiNotFound, apiUnauthorized, apiValidationError,
} from "@/lib/api/response";
import { requireRole } from "@/lib/auth/guard";
import { resolveDriverFromSession } from "@/lib/auth/driverFromSession";
import { ROLES } from "@/lib/constants";
import { logAction } from "@/lib/audit/logAction";
import { createNotification } from "@/lib/notifications/create";

const Body = z.object({
  rejectionReason: z.string().trim().min(5, "Indica un motivo (mínimo 5 caracteres)").max(500),
});

/**
 * POST /api/viajes/[id]/rechazar
 *
 * El conductor declina una asignación con un motivo escrito. Permite al
 * operador re-asignar a otro conductor o cancelar el viaje.
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

  if (!trip.driverId || String(trip.driverId) !== String(driver._id)) {
    return apiForbidden("Este viaje no está asignado a ti");
  }
  if (trip.status !== "pendiente_aceptacion") {
    return apiError(`No se puede rechazar un viaje en estado "${trip.status}"`, 409);
  }

  trip.status = "rechazado";
  trip.rejectedAt = new Date();
  trip.rejectionReason = parsed.data.rejectionReason;
  await trip.save();

  // Notif a operadores del muni con el motivo.
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
          title: "Viaje rechazado por el conductor",
          body: `Motivo: ${parsed.data.rejectionReason}`,
          type: "warning",
          category: "asignacion",
          link: `/viajes`,
          metadata: { tripId: String(trip._id), rejectionReason: parsed.data.rejectionReason },
        }),
      ),
    );
  } catch (e) {
    console.error("[viajes/rechazar] notif operador", e);
  }

  void logAction({
    userId: auth.session.userId,
    action: "trip.rejected",
    resource: "trip",
    resourceId: String(trip._id),
    details: { driverId: String(driver._id), rejectionReason: parsed.data.rejectionReason },
    req: request,
    municipalityId: auth.session.municipalityId,
    role: auth.session.role,
  });

  return apiResponse({
    id: String(trip._id),
    status: trip.status,
    rejectedAt: trip.rejectedAt,
    rejectionReason: trip.rejectionReason,
  });
}
