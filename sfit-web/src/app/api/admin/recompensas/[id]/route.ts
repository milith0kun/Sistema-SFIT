import { NextRequest } from "next/server";
import { isValidObjectId } from "mongoose";
import { z } from "zod";
import { connectDB } from "@/lib/db/mongoose";
import { Recompensa } from "@/models/Recompensa";
import { apiResponse, apiError, apiForbidden, apiNotFound, apiUnauthorized } from "@/lib/api/response";
import { requireRole } from "@/lib/auth/guard";
import { ROLES } from "@/lib/constants";

const PatchSchema = z.object({
  name: z.string().min(2).max(200).optional(),
  description: z.string().min(5).max(2000).optional(),
  cost: z.number().int().min(1).optional(),
  category: z.enum(["descuento", "beneficio", "certificado", "otro"]).optional(),
  stock: z.number().int().min(-1).optional(),
  active: z.boolean().optional(),
  imageUrl: z.string().url().optional(),
});

const ALLOWED = [ROLES.SUPER_ADMIN, ROLES.ADMIN_MUNICIPAL];

/**
 * PATCH /api/admin/recompensas/[id]
 * Actualiza parcialmente una recompensa (incluido toggle active).
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = requireRole(request, ALLOWED);
  if ("error" in auth) return auth.error === "unauthorized" ? apiUnauthorized() : apiForbidden();

  const { id } = await params;
  if (!isValidObjectId(id)) return apiError("ID inválido", 400);

  try {
    const body = await request.json().catch(() => ({}));
    const parsed = PatchSchema.safeParse(body);
    if (!parsed.success) return apiError("Datos inválidos", 400);

    await connectDB();
    const updated = await Recompensa.findByIdAndUpdate(
      id,
      { $set: parsed.data },
      { new: true },
    ).lean();

    if (!updated) return apiNotFound("Recompensa no encontrada");

    return apiResponse({
      id: String(updated._id),
      name: updated.name,
      description: updated.description,
      cost: updated.cost,
      category: updated.category,
      stock: updated.stock,
      active: updated.active,
    });
  } catch (error) {
    console.error("[admin/recompensas PATCH]", error);
    return apiError("Error al actualizar recompensa", 500);
  }
}

/**
 * DELETE /api/admin/recompensas/[id]
 * Elimina una recompensa del catálogo.
 */
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
    const deleted = await Recompensa.findByIdAndDelete(id);
    if (!deleted) return apiNotFound("Recompensa no encontrada");
    return apiResponse({ deleted: true });
  } catch (error) {
    console.error("[admin/recompensas DELETE]", error);
    return apiError("Error al eliminar recompensa", 500);
  }
}
