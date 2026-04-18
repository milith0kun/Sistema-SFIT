import { NextRequest } from "next/server";
import { isValidObjectId } from "mongoose";
import { z } from "zod";
import { connectDB } from "@/lib/db/mongoose";
import { Driver } from "@/models/Driver";
import { apiResponse, apiError, apiForbidden, apiNotFound, apiUnauthorized, apiValidationError } from "@/lib/api/response";
import { requireRole } from "@/lib/auth/guard";
import { ROLES } from "@/lib/constants";
import { canAccessMunicipality } from "@/lib/auth/rbac";

const UpdateSchema = z.object({
  companyId: z.string().refine(isValidObjectId).optional().nullable(),
  name: z.string().min(2).max(160).optional(),
  dni: z.string().min(6).max(20).optional(),
  licenseNumber: z.string().min(4).max(30).optional(),
  licenseCategory: z.string().min(2).max(20).optional(),
  phone: z.string().max(30).optional(),
  status: z.enum(["apto", "riesgo", "no_apto"]).optional(),
  continuousHours: z.number().min(0).max(24).optional(),
  restHours: z.number().min(0).max(24).optional(),
  reputationScore: z.number().min(0).max(100).optional(),
  active: z.boolean().optional(),
});

async function resolveDriver(request: NextRequest, id: string) {
  if (!isValidObjectId(id)) return { error: "ID inválido" as const };
  await connectDB();
  const driver = await Driver.findById(id).populate("companyId", "razonSocial").lean();
  if (!driver) return { error: "not_found" as const };
  return { driver };
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = requireRole(request, [
    ROLES.SUPER_ADMIN, ROLES.ADMIN_PROVINCIAL, ROLES.ADMIN_MUNICIPAL, ROLES.FISCAL, ROLES.OPERADOR,
  ]);
  if ("error" in auth) return auth.error === "unauthorized" ? apiUnauthorized() : apiForbidden();

  const { id } = await params;
  const res = await resolveDriver(request, id);
  if ("error" in res) return res.error === "not_found" ? apiNotFound("Conductor no encontrado") : apiError(res.error as string, 400);

  if (!(await canAccessMunicipality(auth.session, String(res.driver.municipalityId)))) return apiForbidden();

  return apiResponse({
    id: String(res.driver._id),
    municipalityId: String(res.driver.municipalityId),
    companyId: res.driver.companyId ? String(res.driver.companyId) : undefined,
    companyName: (res.driver.companyId as { razonSocial?: string } | null)?.razonSocial,
    name: res.driver.name,
    dni: res.driver.dni,
    licenseNumber: res.driver.licenseNumber,
    licenseCategory: res.driver.licenseCategory,
    phone: res.driver.phone,
    status: res.driver.status,
    continuousHours: res.driver.continuousHours,
    restHours: res.driver.restHours,
    reputationScore: res.driver.reputationScore,
    active: res.driver.active,
    createdAt: res.driver.createdAt,
    updatedAt: res.driver.updatedAt,
  });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = requireRole(request, [ROLES.SUPER_ADMIN, ROLES.ADMIN_MUNICIPAL, ROLES.OPERADOR, ROLES.FISCAL]);
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
  const driver = await Driver.findById(id);
  if (!driver) return apiNotFound("Conductor no encontrado");
  if (!(await canAccessMunicipality(auth.session, String(driver.municipalityId)))) return apiForbidden();

  Object.assign(driver, parsed.data);
  await driver.save();

  return apiResponse({ id: String(driver._id), ...driver.toObject() });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = requireRole(request, [ROLES.SUPER_ADMIN, ROLES.ADMIN_MUNICIPAL]);
  if ("error" in auth) return auth.error === "unauthorized" ? apiUnauthorized() : apiForbidden();

  const { id } = await params;
  if (!isValidObjectId(id)) return apiError("ID inválido", 400);

  await connectDB();
  const driver = await Driver.findById(id);
  if (!driver) return apiNotFound("Conductor no encontrado");
  if (!(await canAccessMunicipality(auth.session, String(driver.municipalityId)))) return apiForbidden();

  driver.active = false;
  await driver.save();
  return apiResponse({ success: true });
}
