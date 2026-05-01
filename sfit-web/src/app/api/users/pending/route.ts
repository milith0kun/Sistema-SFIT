import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db/mongoose";
import { User } from "@/models/User";
import { Municipality } from "@/models/Municipality";
import { apiResponse, apiUnauthorized, apiForbidden, apiError } from "@/lib/api/response";
import { requireRole } from "@/lib/auth/guard";
import { ROLES, USER_STATUS } from "@/lib/constants";

/**
 * RF-01-04: Admin Municipal ve solicitudes pendientes de su municipalidad.
 * Admin Provincial ve todas las pendientes de su provincia.
 * Super Admin ve todo.
 *
 * Para admin_provincial el filtro acepta dos formas para defenderse de
 * datos pre-migración: `provinceId` directo (denormalizado por el hook
 * pre-save de User) o `municipalityId IN munis-de-mi-provincia`.
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

    if (role === ROLES.ADMIN_MUNICIPAL) {
      if (!municipalityId) return apiError("Admin sin municipalidad asignada", 400);
      filter.municipalityId = municipalityId;
    } else if (role === ROLES.ADMIN_PROVINCIAL) {
      if (!provinceId) return apiError("Admin sin provincia asignada", 400);
      const muniIds = (
        await Municipality.find({ provinceId }).select("_id").lean()
      ).map((m: { _id: unknown }) => m._id);
      filter.$or = [
        { provinceId },
        { municipalityId: { $in: muniIds } },
      ];
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
