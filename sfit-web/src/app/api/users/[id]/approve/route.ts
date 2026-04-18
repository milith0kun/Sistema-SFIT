import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db/mongoose";
import { User } from "@/models/User";
import { apiResponse, apiUnauthorized, apiForbidden, apiError, apiNotFound } from "@/lib/api/response";
import { requireRole } from "@/lib/auth/guard";
import { ROLES, USER_STATUS, type Role } from "@/lib/constants";

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

    const validRoles: Role[] = [
      ROLES.CIUDADANO,
      ROLES.CONDUCTOR,
      ROLES.OPERADOR,
      ROLES.FISCAL,
      ROLES.ADMIN_MUNICIPAL,
    ];

    if (!assignedRole || !validRoles.includes(assignedRole)) {
      return apiError("Rol inválido", 400);
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

    target.status = USER_STATUS.ACTIVO;
    target.role = assignedRole;
    target.requestedRole = undefined;
    await target.save();

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
