import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db/mongoose";
import { User } from "@/models/User";
import { apiResponse, apiUnauthorized, apiForbidden, apiError, apiNotFound } from "@/lib/api/response";
import { requireRole } from "@/lib/auth/guard";
import { ROLES, USER_STATUS, type Role } from "@/lib/constants";
import { createNotification } from "@/lib/notifications/create";
import { logAudit } from "@/lib/audit/log";
import { sendEmail } from "@/lib/email/email_service";
import { accountApprovedEmailHtml } from "@/lib/email/templates";

/**
 * RF-01-04: Admin Municipal aprueba una solicitud de usuario y asigna rol definitivo.
 * Body: { role: Role } — rol final asignado (puede ser distinto al solicitado).
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
    const assignedRole: Role | undefined = body.role;

    // Roles asignables según el rango del actor
    const rolesForActor: Record<string, Role[]> = {
      [ROLES.SUPER_ADMIN]:      [ROLES.CIUDADANO, ROLES.CONDUCTOR, ROLES.OPERADOR, ROLES.FISCAL, ROLES.ADMIN_MUNICIPAL, ROLES.ADMIN_PROVINCIAL],
      [ROLES.ADMIN_PROVINCIAL]: [ROLES.CIUDADANO, ROLES.CONDUCTOR, ROLES.OPERADOR, ROLES.FISCAL, ROLES.ADMIN_MUNICIPAL],
      [ROLES.ADMIN_MUNICIPAL]:  [ROLES.CIUDADANO, ROLES.CONDUCTOR, ROLES.OPERADOR, ROLES.FISCAL],
    };
    const validRoles = rolesForActor[auth.session.role] ?? [];

    if (!assignedRole || !validRoles.includes(assignedRole)) {
      return apiError("No tienes permiso para asignar ese rol", 403);
    }

    await connectDB();
    const target = await User.findById(id);
    if (!target) return apiNotFound("Usuario no encontrado");
    if (target.status !== USER_STATUS.PENDIENTE) {
      return apiError("La solicitud ya fue procesada", 400);
    }

    // RF-01-11: aislamiento por tenant
    if (
      auth.session.role === ROLES.ADMIN_MUNICIPAL &&
      String(target.municipalityId) !== String(auth.session.municipalityId)
    ) {
      return apiForbidden();
    }
    if (
      auth.session.role === ROLES.ADMIN_PROVINCIAL &&
      String(target.provinceId) !== String(auth.session.provinceId)
    ) {
      return apiForbidden();
    }

    target.status = USER_STATUS.ACTIVO;
    target.role = assignedRole;
    target.requestedRole = undefined;
    await target.save();

    // RF-18: Email de aprobación — best-effort
    void sendEmail(
      target.email,
      '[SFIT] Tu solicitud fue aprobada',
      accountApprovedEmailHtml({ userName: target.name, role: assignedRole }),
    ).catch(() => {});

    await createNotification({
      userId: target._id.toString(),
      title: "Tu solicitud fue aprobada",
      body: `Bienvenido a SFIT. Tu cuenta está activa con el rol de ${assignedRole}.`,
      type: "success",
      category: "aprobacion",
    });

    await logAudit(request, auth.session, {
      action: "user.approved",
      resourceType: "user",
      resourceId: target._id.toString(),
      metadata: { assignedRole },
    });

    return apiResponse({
      id: target._id.toString(),
      name: target.name,
      email: target.email,
      role: target.role,
      status: target.status,
    });
  } catch (error) {
    console.error("[users/approve]", error);
    return apiError("Error al aprobar solicitud", 500);
  }
}
