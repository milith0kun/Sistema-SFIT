import { NextRequest } from "next/server";
import { isValidObjectId } from "mongoose";
import { z } from "zod";
import { connectDB } from "@/lib/db/mongoose";
import { User } from "@/models/User";
import { Municipality } from "@/models/Municipality";
import {
  apiResponse,
  apiError,
  apiForbidden,
  apiNotFound,
  apiUnauthorized,
  apiValidationError,
} from "@/lib/api/response";
import { requireRole } from "@/lib/auth/guard";
import { ROLES, USER_STATUS, type Role } from "@/lib/constants";
import { createNotification } from "@/lib/notifications/create";
import { logAudit } from "@/lib/audit/log";

const UpdateUserSchema = z.object({
  role: z
    .enum([
      ROLES.SUPER_ADMIN,
      ROLES.ADMIN_PROVINCIAL,
      ROLES.ADMIN_MUNICIPAL,
      ROLES.FISCAL,
      ROLES.OPERADOR,
      ROLES.CONDUCTOR,
      ROLES.CIUDADANO,
    ] as [Role, ...Role[]])
    .optional(),
  status: z
    .enum([
      USER_STATUS.PENDIENTE,
      USER_STATUS.ACTIVO,
      USER_STATUS.RECHAZADO,
      USER_STATUS.SUSPENDIDO,
    ])
    .optional(),
  municipalityId: z
    .string()
    .refine(isValidObjectId, "municipalityId inválido")
    .optional(),
  provinceId: z
    .string()
    .refine(isValidObjectId, "provinceId inválido")
    .optional(),
  rejectionReason: z.string().max(500).optional(),
});

/**
 * Roles operativos gestionables por un admin_municipal.
 */
const OPERATIVE_ROLES: Role[] = [
  ROLES.FISCAL,
  ROLES.OPERADOR,
  ROLES.CONDUCTOR,
  ROLES.CIUDADANO,
];

/**
 * GET — detalle del usuario.
 */
export async function GET(
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
    if (!isValidObjectId(id)) return apiError("ID inválido", 400);

    await connectDB();

    const user = await User.findById(id)
      .select(
        "name email image provider role requestedRole status rejectionReason municipalityId provinceId phone dni lastLoginAt createdAt updatedAt",
      )
      .lean<{
        _id: unknown;
        name: string;
        email: string;
        image?: string;
        provider: string;
        role: string;
        requestedRole?: string;
        status: string;
        rejectionReason?: string;
        municipalityId?: unknown;
        provinceId?: unknown;
        phone?: string;
        dni?: string;
        lastLoginAt?: Date;
        createdAt: Date;
        updatedAt: Date;
      } | null>();

    if (!user) return apiNotFound("Usuario no encontrado");

    // Scope check
    if (auth.session.role === ROLES.ADMIN_MUNICIPAL) {
      if (
        !user.municipalityId ||
        String(user.municipalityId) !== String(auth.session.municipalityId)
      ) {
        return apiForbidden();
      }
    } else if (auth.session.role === ROLES.ADMIN_PROVINCIAL) {
      const sameProvince =
        user.provinceId &&
        String(user.provinceId) === String(auth.session.provinceId);
      let sameMuniProvince = false;
      if (user.municipalityId) {
        const muni = await Municipality.findById(String(user.municipalityId))
          .select("provinceId")
          .lean<{ provinceId?: unknown } | null>();
        sameMuniProvince =
          !!muni?.provinceId &&
          String(muni.provinceId) === String(auth.session.provinceId);
      }
      if (!sameProvince && !sameMuniProvince) return apiForbidden();
    }

    return apiResponse({
      id: String(user._id),
      name: user.name,
      email: user.email,
      image: user.image,
      provider: user.provider,
      role: user.role,
      requestedRole: user.requestedRole,
      status: user.status,
      rejectionReason: user.rejectionReason,
      municipalityId: user.municipalityId?.toString(),
      provinceId: user.provinceId?.toString(),
      phone: user.phone,
      dni: user.dni,
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    });
  } catch (error) {
    console.error("[admin/users/:id GET]", error);
    return apiError("Error al obtener usuario", 500);
  }
}

/**
 * PATCH — actualiza rol/estado/tenant.
 * Reglas:
 *   - Solo super_admin puede asignar super_admin / admin_provincial.
 *   - admin_provincial puede aprobar admin_municipal dentro de su provincia.
 *   - admin_municipal puede aprobar roles operativos en su municipalidad.
 *   - Cambios a activo / rechazado → notificación al usuario.
 *   - Toda actualización genera AuditLog.
 */
