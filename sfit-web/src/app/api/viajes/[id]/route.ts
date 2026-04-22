import { NextRequest } from "next/server";
import { isValidObjectId } from "mongoose";
import { z } from "zod";
import { connectDB } from "@/lib/db/mongoose";
import { Trip } from "@/models/Trip";
import { apiResponse, apiError, apiForbidden, apiNotFound, apiUnauthorized, apiValidationError } from "@/lib/api/response";
import { requireRole } from "@/lib/auth/guard";
import { ROLES } from "@/lib/constants";
import { canAccessMunicipality } from "@/lib/auth/rbac";

const UpdateSchema = z.object({
  endTime: z.string().optional(),
  km: z.number().min(0).optional(),
  passengers: z.number().min(0).optional(),
  status: z.enum(["en_curso", "completado", "auto_cierre", "cerrado_automatico"]).optional(),
});

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = requireRole(request, [
    ROLES.SUPER_ADMIN, ROLES.ADMIN_PROVINCIAL, ROLES.ADMIN_MUNICIPAL, ROLES.FISCAL, ROLES.OPERADOR,
  ]);
  if ("error" in auth) return auth.error === "unauthorized" ? apiUnauthorized() : apiForbidden();

  const { id } = await params;
  if (!isValidObjectId(id)) return apiError("ID inválido", 400);

  await connectDB();
  const trip = await Trip.findById(id)
    .populate("vehicleId", "plate brand model")
    .populate("driverId", "name phone")
    .populate("routeId", "code name")
    .lean();
  if (!trip) return apiNotFound("Viaje no encontrado");
  if (!(await canAccessMunicipality(auth.session, String(trip.municipalityId)))) return apiForbidden();

  return apiResponse({ id: String(trip._id), ...trip });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = requireRole(request, [ROLES.SUPER_ADMIN, ROLES.ADMIN_MUNICIPAL, ROLES.OPERADOR]);
  if ("error" in auth) return auth.error === "unauthorized" ? apiUnauthorized() : apiForbidden();

  const { id } = await params;
  if (!isValidObjectId(id)) return apiError("ID inválido", 400);

  const body = await request.json().catch(() => ({}));
  const parsed = UpdateSchema.safeParse(body);
  if (!parsed.success) {
    const errors: Record<string, string[]> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0]?.toString() ?? "general";
      errors[key] = [...(errors[key] ?? []), issue.message];
    }
    return apiValidationError(errors);
  }

  await connectDB();
  const trip = await Trip.findById(id);
  if (!trip) return apiNotFound("Viaje no encontrado");
  if (!(await canAccessMunicipality(auth.session, String(trip.municipalityId)))) return apiForbidden();

  if (parsed.data.endTime) (parsed.data as Record<string, unknown>).endTime = new Date(parsed.data.endTime);
  Object.assign(trip, parsed.data);
  await trip.save();
  return apiResponse({ id: String(trip._id), ...trip.toObject() });
}
