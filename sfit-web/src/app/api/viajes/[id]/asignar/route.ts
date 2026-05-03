import { NextRequest } from "next/server";
import { isValidObjectId } from "mongoose";
import { z } from "zod";
import { connectDB } from "@/lib/db/mongoose";
import { Trip } from "@/models/Trip";
import { Driver } from "@/models/Driver";
import {
  apiResponse, apiError, apiForbidden, apiNotFound, apiUnauthorized, apiValidationError,
} from "@/lib/api/response";
import { requireRole } from "@/lib/auth/guard";
import { canAccessMunicipality } from "@/lib/auth/rbac";
import { ROLES } from "@/lib/constants";
import { logAction } from "@/lib/audit/logAction";
import { sendPushToUser } from "@/lib/notifications/fcm";
import { createNotification } from "@/lib/notifications/create";

const Body = z.object({
  driverId: z.string().refine(isValidObjectId, "driverId inválido"),
  direction: z.enum(["ida", "vuelta", "circular"]).optional(),
  expectedReturnTime: z.string().datetime().optional(),
});

/**
 * POST /api/viajes/[id]/asignar
 *
 * El operador (o admin_municipal/super_admin) asigna el viaje a un
 * conductor concreto. El viaje pasa a status `pendiente_aceptacion`
 * y el conductor recibe un push para aceptar/rechazar.
 *
 * Reglas:
 *   - Solo se puede asignar desde status: pendiente_aceptacion (re-asignación)
 *     o cuando el viaje fue creado sin driver. NO se permite re-asignar
 *     viajes ya en_curso/completado/auto_cierre.
 *   - El driver debe pertenecer a la misma municipalidad que el viaje.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = requireRole(request, [ROLES.SUPER_ADMIN, ROLES.ADMIN_MUNICIPAL, ROLES.OPERADOR]);
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
  const trip = await Trip.findById(id);
  if (!trip) return apiNotFound("Viaje no encontrado");
  if (!(await canAccessMunicipality(auth.session, String(trip.municipalityId)))) return apiForbidden();

  // Solo asignable desde estados iniciales o re-asignación post-rechazo.
  const reasignableStates = ["pendiente_aceptacion", "rechazado", "cancelado"];
  if (trip.status && !reasignableStates.includes(trip.status) && trip.driverId) {
    return apiError(`No se puede reasignar un viaje en estado "${trip.status}"`, 409);
  }

  const driver = await Driver.findById(parsed.data.driverId)
    .select("_id userId municipalityId name")
    .lean<{ _id: unknown; userId?: unknown; municipalityId: unknown; name?: string } | null>();
  if (!driver) return apiError("Conductor no existe", 404);
  if (String(driver.municipalityId) !== String(trip.municipalityId)) {
    return apiError("El conductor no pertenece a la municipalidad del viaje", 409);
  }

  trip.driverId = driver._id as typeof trip.driverId;
  trip.status = "pendiente_aceptacion";
  trip.assignedAt = new Date();
  trip.acceptedAt = undefined;
  trip.rejectedAt = undefined;
  trip.rejectionReason = undefined;
  if (parsed.data.direction) trip.direction = parsed.data.direction;
  if (parsed.data.expectedReturnTime) trip.expectedReturnTime = new Date(parsed.data.expectedReturnTime);
  await trip.save();

  // Push + in-app al conductor (best-effort).
  if (driver.userId) {
    const userId = String(driver.userId);
    void sendPushToUser(
      userId,
      "Nuevo viaje asignado",
      `Tienes un viaje pendiente de aceptación.${parsed.data.direction ? ` Sentido: ${parsed.data.direction}.` : ""}`,
      { type: "asignacion_viaje", tripId: String(trip._id) },
    );
    void createNotification({
      userId,
      title: "Nuevo viaje asignado",
      body: "Revisa el detalle y acepta o rechaza la asignación.",
      type: "action_required",
      category: "asignacion",
      link: `/viajes/${String(trip._id)}`,
    }).catch(() => {});
  }

  void logAction({
    userId: auth.session.userId,
    action: "trip.assigned",
    resource: "trip",
    resourceId: String(trip._id),
    details: { driverId: String(driver._id), direction: parsed.data.direction },
    req: request,
    municipalityId: auth.session.municipalityId,
    role: auth.session.role,
  });

  return apiResponse({
    id: String(trip._id),
    status: trip.status,
    driverId: String(trip.driverId),
    assignedAt: trip.assignedAt,
    direction: trip.direction,
  });
}
