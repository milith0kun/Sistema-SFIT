import { NextRequest } from "next/server";
import { isValidObjectId } from "mongoose";
import { z } from "zod";
import { connectDB } from "@/lib/db/mongoose";
import { Apelacion } from "@/models/Apelacion";
import { apiResponse, apiError, apiForbidden, apiNotFound, apiUnauthorized, apiValidationError } from "@/lib/api/response";
import { requireRole } from "@/lib/auth/guard";
import { ROLES } from "@/lib/constants";

const ResolveSchema = z.object({
  status: z.enum(["aprobada", "rechazada"]),
  resolution: z.string().min(5, "La resolución debe tener al menos 5 caracteres").max(2000),
});

// ── PATCH /api/apelaciones/[id]/resolver ─────────────────────────────────────
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = requireRole(request, [
    ROLES.FISCAL, ROLES.ADMIN_MUNICIPAL, ROLES.ADMIN_PROVINCIAL, ROLES.SUPER_ADMIN,
  ]);
  if ("error" in auth) return auth.error === "unauthorized" ? apiUnauthorized() : apiForbidden();

  const { id } = await params;
  if (!isValidObjectId(id)) return apiError("ID inválido", 400);

  let body: unknown;
  try { body = await request.json(); } catch { body = {}; }

  const parsed = ResolveSchema.safeParse(body);
  if (!parsed.success) {
    const errors: Record<string, string[]> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0]?.toString() ?? "general";
      errors[key] = [...(errors[key] ?? []), issue.message];
    }
    return apiValidationError(errors);
  }

  try {
    await connectDB();

    const apelacion = await Apelacion.findById(id);
    if (!apelacion) return apiNotFound("Apelación no encontrada");

    if (apelacion.status !== "pendiente") {
      return apiError("Solo se pueden resolver apelaciones en estado pendiente", 422);
    }

    apelacion.status = parsed.data.status;
    apelacion.resolution = parsed.data.resolution;
    apelacion.resolvedBy = auth.session.userId as unknown as typeof apelacion.resolvedBy;
    apelacion.resolvedAt = new Date();
    await apelacion.save();

    const updated = await Apelacion.findById(id)
      .populate("inspectionId", "result date score")
      .populate("vehicleId", "plate vehicleTypeKey brand model")
      .populate("submittedBy", "name email")
      .populate("resolvedBy", "name")
      .lean();

    return apiResponse({
      id: String(updated!._id),
      ...updated,
    });
  } catch (error) {
    console.error("[apelaciones/resolver PATCH]", error);
    return apiError("Error al resolver apelación", 500);
  }
}
