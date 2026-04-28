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
import { logAudit } from "@/lib/audit/log";

/**
 * PATCH /api/admin/municipalidades/[id]/activar
 *
 * Incorpora (active: true) o desactiva (active: false) una municipalidad
 * del catálogo UBIGEO.
 *
 * Reglas:
 *   - Solo super_admin y admin_provincial.
 *   - admin_provincial solo puede activar/desactivar muni's de su provincia.
 *   - La municipalidad debe tener `ubigeoCode` (catálogo oficial). Las entradas
 *     legacy sin código no se pueden gestionar por este endpoint.
 *
 * Body: { active: boolean, logoUrl?: string }
 */
const ActivarSchema = z.object({
  active: z.boolean(),
  logoUrl: z.string().url().optional(),
});

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
    const parsed = ActivarSchema.safeParse(body);
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

    const muni = await Municipality.findById(id);
    if (!muni) return apiNotFound("Municipalidad no encontrada");

    if (!muni.ubigeoCode) {
      return apiError(
        "Esta municipalidad no pertenece al catálogo UBIGEO. No se puede activar/desactivar por este endpoint.",
        422,
      );
    }

    const previousActive = muni.active;
    muni.active = parsed.data.active;
    if (parsed.data.logoUrl !== undefined) muni.logoUrl = parsed.data.logoUrl;
    await muni.save();

    if (previousActive !== muni.active) {
      await logAudit(request, auth.session, {
        action: muni.active ? "municipality.activated" : "municipality.deactivated",
        resourceType: "municipality",
        resourceId: String(muni._id),
        metadata: {
          ubigeoCode: muni.ubigeoCode,
          name: muni.name,
        },
      });
    }

    return apiResponse({
      id: String(muni._id),
      name: muni.name,
      provinceId: String(muni.provinceId),
      ubigeoCode: muni.ubigeoCode,
      departmentCode: muni.departmentCode,
      provinceCode: muni.provinceCode,
      logoUrl: muni.logoUrl,
      active: muni.active,
      createdAt: muni.createdAt,
      updatedAt: muni.updatedAt,
    });
  } catch (error) {
    console.error("[admin/municipalidades/:id/activar PATCH]", error);
    return apiError("Error al actualizar estado de municipalidad", 500);
  }
}
