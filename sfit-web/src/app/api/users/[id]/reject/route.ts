import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db/mongoose";
import { User } from "@/models/User";
import { apiResponse, apiUnauthorized, apiForbidden, apiError, apiNotFound } from "@/lib/api/response";
import { requireRole } from "@/lib/auth/guard";
import { ROLES, USER_STATUS } from "@/lib/constants";
import { createNotification } from "@/lib/notifications/create";
import { logAudit } from "@/lib/audit/log";

/**
 * RF-01-04: Admin Municipal rechaza una solicitud de usuario.
 * Body: { reason?: string } — motivo opcional del rechazo.
 */
export async function POST(
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
    const body = await request.json().catch(() => ({}));
    const reason: string | undefined = body.reason;

    await connectDB();
    const target = await User.findById(id);
    if (!target) return apiNotFound("Usuario no encontrado");
    if (target.status !== USER_STATUS.PENDIENTE) {
      return apiError("La solicitud ya fue procesada", 400);
    }

    if (
      auth.session.role === ROLES.ADMIN_MUNICIPAL &&
      String(target.municipalityId) !== String(auth.session.municipalityId)
    ) {
      return apiForbidden();
    }

    target.status = USER_STATUS.RECHAZADO;
    target.rejectionReason = reason?.trim() || "No cumple con los requisitos";
    await target.save();

    await createNotification({
      userId: target._id.toString(),
      title: "Tu solicitud fue rechazada",
      body: target.rejectionReason,
      type: "error",
      category: "aprobacion",
    });

    await logAudit(request, auth.session, {
      action: "user.rejected",
      resourceType: "user",
      resourceId: target._id.toString(),
      metadata: { rejectionReason: target.rejectionReason },
    });

    return apiResponse({
      id: target._id.toString(),
      status: target.status,
      rejectionReason: target.rejectionReason,
    });
  } catch (error) {
    console.error("[users/reject]", error);
    return apiError("Error al rechazar solicitud", 500);
  }
}
