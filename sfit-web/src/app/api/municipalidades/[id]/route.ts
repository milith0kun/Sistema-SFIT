import { NextRequest } from "next/server";
import { isValidObjectId } from "mongoose";
import { z } from "zod";
import { connectDB } from "@/lib/db/mongoose";
import { Municipality } from "@/models/Municipality";
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

const UpdateMunicipalitySchema = z.object({
  name: z.string().min(2).max(160).optional(),
  logoUrl: z.string().url().optional(),
  active: z.boolean().optional(),
  ruc: z.string().regex(/^\d{11}$/, "RUC debe tener 11 dígitos").optional(),
  razonSocial: z.string().min(2).max(200).optional(),
});

/**
 * RF-02-05 / RF-02-06. GET/PATCH/DELETE scoped por rol.
 * DELETE = soft delete (active: false) (RF-02-06).
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = requireRole(request, [
    ROLES.SUPER_ADMIN,
    ROLES.ADMIN_PROVINCIAL,
    ROLES.ADMIN_MUNICIPAL,
  ]);
  if ("error" in auth) {
    return auth.error === "unauthorized" ? apiUnauthorized() : apiForbidden();
  }

  try {
    const { id } = await params;
    if (!isValidObjectId(id)) return apiError("ID inválido", 400);

    await connectDB();

    if (!(await canAccessMunicipality(auth.session, id))) {
      return apiForbidden();
    }

    const muni = await Municipality.findById(id).lean<{
      _id: unknown;
      name: string;
      provinceId: unknown;
      logoUrl?: string;
      active: boolean;
      ubigeoCode?: string;
      departmentCode?: string;
      provinceCode?: string;
      ruc?: string;
      razonSocial?: string;
      dataCompleted: boolean;
      createdAt: Date;
      updatedAt: Date;
    } | null>();
    if (!muni) return apiNotFound("Municipalidad no encontrada");

    return apiResponse({
      id: String(muni._id),
      name: muni.name,
      provinceId: String(muni.provinceId),
      logoUrl: muni.logoUrl,
      active: muni.active,
      ubigeoCode: muni.ubigeoCode,
      departmentCode: muni.departmentCode,
      provinceCode: muni.provinceCode,
      ruc: muni.ruc,
      razonSocial: muni.razonSocial,
      dataCompleted: muni.dataCompleted,
      createdAt: muni.createdAt,
      updatedAt: muni.updatedAt,
    });
  } catch (error) {
    console.error("[municipalidades/:id GET]", error);
    return apiError("Error al obtener municipalidad", 500);
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = requireRole(request, [
    ROLES.SUPER_ADMIN,
    ROLES.ADMIN_PROVINCIAL,
  ]);
  if ("error" in auth) {
    return auth.error === "unauthorized" ? apiUnauthorized() : apiForbidden();
  }

  try {
    const { id } = await params;
    if (!isValidObjectId(id)) return apiError("ID inválido", 400);

    const body = await request.json().catch(() => ({}));
    const parsed = UpdateMunicipalitySchema.safeParse(body);
    if (!parsed.success) {
      const errors: Record<string, string[]> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0]?.toString() ?? "general";
        errors[key] = [...(errors[key] ?? []), issue.message];
      }
      return apiValidationError(errors);
    }

    await connectDB();

    if (!(await canAccessMunicipality(auth.session, id))) {
      return apiForbidden();
    }

    // Si se completaron RUC y razón social, marcamos dataCompleted automáticamente.
    const patch: Record<string, unknown> = { ...parsed.data };
    if (parsed.data.ruc !== undefined && parsed.data.razonSocial !== undefined) {
      patch.dataCompleted = true;
    }

    const updated = await Municipality.findByIdAndUpdate(id, patch, {
      new: true,
    }).lean<{
      _id: unknown;
      name: string;
      provinceId: unknown;
      logoUrl?: string;
      active: boolean;
      ubigeoCode?: string;
      departmentCode?: string;
      provinceCode?: string;
      ruc?: string;
      razonSocial?: string;
      dataCompleted: boolean;
      createdAt: Date;
      updatedAt: Date;
    } | null>();
    if (!updated) return apiNotFound("Municipalidad no encontrada");

    return apiResponse({
      id: String(updated._id),
      name: updated.name,
      provinceId: String(updated.provinceId),
      logoUrl: updated.logoUrl,
      active: updated.active,
      ubigeoCode: updated.ubigeoCode,
      departmentCode: updated.departmentCode,
      provinceCode: updated.provinceCode,
      ruc: updated.ruc,
      razonSocial: updated.razonSocial,
      dataCompleted: updated.dataCompleted,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
    });
  } catch (error) {
    console.error("[municipalidades/:id PATCH]", error);
    return apiError("Error al actualizar municipalidad", 500);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = requireRole(request, [
    ROLES.SUPER_ADMIN,
    ROLES.ADMIN_PROVINCIAL,
  ]);
  if ("error" in auth) {
    return auth.error === "unauthorized" ? apiUnauthorized() : apiForbidden();
  }

  try {
    const { id } = await params;
    if (!isValidObjectId(id)) return apiError("ID inválido", 400);

    await connectDB();

    if (!(await canAccessMunicipality(auth.session, id))) {
      return apiForbidden();
    }

    // RF-02-06: soft delete bloquea acceso a todos sus usuarios
    const updated = await Municipality.findByIdAndUpdate(
      id,
      { active: false },
      { new: true },
    ).lean<{ _id: unknown; active: boolean } | null>();
    if (!updated) return apiNotFound("Municipalidad no encontrada");

    return apiResponse({ id: String(updated._id), active: updated.active });
  } catch (error) {
    console.error("[municipalidades/:id DELETE]", error);
    return apiError("Error al desactivar municipalidad", 500);
  }
}