export async function PATCH(
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
    if (!isValidObjectId(id)) return apiError("ID inválido", 400);

    const body = await request.json().catch(() => ({}));
    const parsed = UpdateUserSchema.safeParse(body);
    if (!parsed.success) {
      const errors: Record<string, string[]> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0]?.toString() ?? "general";
        errors[key] = [...(errors[key] ?? []), issue.message];
      }
      return apiValidationError(errors);
    }

    await connectDB();

    const target = await User.findById(id);
    if (!target) return apiNotFound("Usuario no encontrado");

    const actorRole = auth.session.role;
    const prevRole = target.role as Role;
    const prevStatus = target.status;

    // --- Scope: verificar que el actor puede operar sobre el target ---
    if (actorRole === ROLES.ADMIN_MUNICIPAL) {
      if (
        !target.municipalityId ||
        String(target.municipalityId) !== String(auth.session.municipalityId)
      ) {
        return apiForbidden();
      }
    } else if (actorRole === ROLES.ADMIN_PROVINCIAL) {
      const sameProvince =
        target.provinceId &&
        String(target.provinceId) === String(auth.session.provinceId);
      let sameMuniProvince = false;
      if (target.municipalityId) {
        const muni = await Municipality.findById(
          String(target.municipalityId),
        )
          .select("provinceId")
          .lean<{ provinceId?: unknown } | null>();
        sameMuniProvince =
          !!muni?.provinceId &&
          String(muni.provinceId) === String(auth.session.provinceId);
      }
      if (!sameProvince && !sameMuniProvince) return apiForbidden();
    }

    // --- Reglas por rol para asignaciones ---
    if (parsed.data.role) {
      const newRole = parsed.data.role;

      if (
        newRole === ROLES.SUPER_ADMIN ||
        newRole === ROLES.ADMIN_PROVINCIAL
      ) {
        if (actorRole !== ROLES.SUPER_ADMIN) return apiForbidden();
      } else if (newRole === ROLES.ADMIN_MUNICIPAL) {
        if (
          actorRole !== ROLES.SUPER_ADMIN &&
          actorRole !== ROLES.ADMIN_PROVINCIAL
        ) {
          return apiForbidden();
        }
      } else if (OPERATIVE_ROLES.includes(newRole)) {
        // cualquiera de los tres admins puede asignar roles operativos
        // dentro de su scope (ya validado arriba).
      }
    }

    // --- Aplicar cambios ---
    if (parsed.data.role !== undefined) target.role = parsed.data.role;
    if (parsed.data.status !== undefined) target.status = parsed.data.status;
    if (parsed.data.municipalityId !== undefined) {
      target.set("municipalityId", parsed.data.municipalityId);
    }
    if (parsed.data.provinceId !== undefined) {
      target.set("provinceId", parsed.data.provinceId);
    }
    if (parsed.data.rejectionReason !== undefined) {
      target.rejectionReason = parsed.data.rejectionReason;
    }

    // Al aprobar, limpiar requestedRole
    if (
      parsed.data.status === USER_STATUS.ACTIVO &&
      target.requestedRole
    ) {
      target.requestedRole = undefined;
    }

    await target.save();

    // --- Notificación (RF-01-05) ---
    const statusChanged =
      parsed.data.status && parsed.data.status !== prevStatus;

    if (statusChanged && parsed.data.status === USER_STATUS.ACTIVO) {
      await createNotification({
        userId: target._id.toString(),
        title: "Tu solicitud fue aprobada",
        body: `Bienvenido a SFIT. Tu cuenta está activa con el rol de ${target.role}.`,
        type: "success",
        category: "aprobacion",
      });
    } else if (
      statusChanged &&
      parsed.data.status === USER_STATUS.RECHAZADO
    ) {
      await createNotification({
        userId: target._id.toString(),
        title: "Tu solicitud fue rechazada",
        body:
          target.rejectionReason ||
          "Tu solicitud de acceso no fue aprobada. Contacta al administrador para más información.",
        type: "error",
        category: "aprobacion",
      });
    } else if (
      statusChanged &&
      parsed.data.status === USER_STATUS.SUSPENDIDO
    ) {
      await createNotification({
        userId: target._id.toString(),
        title: "Tu cuenta fue suspendida",
        body: "Comunícate con el administrador de tu municipalidad.",
        type: "warning",
        category: "aprobacion",
      });
    }

    // --- Auditoría (RNF-16) ---
    let auditAction = "user.updated";
    if (statusChanged) {
      if (parsed.data.status === USER_STATUS.ACTIVO) {
        auditAction = "user.approved";
      } else if (parsed.data.status === USER_STATUS.RECHAZADO) {
        auditAction = "user.rejected";
      } else if (parsed.data.status === USER_STATUS.SUSPENDIDO) {
        auditAction = "user.suspended";
      }
    } else if (parsed.data.role && parsed.data.role !== prevRole) {
      auditAction = "user.role_changed";
    }

    await logAudit(request, auth.session, {
      action: auditAction,
      resourceType: "user",
      resourceId: target._id.toString(),
      metadata: {
        prevRole,
        newRole: target.role,
        prevStatus,
        newStatus: target.status,
        rejectionReason: parsed.data.rejectionReason,
      },
    });

    return apiResponse({
      id: target._id.toString(),
      name: target.name,
      email: target.email,
      role: target.role,
      status: target.status,
      municipalityId: target.municipalityId?.toString(),
      provinceId: target.provinceId?.toString(),
      rejectionReason: target.rejectionReason,
      updatedAt: target.updatedAt,
    });
  } catch (error) {
    console.error("[admin/users/:id PATCH]", error);
    return apiError("Error al actualizar usuario", 500);
  }
}
