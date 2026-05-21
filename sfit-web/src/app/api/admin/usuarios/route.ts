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
import { Company } from "@/models/Company";
// Imports side-effect para el populate de municipalityId/provinceId.
// Sin estos imports, mongoose tira "Schema hasn't been registered for
// model 'Municipality' / 'Province'" en el dev server (HMR aísla caches).
import "@/models/Municipality";
import "@/models/Province";
import { signAccessToken, signRefreshToken } from "@/lib/auth/jwt";
import { apiResponse, apiError, apiUnauthorized, apiForbidden, apiValidationError } from "@/lib/api/response";
import { requireRole } from "@/lib/auth/guard";
import { ROLES } from "@/lib/constants";
import { logAction } from "@/lib/audit/logAction";
import { getActiveMunicipalityId } from "@/lib/scope-server";

const ALLOWED_ROLES = [ROLES.SUPER_ADMIN, ROLES.ADMIN_MUNICIPAL];
const ROLES_REQUIRE_IDENTITY = new Set([
  ROLES.SUPER_ADMIN,
  ROLES.ADMIN_MUNICIPAL,
  ROLES.CONDUCTOR,
  ROLES.OPERADOR,
  ROLES.FISCAL,
]);

// ── GET ──────────────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const auth = requireRole(request, ALLOWED_ROLES);
  if ("error" in auth) return auth.error === "unauthorized" ? apiUnauthorized() : apiForbidden();

  const { session } = auth;
  const url = new URL(request.url);

  const page  = Math.max(1, Number(url.searchParams.get("page")  ?? 1));
  // El panel `/usuarios` pide limit=200 para mostrar la grilla completa.
  // El cap a 100 dejaba truncada la lista cuando la muni superaba ese
  // número de cuentas; lo subimos a 500 — suficiente para los tamaños
  // operativos esperados y aún acotado para no abusar de la DB.
  const limit = Math.min(500, Math.max(1, Number(url.searchParams.get("limit") ?? 20)));
  const roleFilter   = url.searchParams.get("role");
  const statusFilter = url.searchParams.get("status");

  const filter: Record<string, unknown> = {};

  if (session.role === ROLES.ADMIN_MUNICIPAL) {
    if (!session.municipalityId) {
      return apiError("El admin municipal no tiene municipalidad asignada", 400);
    }
    // El sistema opera con UNA municipalidad institucional única (cleanup
    // municipal). El admin_municipal debe ver:
    //   - Usuarios con `municipalityId` igual al suyo (nuevos).
    //   - Usuarios SIN `municipalityId` (cuentas legacy de Google/registro
    //     antes del cleanup que aún no fueron tocadas). Estos también
    //     pertenecen implícitamente a la muni activa porque no existen
    //     otras munis institucionales que los reclamen.
    // Sin esto, el filtro estricto `municipalityId === session.muni` dejaba
    // fuera a la mayoría de usuarios legacy y el panel mostraba ~2-3.
    filter.$or = [
      { municipalityId: session.municipalityId },
      { municipalityId: null },
      { municipalityId: { $exists: false } },
    ];
  }
  // super_admin: sin filtro (ve todos los usuarios).

  const validRoles = Object.values(ROLES);
  if (roleFilter && validRoles.includes(roleFilter as typeof ROLES[keyof typeof ROLES])) {
    filter.role = roleFilter;
  }

  // admin_municipal nunca debe ver super_admins (no son parte de su jerarquía).
  // Aplicar después del roleFilter para que no se pueda saltar pidiendo
  // role=super_admin desde el cliente.
  if (session.role === ROLES.ADMIN_MUNICIPAL) {
    if (filter.role === ROLES.SUPER_ADMIN) {
      return apiResponse({ items: [], total: 0, page, limit });
    }
    if (!filter.role) {
      filter.role = { $ne: ROLES.SUPER_ADMIN };
    } else if (
      typeof filter.role === "object" &&
      filter.role !== null &&
      "$ne" in (filter.role as Record<string, unknown>)
    ) {
      const ne = (filter.role as { $ne?: string }).$ne;
      filter.role = { $ne: ne };
    }
  }

  const validStatuses = ["activo", "pendiente", "suspendido", "rechazado"];
  if (statusFilter && validStatuses.includes(statusFilter)) {
    filter.status = statusFilter;
  }

  try {
    await connectDB();

    const [items, total] = await Promise.all([
      User.find(filter)
        .select("name email role requestedRole requestMessage status municipalityId provinceId phone dni createdAt image")
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
        requestedRole: u.requestedRole,
        requestMessage: u.requestMessage,
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
    "super_admin", "admin_municipal",
    "fiscal", "operador", "conductor", "ciudadano",
  ]),
  companyId:      z.string().refine(v => !v || isValidObjectId(v), "companyId inválido").optional(),
  status:         z.enum(["activo", "pendiente"]).default("activo"),

  // Datos opcionales — si super_admin elige "completar perfil ahora"
  dni:                z.string().regex(/^\d{6,12}$/, "DNI inválido").optional(),
  phone:              z.string().min(7).max(30).optional(),
  // Flags de onboarding (se calculan: por default, password temporal + perfil incompleto)
  completeProfileNow: z.boolean().default(false),
  passwordIsTemporary: z.boolean().default(true),
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

  const {
    name, email, password, role, companyId, status,
    dni, phone, completeProfileNow, passwordIsTemporary,
  } = parsed.data;

  const normalizedDni = dni?.trim();
  const normalizedPhone = phone?.trim();

  const identityRequiredByRole = ROLES_REQUIRE_IDENTITY.has(role);

  if (identityRequiredByRole && !completeProfileNow) {
    return apiError("Para este rol, debe completar DNI y teléfono al crear la cuenta.", 422);
  }

  if (completeProfileNow || identityRequiredByRole) {
    if (!normalizedDni || !/^\d{6,12}$/.test(normalizedDni)) {
      return apiError("DNI inválido para el rol seleccionado.", 422);
    }
    if (!normalizedPhone || normalizedPhone.length < 7) {
      return apiError("Teléfono inválido para el rol seleccionado.", 422);
    }
  }

  try {
    await connectDB();

    // Todos los usuarios del sistema viven en la municipalidad institucional
    // activa (Tambobamba). No se acepta input — el flujo legacy multi-tenant
    // se eliminó en el cleanup municipal de mayo 2026.
    const activeMunicipalityId = await getActiveMunicipalityId();

    // Validación tenant para OPERADOR: exige companyId y que la empresa
    // pertenezca a la muni activa. Sin esto, la cuenta queda huérfana y
    // termina viendo datos de la competencia vía fallback.
    if (role === "operador") {
      if (!companyId) {
        return apiError(
          "El rol operador requiere asignar una empresa (companyId).",
          422,
        );
      }
      const company = await Company.findById(companyId)
        .select("municipalityId")
        .lean<{ municipalityId?: unknown } | null>();
      if (!company) {
        return apiError("La empresa asignada no existe.", 422);
      }
      if (String(company.municipalityId) !== String(activeMunicipalityId)) {
        return apiError(
          "La empresa asignada no pertenece a la municipalidad activa.",
          422,
        );
      }
    }

    const existing = await User.findOne({ email });
    if (existing) return apiError("El correo ya está registrado", 409);

    if (normalizedDni) {
      const dupDni = await User.findOne({ dni: normalizedDni });
      if (dupDni) return apiError("El DNI ya está registrado en otra cuenta", 409);
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    // Si el rol exige identidad o el admin marcó "completar perfil ahora"
    // (con DNI válido), el perfil queda completo desde el alta.
    const shouldCompleteProfileNow = completeProfileNow || identityRequiredByRole;
    const profileCompleted = shouldCompleteProfileNow && !!normalizedDni;

    const user = await User.create({
      name,
      email,
      password: hashedPassword,
      provider: "credentials",
      role,
      requestedRole: role,
      status,
      municipalityId: activeMunicipalityId,
      companyId:      companyId || undefined,
      dni:            normalizedDni   || undefined,
      phone:          normalizedPhone || undefined,
      profileCompleted,
      mustChangePassword: passwordIsTemporary,
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
