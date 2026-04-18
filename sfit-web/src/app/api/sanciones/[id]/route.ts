import { NextRequest } from "next/server";
import { isValidObjectId } from "mongoose";
import { z } from "zod";
import { connectDB } from "@/lib/db/mongoose";
import { Sanction } from "@/models/Sanction";
import { apiResponse, apiError, apiForbidden, apiNotFound, apiUnauthorized, apiValidationError } from "@/lib/api/response";
import { requireRole } from "@/lib/auth/guard";
import { ROLES } from "@/lib/constants";
import { canAccessMunicipality } from "@/lib/auth/rbac";

const UpdateSchema = z.object({
  status: z.enum(["emitida", "notificada", "apelada", "confirmada", "anulada"]).optional(),
  appealNotes: z.string().max(1000).optional(),
  amountSoles: z.number().min(0).optional(),
  amountUIT: z.string().max(30).optional(),
});

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = requireRole(request, [
    ROLES.SUPER_ADMIN, ROLES.ADMIN_PROVINCIAL, ROLES.ADMIN_MUNICIPAL, ROLES.FISCAL,
  ]);
  if ("error" in auth) return auth.error === "unauthorized" ? apiUnauthorized() : apiForbidden();

  const { id } = await params;
  if (!isValidObjectId(id)) return apiError("ID inválido", 400);

  await connectDB();
  const s = await Sanction.findById(id)
    .populate("vehicleId", "plate")
    .populate("driverId", "name phone")
    .populate("companyId", "razonSocial")
    .lean();
  if (!s) return apiNotFound("Sanción no encontrada");
  if (!(await canAccessMunicipality(auth.session, String(s.municipalityId)))) return apiForbidden();

  return apiResponse({ id: String(s._id), ...s });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = requireRole(request, [ROLES.SUPER_ADMIN, ROLES.ADMIN_MUNICIPAL, ROLES.FISCAL]);
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
  const sanction = await Sanction.findById(id);
  if (!sanction) return apiNotFound("Sanción no encontrada");
  if (!(await canAccessMunicipality(auth.session, String(sanction.municipalityId)))) return apiForbidden();

  if (parsed.data.status === "confirmada" || parsed.data.status === "anulada") {
    (sanction as unknown as { resolvedAt: Date }).resolvedAt = new Date();
  }
  Object.assign(sanction, parsed.data);
  await sanction.save();
  return apiResponse({ id: String(sanction._id), ...sanction.toObject() });
}
