import { NextRequest } from "next/server";
import { isValidObjectId } from "mongoose";
import { connectDB } from "@/lib/db/mongoose";
import { AuditLog } from "@/models/AuditLog";
import { Municipality } from "@/models/Municipality";
import { User } from "@/models/User";
import {
  apiResponse,
  apiError,
  apiForbidden,
  apiUnauthorized,
} from "@/lib/api/response";
import { requireRole } from "@/lib/auth/guard";
import { ROLES } from "@/lib/constants";

/**
 * RNF-16: Consulta del log de auditoría.
 *   super_admin       → todo
 *   admin_provincial  → su provincia (municipalidades + provinceId directo)
 *   admin_municipal   → su municipalidad
 * Filtros: actorId, action, resourceType, municipalityId, from, to.
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

    const actorIdParam = url.searchParams.get("actorId");
    const actorEmailParam = url.searchParams.get("actorEmail");
    const actionParam = url.searchParams.get("action");
    const resourceTypeParam = url.searchParams.get("resourceType");
    const municipalityIdParam = url.searchParams.get("municipalityId");
    const fromParam = url.searchParams.get("from");
    const toParam = url.searchParams.get("to");

    const filter: Record<string, unknown> = {};

    // Resolver actorEmail → actorId
    if (actorEmailParam?.trim()) {
      const actor = await User.findOne({ email: actorEmailParam.trim().toLowerCase() }).select("_id").lean();
      if (actor) filter.actorId = actor._id;
      else filter.actorId = null; // sin resultados
    }

    // Scope por rol
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
      if (municipalityIdParam && isValidObjectId(municipalityIdParam)) {
        filter.municipalityId = municipalityIdParam;
      }
    }

    if (actorIdParam && isValidObjectId(actorIdParam) && !actorEmailParam?.trim()) {
      filter.actorId = actorIdParam;
    }
    if (actionParam) filter.action = actionParam;
    if (resourceTypeParam) filter.resourceType = resourceTypeParam;

    if (fromParam || toParam) {
      const range: Record<string, Date> = {};
      if (fromParam) {
        const d = new Date(fromParam);
        if (!Number.isNaN(d.getTime())) range.$gte = d;
      }
      if (toParam) {
        const d = new Date(toParam);
        if (!Number.isNaN(d.getTime())) range.$lte = d;
      }
      if (Object.keys(range).length) filter.createdAt = range;
    }

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
          actorId: actor ? String(actor._id) : String(l.actorId),
          actorName: actor?.name ?? null,
          actorEmail: actor?.email ?? null,
          actorRole: l.actorRole,
          action: l.action,
          resourceType: l.resourceType,
          resourceId: l.resourceId,
          municipalityId: l.municipalityId?.toString(),
          provinceId: l.provinceId?.toString(),
          metadata: l.metadata,
          ipAddress: l.ipAddress,
          userAgent: l.userAgent,
          createdAt: l.createdAt,
        };
      }),
      total,
      page,
      limit,
    });
  } catch (error) {
    console.error("[admin/audit-log GET]", error);
    return apiError("Error al listar log de auditoría", 500);
  }
}
