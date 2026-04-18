import { NextRequest } from "next/server";
import { isValidObjectId } from "mongoose";
import { z } from "zod";
import { connectDB } from "@/lib/db/mongoose";
import { VehicleType } from "@/models/VehicleType";
import {
  apiResponse,
  apiError,
  apiForbidden,
  apiNotFound,
  apiUnauthorized,
  apiValidationError,
} from "@/lib/api/response";
import { requireRole } from "@/lib/auth/guard";
import { ROLES } from "@/lib/constants";
import { canAccessMunicipality } from "@/lib/auth/rbac";

const InspectionFieldSchema = z.object({
  key: z.string().min(1).max(80),
  label: z.string().min(1).max(160),
  type: z.enum(["boolean", "scale", "text"]),
});

const UpdateVehicleTypeSchema = z.object({
  name: z.string().min(2).max(160).optional(),
  description: z.string().max(500).optional(),
  icon: z.string().max(200).optional(),
  checklistItems: z.array(z.string().min(1).max(200)).optional(),
  inspectionFields: z.array(InspectionFieldSchema).optional(),
  reportCategories: z.array(z.string().min(1).max(160)).optional(),
  active: z.boolean().optional(),
});

/**
 * RF-03. Operaciones sobre un tipo de vehículo específico.
 * Toda operación valida que el solicitante puede acceder a su municipalidad.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = requireRole(request, [
    ROLES.SUPER_ADMIN,
    ROLES.ADMIN_PROVINCIAL,
    ROLES.ADMIN_MUNICIPAL,
    ROLES.FISCAL,
    ROLES.OPERADOR,
  ]);
  if ("error" in auth) {
    return auth.error === "unauthorized" ? apiUnauthorized() : apiForbidden();
  }

  try {
    const { id } = await params;
    if (!isValidObjectId(id)) return apiError("ID inválido", 400);

    await connectDB();

    const vt = await VehicleType.findById(id).lean<{
      _id: unknown;
      municipalityId: unknown;
      key: string;
      name: string;
      description: string;
      icon?: string;
      checklistItems: string[];
      inspectionFields: { key: string; label: string; type: string }[];
      reportCategories: string[];
      isCustom: boolean;
      active: boolean;
      createdAt: Date;
      updatedAt: Date;
    } | null>();
    if (!vt) return apiNotFound("Tipo de vehículo no encontrado");

    if (!(await canAccessMunicipality(auth.session, String(vt.municipalityId)))) {
      return apiForbidden();
    }

    return apiResponse({
      id: String(vt._id),
      municipalityId: String(vt.municipalityId),
      key: vt.key,
      name: vt.name,
      description: vt.description,
      icon: vt.icon,
      checklistItems: vt.checklistItems,
      inspectionFields: vt.inspectionFields,
      reportCategories: vt.reportCategories,
      isCustom: vt.isCustom,
      active: vt.active,
      createdAt: vt.createdAt,
      updatedAt: vt.updatedAt,
    });
  } catch (error) {
    console.error("[tipos-vehiculo/:id GET]", error);
    return apiError("Error al obtener tipo de vehículo", 500);
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = requireRole(request, [
    ROLES.SUPER_ADMIN,
    ROLES.ADMIN_MUNICIPAL,
  ]);
  if ("error" in auth) {
    return auth.error === "unauthorized" ? apiUnauthorized() : apiForbidden();
  }

  try {
    const { id } = await params;
    if (!isValidObjectId(id)) return apiError("ID inválido", 400);

    const body = await request.json().catch(() => ({}));
    const parsed = UpdateVehicleTypeSchema.safeParse(body);
    if (!parsed.success) {
      const errors: Record<string, string[]> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0]?.toString() ?? "general";
        errors[key] = [...(errors[key] ?? []), issue.message];
      }
      return apiValidationError(errors);
    }

    await connectDB();

    const existing = await VehicleType.findById(id);
    if (!existing) return apiNotFound("Tipo de vehículo no encontrado");

    if (
      !(await canAccessMunicipality(
        auth.session,
        String(existing.municipalityId),
      ))
    ) {
      return apiForbidden();
    }

    Object.assign(existing, parsed.data);
    await existing.save();

    return apiResponse({
      id: String(existing._id),
      municipalityId: String(existing.municipalityId),
      key: existing.key,
      name: existing.name,
      description: existing.description,
      icon: existing.icon,
      checklistItems: existing.checklistItems,
      inspectionFields: existing.inspectionFields,
      reportCategories: existing.reportCategories,
      isCustom: existing.isCustom,
      active: existing.active,
      createdAt: existing.createdAt,
      updatedAt: existing.updatedAt,
    });
  } catch (error) {
    console.error("[tipos-vehiculo/:id PATCH]", error);
    return apiError("Error al actualizar tipo de vehículo", 500);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = requireRole(request, [
    ROLES.SUPER_ADMIN,
    ROLES.ADMIN_MUNICIPAL,
  ]);
  if ("error" in auth) {
    return auth.error === "unauthorized" ? apiUnauthorized() : apiForbidden();
  }

  try {
    const { id } = await params;
    if (!isValidObjectId(id)) return apiError("ID inválido", 400);

    await connectDB();

    const existing = await VehicleType.findById(id);
    if (!existing) return apiNotFound("Tipo de vehículo no encontrado");

    if (
      !(await canAccessMunicipality(
        auth.session,
        String(existing.municipalityId),
      ))
    ) {
      return apiForbidden();
    }

    existing.active = false;
    await existing.save();

    return apiResponse({
      id: String(existing._id),
      active: existing.active,
    });
  } catch (error) {
    console.error("[tipos-vehiculo/:id DELETE]", error);
    return apiError("Error al desactivar tipo de vehículo", 500);
  }
}
