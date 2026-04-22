/**
 * GET /api/admin/usuarios — Lista usuarios según scope del admin autenticado.
 *
 * Filtros de scope:
 *   - super_admin       → todos los usuarios
 *   - admin_provincial  → usuarios de su provinceId
 *   - admin_municipal   → usuarios de su municipalityId
 *
 * Query params:
 *   role     → filtrar por rol
 *   status   → filtrar por estado (activo / pendiente / suspendido / rechazado)
 *   limit    → default 20, max 100
 *   page     → default 1
 */
import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db/mongoose";
import { User } from "@/models/User";
import { apiResponse, apiError, apiUnauthorized, apiForbidden } from "@/lib/api/response";
import { requireRole } from "@/lib/auth/guard";
import { ROLES } from "@/lib/constants";

const ALLOWED_ROLES = [ROLES.SUPER_ADMIN, ROLES.ADMIN_PROVINCIAL, ROLES.ADMIN_MUNICIPAL];

export async function GET(request: NextRequest) {
  const auth = requireRole(request, ALLOWED_ROLES);
  if ("error" in auth) return auth.error === "unauthorized" ? apiUnauthorized() : apiForbidden();

  const { session } = auth;
  const url = new URL(request.url);

  const page  = Math.max(1, Number(url.searchParams.get("page")  ?? 1));
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit") ?? 20)));
  const roleFilter   = url.searchParams.get("role");
  const statusFilter = url.searchParams.get("status");

  // ── Filtro de scope por rol del admin ──────────────────────────────────────
  const filter: Record<string, unknown> = {};

  if (session.role === ROLES.ADMIN_MUNICIPAL) {
    if (!session.municipalityId) {
      return apiError("El admin municipal no tiene municipalidad asignada", 400);
    }
    filter.municipalityId = session.municipalityId;
  } else if (session.role === ROLES.ADMIN_PROVINCIAL) {
    if (!session.provinceId) {
      return apiError("El admin provincial no tiene provincia asignada", 400);
    }
    filter.provinceId = session.provinceId;
  }
  // super_admin → sin filtro de scope

  // ── Filtros opcionales ─────────────────────────────────────────────────────
  const validRoles = Object.values(ROLES);
  if (roleFilter && validRoles.includes(roleFilter as typeof ROLES[keyof typeof ROLES])) {
    filter.role = roleFilter;
  }

  const validStatuses = ["activo", "pendiente", "suspendido", "rechazado"];
  if (statusFilter && validStatuses.includes(statusFilter)) {
    filter.status = statusFilter;
  }

  try {
    await connectDB();

    const [items, total] = await Promise.all([
      User.find(filter)
        .select("name email role status municipalityId provinceId phone dni createdAt image")
        .populate("municipalityId", "name")
        .populate("provinceId", "name")
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
        role: u.role,
        status: u.status,
        phone: u.phone ?? null,
        dni: u.dni ?? null,
        municipality: u.municipalityId as unknown as { _id: string; name: string } | null,
        province: u.provinceId as unknown as { _id: string; name: string } | null,
        createdAt: u.createdAt,
        image: u.image ?? null,
      })),
      total,
      page,
      limit,
    });
  } catch (error) {
    console.error("[admin/usuarios GET]", error);
    return apiError("Error al listar usuarios", 500);
  }
}
