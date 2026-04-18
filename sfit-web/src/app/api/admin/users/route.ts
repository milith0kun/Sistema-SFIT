import { NextRequest } from "next/server";
import { isValidObjectId } from "mongoose";
import { connectDB } from "@/lib/db/mongoose";
import { User } from "@/models/User";
import { Municipality } from "@/models/Municipality";
import {
  apiResponse,
  apiError,
  apiForbidden,
  apiUnauthorized,
} from "@/lib/api/response";
import { requireRole } from "@/lib/auth/guard";
import { ROLES } from "@/lib/constants";

/**
 * RF-02 / RF-01-04.
 * GET — listado de usuarios scoped por rol.
 *   super_admin     → todos
 *   admin_provincial → su provincia (municipalidades + provinceId directo)
 *   admin_municipal  → su municipalidad
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

    const url = new URL(request.url);
    const page = Math.max(1, Number(url.searchParams.get("page") ?? 1));
    const limit = Math.min(
      100,
      Math.max(1, Number(url.searchParams.get("limit") ?? 20)),
    );

    const roleParam = url.searchParams.get("role");
    const statusParam = url.searchParams.get("status");
    const provinceIdParam = url.searchParams.get("provinceId");
    const municipalityIdParam = url.searchParams.get("municipalityId");
    const q = url.searchParams.get("q");

    const filter: Record<string, unknown> = {};

    // Scope por rol (RNF-03)
    if (auth.session.role === ROLES.ADMIN_MUNICIPAL) {
      if (!auth.session.municipalityId) return apiForbidden();
      filter.municipalityId = auth.session.municipalityId;
    } else if (auth.session.role === ROLES.ADMIN_PROVINCIAL) {
      if (!auth.session.provinceId) return apiForbidden();
      const munis = await Municipality.find({
        provinceId: auth.session.provinceId,
      })
        .select("_id")
        .lean<{ _id: unknown }[]>();
      const muniIds = munis.map((m) => m._id);
      filter.$or = [
        { provinceId: auth.session.provinceId },
        { municipalityId: { $in: muniIds } },
      ];
    } else {
      // super_admin puede filtrar opcionalmente
      if (provinceIdParam && isValidObjectId(provinceIdParam)) {
        filter.provinceId = provinceIdParam;
      }
      if (municipalityIdParam && isValidObjectId(municipalityIdParam)) {
        filter.municipalityId = municipalityIdParam;
      }
    }

    if (roleParam) filter.role = roleParam;
    if (statusParam) filter.status = statusParam;

    if (q && q.trim().length > 0) {
      const regex = new RegExp(
        q.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
        "i",
      );
      const search = [{ email: regex }, { name: regex }];
      if (Array.isArray(filter.$or)) {
        // Combina tenant scope + búsqueda bajo $and
        filter.$and = [{ $or: filter.$or }, { $or: search }];
        delete filter.$or;
      } else {
        filter.$or = search;
      }
    }

    const [items, total] = await Promise.all([
      User.find(filter)
        .select(
          "name email image role requestedRole status municipalityId provinceId phone dni lastLoginAt createdAt updatedAt",
        )
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      User.countDocuments(filter),
    ]);

    return apiResponse({
      items: items.map((u) => ({
        id: String(u._id),
        name: u.name,
        email: u.email,
        image: u.image,
        role: u.role,
        requestedRole: u.requestedRole,
        status: u.status,
        municipalityId: u.municipalityId?.toString(),
        provinceId: u.provinceId?.toString(),
        phone: u.phone,
        dni: u.dni,
        lastLoginAt: u.lastLoginAt,
        createdAt: u.createdAt,
        updatedAt: u.updatedAt,
      })),
      total,
      page,
      limit,
    });
  } catch (error) {
    console.error("[admin/users GET]", error);
    return apiError("Error al listar usuarios", 500);
  }
}

