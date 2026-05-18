import { NextRequest } from "next/server";
import { isValidObjectId } from "mongoose";
import { z } from "zod";
import { connectDB } from "@/lib/db/mongoose";
import { Vehicle } from "@/models/Vehicle";
import { apiResponse, apiError, apiForbidden, apiNotFound, apiUnauthorized, apiValidationError } from "@/lib/api/response";
import { requireRole } from "@/lib/auth/guard";
import { ROLES } from "@/lib/constants";
import { canAccessMunicipality, scopedCompanyFilter } from "@/lib/auth/rbac";
import { rolesFor } from "@/lib/auth/roleMatrix";
import { Company } from "@/models/Company";

const UpdateSchema = z.object({
  companyId: z.string().refine(isValidObjectId).optional().nullable(),
  plate: z.string().min(5).max(10).optional(),
  vehicleTypeKey: z.string().min(1).max(80).optional(),
  brand: z.string().min(1).max(80).optional(),
  model: z.string().min(1).max(80).optional(),
  year: z.number().min(1990).optional(),
  status: z.enum(["disponible", "en_ruta", "en_mantenimiento", "fuera_de_servicio"]).optional(),
  lastInspectionStatus: z.enum(["aprobada", "observada", "rechazada", "pendiente"]).optional(),
  reputationScore: z.number().min(0).max(100).optional(),
  soatExpiry: z.string().optional(),
  photoUrl: z.string().url().nullable().optional(),
  active: z.boolean().optional(),
});

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = requireRole(request, [
    ROLES.SUPER_ADMIN, ROLES.ADMIN_MUNICIPAL, ROLES.FISCAL, ROLES.OPERADOR,
  ]);
  if ("error" in auth) return auth.error === "unauthorized" ? apiUnauthorized() : apiForbidden();

  const { id } = await params;
  if (!isValidObjectId(id)) return apiError("ID inválido", 400);

  await connectDB();
  const v = await Vehicle.findById(id)
    .populate("companyId", "razonSocial")
    .populate("currentDriverId", "name phone")
    .lean();
  if (!v) return apiNotFound("Vehículo no encontrado");
  if (!(await canAccessMunicipality(auth.session, String(v.municipalityId)))) return apiForbidden();

  return apiResponse({
    id: String(v._id),
    municipalityId: String(v.municipalityId),
    companyId: v.companyId ? String((v.companyId as { _id?: unknown })._id ?? v.companyId) : undefined,
    companyName: (v.companyId as { razonSocial?: string } | null)?.razonSocial,
    plate: v.plate,
    vehicleTypeKey: v.vehicleTypeKey,
    brand: v.brand,
    model: v.model,
    year: v.year,
    status: v.status,
    currentDriverId: v.currentDriverId ? String(v.currentDriverId) : undefined,
    currentDriverName: (v.currentDriverId as { name?: string } | null)?.name,
    lastInspectionStatus: v.lastInspectionStatus,
    reputationScore: v.reputationScore,
    soatExpiry: v.soatExpiry,
    qrHmac: v.qrHmac,
    verified: v.verified ?? false,
    verifiedAt: v.verifiedAt ?? null,
    verifiedBy: v.verifiedBy ? String(v.verifiedBy) : null,
    active: v.active,
    createdAt: v.createdAt,
    updatedAt: v.updatedAt,
  });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = requireRole(request, [...rolesFor("vehiculos", "edit")]);
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
  const vehicle = await Vehicle.findById(id);
  if (!vehicle) return apiNotFound("Vehículo no encontrado");
  if (!(await canAccessMunicipality(auth.session, String(vehicle.municipalityId)))) return apiForbidden();

  // Si se cambia companyId, validar que la empresa esté dentro del scope del
  // usuario. Sin esto un admin podría reasignar el vehículo a una empresa de
  // otra muni metiéndole el _id por API.
  if (parsed.data.companyId !== undefined && parsed.data.companyId !== null && parsed.data.companyId !== "") {
    const filter = await scopedCompanyFilter(auth.session);
    const match = await Company.findOne({ _id: parsed.data.companyId, ...filter })
      .select("_id active")
      .lean<{ _id: unknown; active?: boolean } | null>();
    if (!match) {
      return apiForbidden("La empresa indicada no es accesible en tu scope.");
    }
    if (!match.active) {
      return apiError("La empresa indicada está inactiva o pendiente de aprobación.", 422);
    }
  }

  const updateData = { ...parsed.data };
  if (updateData.soatExpiry) (updateData as Record<string, unknown>).soatExpiry = new Date(updateData.soatExpiry);
  if (updateData.plate) updateData.plate = updateData.plate.toUpperCase();

  Object.assign(vehicle, updateData);
  await vehicle.save();
  return apiResponse({ id: String(vehicle._id), ...vehicle.toObject() });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = requireRole(request, [...rolesFor("vehiculos", "delete")]);
  if ("error" in auth) return auth.error === "unauthorized" ? apiUnauthorized() : apiForbidden();

  const { id } = await params;
  if (!isValidObjectId(id)) return apiError("ID inválido", 400);

  await connectDB();
  const vehicle = await Vehicle.findById(id);
  if (!vehicle) return apiNotFound("Vehículo no encontrado");
  if (!(await canAccessMunicipality(auth.session, String(vehicle.municipalityId)))) return apiForbidden();

  vehicle.active = false;
  await vehicle.save();
  return apiResponse({ success: true });
}
