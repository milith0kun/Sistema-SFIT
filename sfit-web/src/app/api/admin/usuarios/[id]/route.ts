/**
 * PATCH /api/admin/usuarios/[id] — Actualizar datos de un usuario.
 *
 * Restricciones:
 *   - admin_municipal NO puede asignar super_admin.
 *   - password solo editable por super_admin (solo cuentas credentials).
 *   - Campos permitidos: status, role, name, email, phone, dni, companyId, password,
 *     rejectionReason. La ubicación (region/province/municipality) NO es
 *     editable — el sistema opera sobre una única muni institucional y se
 *     asigna automáticamente al crear/aprobar al usuario.
 */
import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { isValidObjectId } from "mongoose";
import { z } from "zod";
import { connectDB } from "@/lib/db/mongoose";
import { User } from "@/models/User";
import { Company } from "@/models/Company";
import "@/models/Municipality";
import "@/models/Province";
import "@/models/Region";
import { apiResponse, apiError, apiUnauthorized, apiForbidden, apiNotFound } from "@/lib/api/response";
import { requireRole } from "@/lib/auth/guard";
import { canAccessMunicipality } from "@/lib/auth/rbac";
import { ROLES, type Role } from "@/lib/constants";
import { logAction } from "@/lib/audit/logAction";
import { createNotification } from "@/lib/notifications/create";
import { sendEmail } from "@/lib/email/email_service";
import { accountRejectedEmailHtml, accountApprovedEmailHtml } from "@/lib/email/templates";
import { getActiveMunicipalityId } from "@/lib/scope-server";

const ALLOWED_ROLES = [ROLES.SUPER_ADMIN, ROLES.ADMIN_MUNICIPAL];

/**
 * Roles que cada actor puede asignar al aprobar/editar. Espejo de la matriz
 * que tenía /api/users/[id]/approve antes de la unificación.
 */
const ROLES_ASSIGNABLE_BY: Record<string, Role[]> = {
  [ROLES.SUPER_ADMIN]:     [ROLES.CIUDADANO, ROLES.CONDUCTOR, ROLES.OPERADOR, ROLES.FISCAL, ROLES.ADMIN_MUNICIPAL, ROLES.SUPER_ADMIN],
  [ROLES.ADMIN_MUNICIPAL]: [ROLES.CIUDADANO, ROLES.CONDUCTOR, ROLES.OPERADOR, ROLES.FISCAL],
};

const PatchSchema = z.object({
  status: z.enum(["activo", "pendiente", "suspendido", "rechazado"]).optional(),
  role: z.enum([
    "super_admin", "admin_municipal",
    "fiscal", "operador", "conductor", "ciudadano",
  ]).optional(),
  name: z.string().min(2, "El nombre debe tener al menos 2 caracteres").max(100).trim().optional(),
  email: z.string().email("Correo inválido").toLowerCase().optional(),
  phone: z.string().max(20).trim().nullable().optional(),
  dni: z.string().max(20).trim().nullable().optional(),
  companyId: z.string().nullable().optional(),
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres").max(128).optional(),
  rejectionReason: z.string().trim().min(5, "El motivo debe tener al menos 5 caracteres").max(500).optional(),
}).refine(
  (d) =>
    d.status !== undefined || d.role !== undefined ||
    d.name !== undefined || d.email !== undefined || d.phone !== undefined ||
    d.dni !== undefined || d.companyId !== undefined ||
    d.password !== undefined ||
    d.rejectionReason !== undefined,
  { message: "Se debe especificar al menos un campo a actualizar" },
);

