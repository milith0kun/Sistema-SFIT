import { NextRequest } from "next/server";
import { isValidObjectId } from "mongoose";
import { connectDB } from "@/lib/db/mongoose";
import { AuditLog } from "@/models/AuditLog";
import { Municipality } from "@/models/Municipality";
import { apiResponse, apiError, apiForbidden, apiUnauthorized } from "@/lib/api/response";
import { requireRole } from "@/lib/auth/guard";
import { ROLES } from "@/lib/constants";

/**
 * GET /api/admin/audit
 * Consulta del log de auditoría con populate de actorId (name, email).
 * Acceso: super_admin, admin_provincial, admin_municipal.
 * Query params: resource, action, userId, limit (default 20), page (default 1).
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
    const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit") ?? 20)));

    const resourceParam = url.searchParams.get("resource");
    const actionParam = url.searchParams.get("action");
    const userIdParam = url.searchParams.get("userId");
    const municipalityIdParam = url.searchParams.get("municipalityId");

    const filter: Record<string, unknown> = {};

    // Scope por rol
    if (auth.session.role === ROLES.ADMIN_MUNICIPAL) {
      if (!auth.session.municipalityId) return apiForbidden();
      filter.municipalityId = auth.session.municipalityId;
    } else if (auth.session.role === ROLES.ADMIN_PROVINCIAL) {
      if (!auth.session.provinceId) return apiForbidden();
      const munis = await Municipality.find({ provinceId: auth.session.provinceId })
        .select("_id")
        .lean<{ _id: unknown }[]>();
      const muniIds = munis.map((m) => m._id);
      filter.$or = [
        { provinceId: auth.session.provinceId },
        { municipalityId: { $in: muniIds } },
      ];
    } else {
      // super_admin puede filtrar por municipalidad
      if (municipalityIdParam && isValidObjectId(municipalityIdParam)) {
        filter.municipalityId = municipalityIdParam;
      }
    }

    if (resourceParam) filter.resourceType = resourceParam;
    if (actionParam) filter.action = actionParam;
    if (userIdParam && isValidObjectId(userIdParam)) filter.actorId = userIdParam;

    const [items, total] = await Promise.all([
      AuditLog.find(filter)
        .populate("actorId", "name email")
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      AuditLog.countDocuments(filter),
    ]);

    return apiResponse({
      items: items.map((l) => {
        const actor = l.actorId as unknown as { _id: unknown; name?: string; email?: string } | null;
        return {
          id: String(l._id),
          userId: actor ? String(actor._id) : String(l.actorId),
          userName: actor?.name ?? null,
          userEmail: actor?.email ?? null,
          actorRole: l.actorRole,
          action: l.action,
          resource: l.resourceType,
          resourceId: l.resourceId,
          details: l.metadata,
          ip: l.ipAddress,
          userAgent: l.userAgent,
          municipalityId: l.municipalityId?.toString(),
          createdAt: l.createdAt,
        };
      }),
      total,
      page,
      limit,
    });
  } catch (error) {
    console.error("[admin/audit GET]", error);
    return apiError("Error al listar auditoría", 500);
  }
}
