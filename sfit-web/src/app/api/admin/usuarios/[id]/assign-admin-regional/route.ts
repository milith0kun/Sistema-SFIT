import { NextRequest } from "next/server";
import { isValidObjectId } from "mongoose";
import { z } from "zod";
import { connectDB } from "@/lib/db/mongoose";
import { User } from "@/models/User";
import { Region } from "@/models/Region";
import {
  apiResponse, apiError, apiForbidden, apiNotFound, apiUnauthorized, apiValidationError,
} from "@/lib/api/response";
import { requireRole } from "@/lib/auth/guard";
import { ROLES, USER_STATUS } from "@/lib/constants";
import { createNotification } from "@/lib/notifications/create";
import { logAudit } from "@/lib/audit/log";

const AssignSchema = z.object({
  regionId: z.string().refine(isValidObjectId, "regionId inválido"),
});

/**
 * POST /api/admin/usuarios/[id]/assign-admin-regional
 *
 * Atajo para que el super_admin promueva a un usuario a admin_regional
 * de una región concreta. Limpia provinceId y municipalityId para que el
 * usuario quede únicamente con regionId (un admin_regional no pertenece
 * a una sola provincia ni muni). Hereda el patrón de
 * `/assign-admin-provincial`.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = requireRole(request, [ROLES.SUPER_ADMIN]);
  if ("error" in auth) return auth.error === "unauthorized" ? apiUnauthorized() : apiForbidden();

  try {
    const { id } = await params;
    if (!isValidObjectId(id)) return apiError("ID inválido", 400);

    const body = await request.json().catch(() => ({}));
    const parsed = AssignSchema.safeParse(body);
    if (!parsed.success) {
      const errors: Record<string, string[]> = {};
      for (const issue of parsed.error.issues) {
        const k = issue.path[0]?.toString() ?? "general";
        errors[k] = [...(errors[k] ?? []), issue.message];
      }
      return apiValidationError(errors);
    }

    await connectDB();

    const region = await Region.findById(parsed.data.regionId).select("_id name").lean();
    if (!region) return apiError("Región no existe", 400);

    const target = await User.findById(id);
    if (!target) return apiNotFound("Usuario no encontrado");

    const prevRole = target.role;
    const prevStatus = target.status;

    target.role = ROLES.ADMIN_REGIONAL;
    target.set("regionId", region._id);
    target.set("provinceId", undefined);
    target.set("municipalityId", undefined);
    target.status = USER_STATUS.ACTIVO;
    target.requestedRole = undefined;
    await target.save();

    await createNotification({
      userId: target._id.toString(),
      title: "Designado Admin Regional",
      body: `Ahora administras la región ${region.name}.`,
      type: "success",
      category: "aprobacion",
    });

    await logAudit(request, auth.session, {
      action: "user.assigned_admin_regional",
      resourceType: "user",
      resourceId: target._id.toString(),
      metadata: { prevRole, prevStatus, regionId: String(region._id) },
    });

    return apiResponse({
      id: target._id.toString(),
      name: target.name,
      email: target.email,
      role: target.role,
      status: target.status,
      regionId: target.regionId?.toString(),
    });
  } catch (error) {
    console.error("[admin/usuarios/:id/assign-admin-regional]", error);
    return apiError("Error al asignar Admin Regional", 500);
  }
}