// ── GET /api/admin/usuarios/[id] ─────────────────────────────────────────────
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requireRole(request, ALLOWED_ROLES);
  if ("error" in auth) return auth.error === "unauthorized" ? apiUnauthorized() : apiForbidden();

  const { session } = auth;
  const { id } = await params;

  if (!isValidObjectId(id)) return apiError("ID de usuario inválido", 400);

  try {
    await connectDB();

    const user = await User.findById(id)
      .select("name email role status municipalityId provinceId regionId phone dni companyId createdAt image provider")
      .populate("municipalityId", "name")
      .populate("provinceId", "name")
      .populate("regionId", "name")
      .lean();

    if (!user) return apiNotFound("Usuario no encontrado");

    // Extraer _id del populate (lean devuelve el objeto populado, no el ObjectId crudo)
    const muni = user.municipalityId as unknown as { _id: string; name: string } | null;
    const prov = user.provinceId     as unknown as { _id: string; name: string } | null;
    const reg  = user.regionId       as unknown as { _id: string; name: string } | null;

    // Scope: admin_municipal ve usuarios de su muni + usuarios sin muni
    // asignada (cuentas legacy del cleanup municipal — el sistema opera
    // sobre UNA municipalidad institucional, así que esos usuarios son
    // implícitamente suyos). Sin esto, hacer click en un usuario legacy
    // desde el listado devolvía 403 y la UI mostraba "Usuario no encontrado".
    if (session.role === ROLES.ADMIN_MUNICIPAL) {
      const userMuniId = muni ? String(muni._id) : null;
      if (
        userMuniId !== null &&
        session.municipalityId &&
        userMuniId !== String(session.municipalityId)
      ) {
        return apiForbidden();
      }
    }

    return apiResponse({
      id:               String(user._id),
      name:             user.name,
      email:            user.email,
      role:             user.role,
      status:           user.status,
      phone:            user.phone  ?? null,
      dni:              user.dni    ?? null,
      image:            user.image  ?? null,
      provider:         user.provider,
      companyId:        user.companyId ? String(user.companyId) : null,
      municipalityId:   muni ? String(muni._id) : null,
      municipalityName: muni?.name ?? null,
      provinceId:       prov ? String(prov._id) : null,
      provinceName:     prov?.name ?? null,
      regionId:         reg ? String(reg._id) : null,
      regionName:       reg?.name ?? null,
      createdAt:        user.createdAt,
    });
  } catch (err) {
    console.error("[admin/usuarios GET single]", err);
    return apiError("Error al obtener usuario", 500);
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requireRole(request, ALLOWED_ROLES);
  if ("error" in auth) return auth.error === "unauthorized" ? apiUnauthorized() : apiForbidden();

  const { session } = auth;
  const { id } = await params;

  if (!isValidObjectId(id)) {
    return apiError("ID de usuario inválido", 400);
  }

  let body: unknown;
  try { body = await request.json(); } catch { body = {}; }

  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) {
    const first = parsed.error.issues[0]?.message ?? "Datos inválidos";
    return apiError(first, 422);
  }

  const { status, role, name, email, phone, dni, companyId, password, rejectionReason } = parsed.data;

  // ── Protecciones de escalada de privilegios ───────────────────────────────
  if (password !== undefined && session.role !== ROLES.SUPER_ADMIN) {
    return apiForbidden("Solo el super admin puede restablecer contraseñas");
  }
  // Quien intenta asignar un rol debe tenerlo permitido por la matriz.
  if (role !== undefined) {
    const allowed = ROLES_ASSIGNABLE_BY[session.role] ?? [];
    if (!allowed.includes(role as Role)) {
      return apiForbidden(`No tienes permiso para asignar el rol ${role}`);
    }
  }
  // Rechazar requiere motivo (RF-01-04).
  if (status === "rechazado" && !rejectionReason) {
    return apiError("Debes indicar el motivo del rechazo", 422);
  }

  if (companyId && companyId !== "" && !isValidObjectId(companyId)) {
    return apiError("companyId inválido", 400);
  }

  try {
    await connectDB();

    const target = await User.findById(id).lean();
    if (!target) return apiNotFound("Usuario no encontrado");

    const previousStatus = target.status;
    const previousRole = target.role as Role;

    // admin_municipal nunca puede tocar usuarios super_admin.
    if (session.role !== ROLES.SUPER_ADMIN) {
      if (target.role === "super_admin") {
        return apiForbidden("No puede modificar usuarios super_admin");
      }
    }

    // Muni institucional única. Si el usuario aún no la tiene (cuenta vieja o
    // creada por flujo Google antes del cleanup), la asignamos en este patch.
    const activeMunicipalityId = await getActiveMunicipalityId();

    // Aislamiento por tenant: usar canAccessMunicipality. Si el usuario no
    // tiene `municipalityId` (cuenta legacy), el admin_municipal sí puede
    // tocarlo — el PATCH abajo le inyecta la muni activa, así queda
    // normalizado a la única muni institucional del sistema.
    if (target.municipalityId) {
      const allowed = await canAccessMunicipality(session, String(target.municipalityId));
      if (!allowed) return apiForbidden("El usuario no pertenece a su jurisdicción");
    }

    // DNI único nacional: si cambia respecto al actual, verificar que no esté
    // tomado por otra cuenta. Si no se valida acá el índice unique fallaría
    // con error de Mongo crudo en el findByIdAndUpdate de abajo.
    if (dni !== undefined && dni && dni !== (target.dni ?? null)) {
      const dup = await User.findOne({ dni, _id: { $ne: id } })
        .select("_id")
        .lean<{ _id: unknown } | null>();
      if (dup) {
        return apiError("El DNI ya está registrado en otra cuenta", 409);
      }
    }

    if (email !== undefined && email !== target.email) {
      const dupEmail = await User.findOne({ email, _id: { $ne: id } })
        .select("_id")
        .lean<{ _id: unknown } | null>();
      if (dupEmail) {
        return apiError("El correo ya está registrado en otra cuenta", 409);
      }
    }

    // Construir actualización
    const update: Record<string, unknown> = {};
    if (status        !== undefined) update.status = status;
    if (role          !== undefined) update.role   = role;
    if (name          !== undefined) update.name   = name;
    if (email         !== undefined) update.email  = email;
    if (phone         !== undefined) update.phone  = phone ?? undefined;
    if (dni           !== undefined) update.dni    = dni   ?? undefined;
    if (companyId !== undefined) {
      update.companyId = companyId && companyId !== "" ? companyId : null;
    }
    if (password) {
      update.password = await bcrypt.hash(password, 12);
    }
    if (rejectionReason !== undefined) {
      update.rejectionReason = rejectionReason;
    }
    // Backfill de muni institucional para cuentas que la tengan vacía. El
    // hook pre-save de User deriva province/region desde aquí.
    if (!target.municipalityId) {
      update.municipalityId = activeMunicipalityId;
    }
    // Al aprobar limpiamos el flag de "requestedRole" porque ya tomó decisión.
    if (status === "activo" && previousStatus === "pendiente") {
      update.requestedRole = undefined;
    }

    // ── Validación tenant para OPERADOR ─────────────────────────────────────
    // Si el resultado final del usuario va a ser rol=operador, exigir que
    // tenga companyId asignado y que la empresa pertenezca a la muni activa.
    const finalRole = (update.role ?? target.role) as Role;
    if (finalRole === ROLES.OPERADOR) {
      const finalCompanyId =
        update.companyId !== undefined
          ? (update.companyId as string | null)
          : (target.companyId ? String(target.companyId) : null);

      if (!finalCompanyId) {
        return apiError(
          "El rol operador requiere asignar una empresa (companyId).",
          422,
        );
      }
      const company = await Company.findById(finalCompanyId)
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

    // Si el admin cambió el rol del usuario, invalidamos toda sesión activa:
    // borramos el refreshToken e incrementamos sessionVersion. El próximo
    // request del cliente obtendrá 401 SESSION_INVALIDATED y se forzará
    // logout, evitando que el JWT viejo (con rol antiguo) siga vivo hasta
    // las 2 h de expiración natural y produzca loops o accesos cruzados.
    const roleChanged = role !== undefined && role !== previousRole;
    const mongoUpdate: Record<string, unknown> = { $set: update };
    if (roleChanged) {
      mongoUpdate.$inc = { sessionVersion: 1 };
      mongoUpdate.$unset = {
        refreshToken: "",
        refreshTokenExpiry: "",
      };
    }

    const updated = await User.findByIdAndUpdate(
      id,
      mongoUpdate,
      { returnDocument: "after", runValidators: true }
    )
      .select("name email role status municipalityId provinceId regionId phone dni companyId rejectionReason createdAt image")
      .populate("municipalityId", "name")
      .populate("provinceId", "name")
      .populate("regionId", "name")
      .lean();

    if (!updated) return apiNotFound("Usuario no encontrado");

    const statusChanged = status !== undefined && status !== previousStatus;

    // RF-18: notificación + email cuando cambia el status (aprobación/rechazo/suspensión).
    // Best-effort: si fallan no rompemos la respuesta.
    if (statusChanged) {
      if (status === "activo") {
        void sendEmail(
          updated.email,
          "[SFIT] Su solicitud fue aprobada",
          accountApprovedEmailHtml({ userName: updated.name, role: updated.role }),
        ).catch(() => {});
        void createNotification({
          userId: String(updated._id),
          title: "Su solicitud fue aprobada",
          body: `Bienvenido a SFIT. Su cuenta está activa con el rol de ${updated.role}.`,
          type: "success",
          category: "aprobacion",
        }).catch(() => {});
      } else if (status === "rechazado") {
        void sendEmail(
          updated.email,
          "[SFIT] Su solicitud fue rechazada",
          accountRejectedEmailHtml({ userName: updated.name }),
        ).catch(() => {});
        void createNotification({
          userId: String(updated._id),
          title: "Su solicitud fue rechazada",
          body: rejectionReason ?? "Su solicitud de acceso no fue aprobada.",
          type: "error",
          category: "aprobacion",
        }).catch(() => {});
      } else if (status === "suspendido") {
        void createNotification({
          userId: String(updated._id),
          title: "Su cuenta fue suspendida",
          body: "Comunícate con el administrador de su municipalidad.",
          type: "warning",
          category: "aprobacion",
        }).catch(() => {});
      }
    }

    // Audit log — no-bloqueante
    void logAction({
      userId: session.userId,
      action: statusChanged
        ? (status === "activo" ? "user.approved"
          : status === "rechazado" ? "user.rejected"
          : status === "suspendido" ? "user.suspended"
          : "user.status_changed")
        : (role && role !== previousRole ? "user.role_changed" : "user.updated"),
      resource: "user",
      resourceId: id,
      details: { status, role, prevStatus: previousStatus, prevRole: previousRole, rejectionReason },
      req: request,
      municipalityId: session.municipalityId,
      role: session.role,
    });

    return apiResponse({
      id: String(updated._id),
      name: updated.name,
      email: updated.email,
      role: updated.role,
      status: updated.status,
      phone: updated.phone ?? null,
      dni: updated.dni ?? null,
      companyId: updated.companyId ? String(updated.companyId) : null,
      municipality: updated.municipalityId as unknown as { _id: string; name: string } | null,
      province: updated.provinceId as unknown as { _id: string; name: string } | null,
      region: updated.regionId as unknown as { _id: string; name: string } | null,
      rejectionReason: updated.rejectionReason ?? null,
      createdAt: updated.createdAt,
      image: updated.image ?? null,
    });
  } catch (error) {
    console.error("[admin/usuarios PATCH]", error);
    return apiError("Error al actualizar usuario", 500);
  }
}

