import { NextRequest } from "next/server";
import { isValidObjectId } from "mongoose";
import { z } from "zod";
import { connectDB } from "@/lib/db/mongoose";
import { User } from "@/models/User";
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
import { ROLES, USER_STATUS } from "@/lib/constants";
import { createNotification } from "@/lib/notifications/create";
import { logAudit } from "@/lib/audit/log";

const AssignSchema = z.object({
  provinceId: z.string().refine(isValidObjectId, "provinceId inválido"),
});

/**
 * RF-02-02: Atajo para que el Super Admin promueva a un usuario a Admin
 * Provincial de una provincia específica (role + provinceId + activo).
 */
export async function POST(
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
    const parsed = AssignSchema.safeParse(body);
    if (!parsed.success) {
      const errors: Record<string, string[]> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0]?.toString() ?? "general";
        errors[key] = [...(errors[key] ?? []), issue.message];
      }
      return apiValidationError(errors);
    }

    await connectDB();

    const province = await Province.findById(parsed.data.provinceId).select(
      "_id name",
    );
    if (!province) return apiError("Provincia no existe", 400);

    const target = await User.findById(id);
    if (!target) return apiNotFound("Usuario no encontrado");

    const prevRole = target.role;
    const prevStatus = target.status;

    target.role = ROLES.ADMIN_PROVINCIAL;
    target.set("provinceId", province._id);
    target.set("municipalityId", undefined);
    target.status = USER_STATUS.ACTIVO;
    target.requestedRole = undefined;
    await target.save();

    await createNotification({
      userId: target._id.toString(),
      title: "Fuiste designado Administrador Provincial",
      body: `Ahora administras la provincia de ${province.name}.`,
      type: "success",
      category: "aprobacion",
    });

    await logAudit(request, auth.session, {
      action: "user.assigned_admin_provincial",
      resourceType: "user",
      resourceId: target._id.toString(),
      metadata: {
        prevRole,
        prevStatus,
        provinceId: String(province._id),
      },
    });

    return apiResponse({
      id: target._id.toString(),
      name: target.name,
      email: target.email,
      role: target.role,
      status: target.status,
      provinceId: target.provinceId?.toString(),
    });
  } catch (error) {
    console.error("[admin/users/:id/assign-admin-provincial]", error);
    return apiError("Error al asignar Admin Provincial", 500);
  }
}
