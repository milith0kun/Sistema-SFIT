import { NextRequest } from "next/server";
import { isValidObjectId } from "mongoose";
import { z } from "zod";
import { connectDB } from "@/lib/db/mongoose";
import { FleetEntry } from "@/models/FleetEntry";
import { Driver } from "@/models/Driver";
import { apiResponse, apiError, apiForbidden, apiNotFound, apiUnauthorized, apiValidationError } from "@/lib/api/response";
import { requireRole } from "@/lib/auth/guard";
import { ROLES } from "@/lib/constants";
import { canAccessMunicipality } from "@/lib/auth/rbac";

const UpdateSchema = z.object({
  driverId: z.string().refine(isValidObjectId).optional(),
  routeId: z.string().refine(isValidObjectId).optional().nullable(),
  departureTime: z.string().optional(),
  returnTime: z.string().optional(),
  km: z.number().min(0).optional(),
  status: z.enum(["disponible", "en_ruta", "cerrado", "auto_cierre", "mantenimiento", "fuera_de_servicio"]).optional(),
  observations: z.string().max(500).optional(),
  checklistComplete: z.boolean().optional(),
});

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = requireRole(request, [
    ROLES.SUPER_ADMIN, ROLES.ADMIN_PROVINCIAL, ROLES.ADMIN_MUNICIPAL, ROLES.FISCAL, ROLES.OPERADOR,
  ]);
  if ("error" in auth) return auth.error === "unauthorized" ? apiUnauthorized() : apiForbidden();

  const { id } = await params;
  if (!isValidObjectId(id)) return apiError("ID inválido", 400);

  await connectDB();
  const entry = await FleetEntry.findById(id)
    .populate("vehicleId", "plate brand model vehicleTypeKey")
    .populate("routeId", "code name")
    .populate("driverId", "name status continuousHours restHours phone")
    .lean();
  if (!entry) return apiNotFound("Entrada de flota no encontrada");
  if (!(await canAccessMunicipality(auth.session, String(entry.municipalityId)))) return apiForbidden();

  return apiResponse({ id: String(entry._id), ...entry });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = requireRole(request, [
    ROLES.SUPER_ADMIN, ROLES.ADMIN_MUNICIPAL, ROLES.OPERADOR, ROLES.CONDUCTOR,
  ]);
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
  const entry = await FleetEntry.findById(id);
  if (!entry) return apiNotFound("Entrada de flota no encontrada");

  if (auth.session.role === ROLES.CONDUCTOR) {
    const driver = await Driver.findOne({ userId: auth.session.userId }).select("_id").lean();
    if (!driver || String(entry.driverId) !== String(driver._id)) return apiForbidden();
  } else {
    if (!(await canAccessMunicipality(auth.session, String(entry.municipalityId)))) return apiForbidden();
  }

  Object.assign(entry, parsed.data);
  await entry.save();
  return apiResponse({ id: String(entry._id), ...entry.toObject() });
}
