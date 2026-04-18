import { NextRequest } from "next/server";
import { isValidObjectId } from "mongoose";
import { z } from "zod";
import { connectDB } from "@/lib/db/mongoose";
import { CitizenReport } from "@/models/CitizenReport";
import { apiResponse, apiError, apiForbidden, apiNotFound, apiUnauthorized, apiValidationError } from "@/lib/api/response";
import { requireRole } from "@/lib/auth/guard";
import { ROLES } from "@/lib/constants";
import { canAccessMunicipality } from "@/lib/auth/rbac";

const UpdateSchema = z.object({
  status: z.enum(["pendiente", "revision", "validado", "rechazado"]).optional(),
  assignedFiscalId: z.string().refine(isValidObjectId).optional(),
  fraudScore: z.number().min(0).max(100).optional(),
});

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = requireRole(request, [
    ROLES.SUPER_ADMIN, ROLES.ADMIN_PROVINCIAL, ROLES.ADMIN_MUNICIPAL, ROLES.FISCAL,
  ]);
  if ("error" in auth) return auth.error === "unauthorized" ? apiUnauthorized() : apiForbidden();

  const { id } = await params;
  if (!isValidObjectId(id)) return apiError("ID inválido", 400);

  await connectDB();
  const report = await CitizenReport.findById(id)
    .populate("vehicleId", "plate vehicleTypeKey brand model")
    .populate("citizenId", "name")
    .lean();
  if (!report) return apiNotFound("Reporte no encontrado");
  if (!(await canAccessMunicipality(auth.session, String(report.municipalityId)))) return apiForbidden();

  return apiResponse({ id: String(report._id), ...report });
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
  const report = await CitizenReport.findById(id);
  if (!report) return apiNotFound("Reporte no encontrado");
  if (!(await canAccessMunicipality(auth.session, String(report.municipalityId)))) return apiForbidden();

  Object.assign(report, parsed.data);
  await report.save();
  return apiResponse({ id: String(report._id), ...report.toObject() });
}
