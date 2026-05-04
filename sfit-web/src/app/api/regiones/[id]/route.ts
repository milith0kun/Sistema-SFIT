import { NextRequest } from "next/server";
import { isValidObjectId } from "mongoose";
import { z } from "zod";
import { connectDB } from "@/lib/db/mongoose";
import { Region } from "@/models/Region";
import { Province } from "@/models/Province";
import {
  apiResponse, apiError, apiForbidden, apiNotFound, apiUnauthorized, apiValidationError,
} from "@/lib/api/response";
import { requireRole } from "@/lib/auth/guard";
import { canAccessRegion } from "@/lib/auth/rbac";
import { ROLES } from "@/lib/constants";

const UpdateSchema = z.object({
  name: z.string().min(2).max(100).trim().optional(),
  code: z.string().regex(/^\d{2}$/).optional(),
  active: z.boolean().optional(),
});

/**
 * GET /api/regiones/[id] — detalle de región + provincias asociadas.
 * Acceso: super_admin (todas) y admin_regional (solo la suya).
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = requireRole(request, [ROLES.SUPER_ADMIN, ROLES.ADMIN_REGIONAL]);
  if ("error" in auth) return auth.error === "unauthorized" ? apiUnauthorized() : apiForbidden();

  const { id } = await params;
  if (!isValidObjectId(id)) return apiError("ID inválido", 400);
  if (!canAccessRegion(auth.session, id)) return apiForbidden();

  try {
    await connectDB();
    const region = await Region.findById(id).lean();
    if (!region) return apiNotFound("Región no encontrada");
    const provinces = await Province.find({ regionId: id })
      .select("_id name region active ubigeoCode")
      .sort({ name: 1 })
      .lean();
    return apiResponse({
      id: String(region._id),
      name: region.name,
      code: region.code,
      active: region.active,
      provinces: provinces.map((p) => ({
        id: String(p._id),
        name: p.name,
        active: p.active,
        ubigeoCode: p.ubigeoCode,
      })),
      createdAt: region.createdAt,
      updatedAt: region.updatedAt,
    });
  } catch (error) {
    console.error("[regiones/:id GET]", error);
    return apiError("Error al obtener región", 500);
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = requireRole(request, [ROLES.SUPER_ADMIN]);
  if ("error" in auth) return auth.error === "unauthorized" ? apiUnauthorized() : apiForbidden();

  const { id } = await params;
  if (!isValidObjectId(id)) return apiError("ID inválido", 400);

  const body = await request.json().catch(() => ({}));
  const parsed = UpdateSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(parsed.error.issues[0]?.message ?? "Datos inválidos", 422);
  }

  try {
    await connectDB();
    const updated = await Region.findByIdAndUpdate(
      id,
      { $set: parsed.data },
      { returnDocument: "after", runValidators: true },
    ).lean();
    if (!updated) return apiNotFound("Región no encontrada");
    return apiResponse({
      id: String(updated._id),
      name: updated.name,
      code: updated.code,
      active: updated.active,
      updatedAt: updated.updatedAt,
    });
  } catch (error) {
    console.error("[regiones/:id PATCH]", error);
    return apiError("Error al actualizar región", 500);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = requireRole(request, [ROLES.SUPER_ADMIN]);
  if ("error" in auth) return auth.error === "unauthorized" ? apiUnauthorized() : apiForbidden();

  const { id } = await params;
  if (!isValidObjectId(id)) return apiError("ID inválido", 400);

  try {
    await connectDB();
    // Soft-delete: desactivar en lugar de borrar para no romper foreign keys.
    const updated = await Region.findByIdAndUpdate(
      id,
      { $set: { active: false } },
      { returnDocument: "after" },
    ).lean();
    if (!updated) return apiNotFound("Región no encontrada");
    return apiResponse({ id: String(updated._id), active: updated.active });
  } catch (error) {
    console.error("[regiones/:id DELETE]", error);
    return apiError("Error al eliminar región", 500);
  }
}
