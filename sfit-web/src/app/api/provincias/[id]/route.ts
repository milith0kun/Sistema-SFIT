import { NextRequest } from "next/server";
import { isValidObjectId } from "mongoose";
import { z } from "zod";
import { connectDB } from "@/lib/db/mongoose";
import { Province } from "@/models/Province";
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
import { canAccessProvince } from "@/lib/auth/rbac";

const UpdateProvinceSchema = z.object({
  name: z.string().min(2).max(120).optional(),
  region: z.string().min(2).max(120).optional(),
  active: z.boolean().optional(),
});

/**
 * RF-02-05 / RF-02-06.
 * GET — Super Admin y el Admin Provincial dueño.
 * PATCH / DELETE — Super Admin.
 */
export async function GET(
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

    if (!canAccessProvince(auth.session, id)) return apiForbidden();

    await connectDB();
    const province = await Province.findById(id).lean<{
      _id: unknown;
      name: string;
      region: string;
      active: boolean;
      createdAt: Date;
      updatedAt: Date;
    } | null>();
    if (!province) return apiNotFound("Provincia no encontrada");

    return apiResponse({
      id: String(province._id),
      name: province.name,
      region: province.region,
      active: province.active,
      createdAt: province.createdAt,
      updatedAt: province.updatedAt,
    });
  } catch (error) {
    console.error("[provincias/:id GET]", error);
    return apiError("Error al obtener provincia", 500);
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = requireRole(request, [ROLES.SUPER_ADMIN]);
  if ("error" in auth) {
    return auth.error === "unauthorized" ? apiUnauthorized() : apiForbidden();
  }

  try {
    const { id } = await params;
    if (!isValidObjectId(id)) return apiError("ID inválido", 400);

    const body = await request.json().catch(() => ({}));
    const parsed = UpdateProvinceSchema.safeParse(body);
    if (!parsed.success) {
      const errors: Record<string, string[]> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0]?.toString() ?? "general";
        errors[key] = [...(errors[key] ?? []), issue.message];
      }
      return apiValidationError(errors);
    }

    await connectDB();
    const updated = await Province.findByIdAndUpdate(id, parsed.data, {
      new: true,
    }).lean<{
      _id: unknown;
      name: string;
      region: string;
      active: boolean;
      createdAt: Date;
      updatedAt: Date;
    } | null>();
    if (!updated) return apiNotFound("Provincia no encontrada");

    return apiResponse({
      id: String(updated._id),
      name: updated.name,
      region: updated.region,
      active: updated.active,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
    });
  } catch (error) {
    console.error("[provincias/:id PATCH]", error);
    return apiError("Error al actualizar provincia", 500);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = requireRole(request, [ROLES.SUPER_ADMIN]);
  if ("error" in auth) {
    return auth.error === "unauthorized" ? apiUnauthorized() : apiForbidden();
  }

  try {
    const { id } = await params;
    if (!isValidObjectId(id)) return apiError("ID inválido", 400);

    await connectDB();

    // RF-02-06: soft delete — se desactiva, no se borra
    const updated = await Province.findByIdAndUpdate(
      id,
      { active: false },
      { new: true },
    ).lean<{ _id: unknown; active: boolean } | null>();
    if (!updated) return apiNotFound("Provincia no encontrada");

    return apiResponse({ id: String(updated._id), active: updated.active });
  } catch (error) {
    console.error("[provincias/:id DELETE]", error);
    return apiError("Error al desactivar provincia", 500);
  }
}
