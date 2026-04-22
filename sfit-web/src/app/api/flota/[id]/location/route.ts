import { NextRequest } from "next/server";
import { isValidObjectId } from "mongoose";
import { z } from "zod";
import { connectDB } from "@/lib/db/mongoose";
import { FleetEntry } from "@/models/FleetEntry";
import { apiResponse, apiError, apiForbidden, apiNotFound, apiUnauthorized } from "@/lib/api/response";
import { requireRole } from "@/lib/auth/guard";
import { ROLES } from "@/lib/constants";
import { canAccessMunicipality } from "@/lib/auth/rbac";

const LocationSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  action: z.enum(["start", "update", "end"]).optional(),
});

/**
 * PATCH /api/flota/[id]/location
 * Actualiza la posición GPS de una entrada de flota.
 * - action=start → pone status=en_ruta, guarda startLocation y departureTime
 * - action=end   → pone status=cerrado, guarda endLocation y returnTime
 * - action=update (o sin action) → solo actualiza currentLocation
 * Solo el conductor dueño de la entrada o roles admin pueden llamar este endpoint.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requireRole(request, [
    ROLES.CONDUCTOR, ROLES.OPERADOR, ROLES.ADMIN_MUNICIPAL, ROLES.SUPER_ADMIN,
  ]);
  if ("error" in auth) return auth.error === "unauthorized" ? apiUnauthorized() : apiForbidden();

  const { id } = await params;
  if (!isValidObjectId(id)) return apiError("ID inválido", 400);

  const body = await request.json().catch(() => ({}));
  const parsed = LocationSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(parsed.error.issues[0]?.message ?? "Datos inválidos", 422);
  }

  const { lat, lng, action } = parsed.data;

  await connectDB();
  const entry = await FleetEntry.findById(id);
  if (!entry) return apiNotFound("Entrada de flota no encontrada");

  if (auth.session.role === ROLES.CONDUCTOR) {
    if (String(entry.driverId) !== auth.session.userId) return apiForbidden();
  } else {
    if (!(await canAccessMunicipality(auth.session, String(entry.municipalityId)))) {
      return apiForbidden();
    }
  }

  entry.currentLocation = { lat, lng, updatedAt: new Date() };

  if (action === "start") {
    entry.startLocation = { lat, lng };
    entry.status = "en_ruta";
    if (!entry.departureTime) {
      entry.departureTime = new Date().toISOString();
    }
  } else if (action === "end") {
    entry.endLocation = { lat, lng };
    entry.status = "cerrado";
    if (!entry.returnTime) {
      entry.returnTime = new Date().toISOString();
    }
  }

  await entry.save();

  return apiResponse({
    id: String(entry._id),
    status: entry.status,
    currentLocation: entry.currentLocation,
    startLocation: entry.startLocation,
    endLocation: entry.endLocation,
    departureTime: entry.departureTime,
    returnTime: entry.returnTime,
  });
}
