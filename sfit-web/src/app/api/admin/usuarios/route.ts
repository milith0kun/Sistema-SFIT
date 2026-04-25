/**
 * POST /api/admin/usuarios — Crea un usuario desde el panel de administración.
 * Solo super_admin puede crear usuarios directamente.
 *
 * Body: { name, email, password, role, provinceId?, municipalityId? }
 *
 * GET /api/admin/usuarios — Lista usuarios según scope del admin autenticado.
 *
 * Filtros de scope:
 *   - super_admin       → todos los usuarios
 *   - admin_provincial  → usuarios de su provinceId
 *   - admin_municipal   → usuarios de su municipalityId
 */
import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { isValidObjectId } from "mongoose";
import { z } from "zod";
import { connectDB } from "@/lib/db/mongoose";
import { User } from "@/models/User";
import { signAccessToken, signRefreshToken } from "@/lib/auth/jwt";
import { apiResponse, apiError, apiUnauthorized, apiForbidden, apiValidationError } from "@/lib/api/response";
import { requireRole } from "@/lib/auth/guard";
import { ROLES } from "@/lib/constants";
import { logAction } from "@/lib/audit/logAction";

const ALLOWED_ROLES = [ROLES.SUPER_ADMIN, ROLES.ADMIN_PROVINCIAL, ROLES.ADMIN_MUNICIPAL];

// ── GET ──────────────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const auth = requireRole(request, ALLOWED_ROLES);
  if ("error" in auth) return auth.error === "unauthorized" ? apiUnauthorized() : apiForbidden();

  const { session } = auth;
  const url = new URL(request.url);

  const page  = Math.max(1, Number(url.searchParams.get("page")  ?? 1));
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit") ?? 20)));
  const roleFilter   = url.searchParams.get("role");
  const statusFilter = url.searchParams.get("status");

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

// ── POST ─────────────────────────────────────────────────────────────────────

const CreateSchema = z.object({
  name:           z.string().min(2).max(100).trim(),
  email:          z.string().email("Correo inválido").toLowerCase(),
  password:       z.string().min(8, "Mínimo 8 caracteres").max(128),
  role: z.enum([
    "super_admin", "admin_provincial", "admin_municipal",
    "fiscal", "operador", "conductor", "ciudadano",
  ]),
  provinceId:     z.string().refine(v => !v || isValidObjectId(v), "provinceId inválido").optional(),
  municipalityId: z.string().refine(v => !v || isValidObjectId(v), "municipalityId inválido").optional(),
  status:         z.enum(["activo", "pendiente"]).default("activo"),
});

export async function POST(request: NextRequest) {
  // Solo super_admin puede crear usuarios desde el panel
  const auth = requireRole(request, [ROLES.SUPER_ADMIN]);
  if ("error" in auth) return auth.error === "unauthorized" ? apiUnauthorized() : apiForbidden();

  let body: unknown;
  try { body = await request.json(); } catch { body = {}; }

  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) {
    const errors: Record<string, string[]> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0]?.toString() ?? "general";
      errors[key] = [...(errors[key] ?? []), issue.message];
    }
    return apiValidationError(errors);
  }

  const { name, email, password, role, provinceId, municipalityId, status } = parsed.data;

  try {
    await connectDB();

    const existing = await User.findOne({ email });
    if (existing) return apiError("El correo ya está registrado", 409);

    const hashedPassword = await bcrypt.hash(password, 12);

    const user = await User.create({
      name,
      email,
      password: hashedPassword,
      provider: "credentials",
      role,
      requestedRole: role,
      status,
      provinceId:     provinceId     || undefined,
      municipalityId: municipalityId || undefined,
    });

    // Generar tokens para que el admin pueda ver el ID y el usuario pueda hacer login inmediato
    const tokenPayload = {
      userId: user._id.toString(),
      role: user.role,
      municipalityId: user.municipalityId?.toString(),
      provinceId: user.provinceId?.toString(),
    };
    const accessToken  = signAccessToken(tokenPayload);
    const refreshToken = signRefreshToken(tokenPayload);
    const refreshExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await User.findByIdAndUpdate(user._id, {
      refreshToken,
      refreshTokenExpiry: refreshExpiry,
    });

    void logAction({
      userId: auth.session.userId,
      action: "create",
      resource: "user",
      resourceId: user._id.toString(),
      details: { createdRole: role, email, status },
      req: request,
      role: auth.session.role,
    });

    return apiResponse(
      {
        id:             user._id.toString(),
        name:           user.name,
        email:          user.email,
        role:           user.role,
        status:         user.status,
        municipalityId: user.municipalityId?.toString() ?? null,
        provinceId:     user.provinceId?.toString()     ?? null,
        accessToken,
      },
      201,
    );
  } catch (error) {
    console.error("[admin/usuarios POST]", error);
    return apiError("Error al crear usuario", 500);
  }
}