// ── DELETE /api/admin/usuarios/[id] ─────────────────────────────────────────
// Reglas de eliminación:
//   - super_admin: puede eliminar cualquier usuario (con la salvaguarda de
//     no eliminar al último super_admin del sistema).
//   - admin_municipal: solo puede eliminar a los 4 roles móviles dentro de
//     SU municipalidad: fiscal, operador, conductor, ciudadano. Intentar
//     eliminar a otro admin_municipal o a un super_admin devuelve 403.
//   - Nadie puede eliminarse a sí mismo.
const DELETABLE_BY_ADMIN_MUNICIPAL: readonly string[] = [
  ROLES.FISCAL,
  ROLES.OPERADOR,
  ROLES.CONDUCTOR,
  ROLES.CIUDADANO,
];

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requireRole(request, [ROLES.SUPER_ADMIN, ROLES.ADMIN_MUNICIPAL]);
  if ("error" in auth) return auth.error === "unauthorized" ? apiUnauthorized() : apiForbidden();

  const { session } = auth;
  const { id } = await params;

  if (!isValidObjectId(id)) return apiError("ID de usuario inválido", 400);

  if (id === session.userId) {
    return apiForbidden("No puedes eliminar tu propio usuario");
  }

  try {
    await connectDB();

    const target = await User.findById(id).lean();
    if (!target) return apiNotFound("Usuario no encontrado");

    // Gate por rol del actor.
    if (session.role === ROLES.ADMIN_MUNICIPAL) {
      // admin_municipal solo puede eliminar roles móviles.
      if (!DELETABLE_BY_ADMIN_MUNICIPAL.includes(target.role)) {
        return apiForbidden(
          "Solo el super administrador puede eliminar a otros administradores.",
        );
      }
      // Y solo dentro de su propia municipalidad — no debe poder borrar
      // usuarios de otra muni aunque la matriz se lo permita.
      if (!session.municipalityId) {
        return apiForbidden("No tienes municipalidad asignada.");
      }
      if (
        !target.municipalityId ||
        String(target.municipalityId) !== String(session.municipalityId)
      ) {
        return apiForbidden("El usuario no pertenece a tu municipalidad.");
      }
    }

    if (target.role === "super_admin") {
      const remainingSuperAdmins = await User.countDocuments({
        role: "super_admin",
        _id: { $ne: id },
      });
      if (remainingSuperAdmins === 0) {
        return apiForbidden("No se puede eliminar al último super_admin del sistema");
      }
    }

    await User.findByIdAndDelete(id);

    void logAction({
      userId: session.userId,
      action: "delete",
      resource: "user",
      resourceId: id,
      details: { deletedRole: target.role, deletedEmail: target.email },
      req: request,
      role: session.role,
    });

    return apiResponse({ deleted: true });
  } catch (error) {
    console.error("[admin/usuarios DELETE]", error);
    return apiError("Error al eliminar usuario", 500);
  }
}
