import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db/mongoose";
import { User } from "@/models/User";
import { apiResponse, apiUnauthorized, apiForbidden, apiError } from "@/lib/api/response";
import { requireRole } from "@/lib/auth/guard";
import { ROLES, USER_STATUS } from "@/lib/constants";

/**
 * RF-01-04: Admin Municipal ve solicitudes pendientes de su municipalidad.
 * Admin Provincial ve todas las pendientes de su provincia.
 * Super Admin ve todo.
 */
export async function GET(request: NextRequest) {
  const auth = requireRole(request, [
    ROLES.SUPER_ADMIN,
    ROLES.ADMIN_PROVINCIAL,
    ROLES.ADMIN_MUNICIPAL,
  ]);

  if ("error" in auth) {
    return auth.error === "unauthorized" ? apiUnauthorized() : apiForbidden();
  }

  try {
    await connectDB();
    const { role, municipalityId, provinceId } = auth.session;

    const filter: Record<string, unknown> = { status: USER_STATUS.PENDIENTE };

    // RF-01-11: Aislamiento por tenant
    if (role === ROLES.ADMIN_MUNICIPAL && municipalityId) {
      filter.municipalityId = municipalityId;
    } else if (role === ROLES.ADMIN_PROVINCIAL && provinceId) {
      filter.provinceId = provinceId;
    }

    const users = await User.find(filter)
      .select("name email image requestedRole requestMessage municipalityId createdAt")
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    return apiResponse({
      users: users.map((u) => ({
        id: String(u._id),
        name: u.name,
        email: u.email,
        image: u.image,
        requestedRole: u.requestedRole,
        requestMessage: u.requestMessage,
        municipalityId: u.municipalityId?.toString(),
        createdAt: u.createdAt,
      })),
    });
  } catch (error) {
    console.error("[users/pending]", error);
    return apiError("Error al obtener solicitudes", 500);
  }
}
