/**
 * PATCH /api/admin/usuarios/[id] — Actualizar datos de un usuario.
 *
 * Restricciones:
 *   - admin_municipal NO puede asignar super_admin ni admin_provincial.
 *   - admin_provincial NO puede asignar super_admin.
 *   - municipalityId y provinceId solo editables por super_admin.
 *   - password solo editable por super_admin (solo cuentas credentials).
 *   - Campos permitidos: status, role, name, phone, dni, municipalityId, provinceId, password.
 */
import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { isValidObjectId } from "mongoose";
import { z } from "zod";
import { connectDB } from "@/lib/db/mongoose";
import { User } from "@/models/User";
import "@/models/Municipality";
import "@/models/Province";
import { apiResponse, apiError, apiUnauthorized, apiForbidden, apiNotFound } from "@/lib/api/response";
import { requireRole } from "@/lib/auth/guard";
import { canAccessMunicipality } from "@/lib/auth/rbac";
import { ROLES, type Role } from "@/lib/constants";
import { logAction } from "@/lib/audit/logAction";
import { createNotification } from "@/lib/notifications/create";
import { sendEmail } from "@/lib/email/email_service";
import { accountRejectedEmailHtml, accountApprovedEmailHtml } from "@/lib/email/templates";

const ALLOWED_ROLES = [ROLES.SUPER_ADMIN, ROLES.ADMIN_PROVINCIAL, ROLES.ADMIN_MUNICIPAL];

/**
 * Roles que cada actor puede asignar al aprobar/editar. Espejo de la matriz
 * que tenía /api/users/[id]/approve antes de la unificación.
 */
const ROLES_ASSIGNABLE_BY: Record<string, Role[]> = {
  [ROLES.SUPER_ADMIN]:      [ROLES.CIUDADANO, ROLES.CONDUCTOR, ROLES.OPERADOR, ROLES.FISCAL, ROLES.ADMIN_MUNICIPAL, ROLES.ADMIN_PROVINCIAL, ROLES.SUPER_ADMIN],
  [ROLES.ADMIN_PROVINCIAL]: [ROLES.CIUDADANO, ROLES.CONDUCTOR, ROLES.OPERADOR, ROLES.FISCAL, ROLES.ADMIN_MUNICIPAL],
  [ROLES.ADMIN_MUNICIPAL]:  [ROLES.CIUDADANO, ROLES.CONDUCTOR, ROLES.OPERADOR, ROLES.FISCAL],
};

const PatchSchema = z.object({
  status: z.enum(["activo", "pendiente", "suspendido", "rechazado"]).optional(),
  role: z.enum([
    "super_admin", "admin_provincial", "admin_municipal",
    "fiscal", "operador", "conductor", "ciudadano",
  ]).optional(),
  name: z.string().min(2, "El nombre debe tener al menos 2 caracteres").max(100).trim().optional(),
  phone: z.string().max(20).trim().nullable().optional(),
  dni: z.string().max(20).trim().nullable().optional(),
  municipalityId: z.string().nullable().optional(),
  provinceId: z.string().nullable().optional(),
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres").max(128).optional(),
  rejectionReason: z.string().trim().min(5, "El motivo debe tener al menos 5 caracteres").max(500).optional(),
}).refine(
  (d) =>
    d.status !== undefined || d.role !== undefined ||
    d.name !== undefined || d.phone !== undefined ||
    d.dni !== undefined || d.municipalityId !== undefined ||
    d.provinceId !== undefined || d.password !== undefined ||
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
      .select("name email role status municipalityId provinceId phone dni createdAt image provider")
      .populate("municipalityId", "name")
      .populate("provinceId", "name")
      .lean();

    if (!user) return apiNotFound("Usuario no encontrado");

    // Extraer _id del populate (lean devuelve el objeto populado, no el ObjectId crudo)
    const muni = user.municipalityId as unknown as { _id: string; name: string } | null;
    const prov = user.provinceId     as unknown as { _id: string; name: string } | null;

    // Scope: admin_municipal solo ve usuarios de su muni
    if (session.role === ROLES.ADMIN_MUNICIPAL) {
      const userMuniId = muni ? String(muni._id) : null;
      if (session.municipalityId && userMuniId !== String(session.municipalityId)) {
        return apiForbidden();
      }
    }
    // Scope: admin_provincial solo ve usuarios de su provincia
    if (session.role === ROLES.ADMIN_PROVINCIAL) {
      const userProvId = prov ? String(prov._id) : null;
      if (session.provinceId && userProvId !== String(session.provinceId)) {
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
      municipalityId:   muni ? String(muni._id) : null,
      municipalityName: muni?.name ?? null,
      provinceId:       prov ? String(prov._id) : null,
      provinceName:     prov?.name ?? null,
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

  const { status, role, name, phone, dni, municipalityId, provinceId, password, rejectionReason } = parsed.data;

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
  if (session.role !== ROLES.SUPER_ADMIN && (municipalityId !== undefined || provinceId !== undefined)) {
    return apiForbidden("Solo el super admin puede reasignar municipio o provincia");
  }
  // Rechazar requiere motivo (RF-01-04).
  if (status === "rechazado" && !rejectionReason) {
    return apiError("Debes indicar el motivo del rechazo", 422);
  }

  // Validar ObjectIds de municipio/provincia si se envían
  if (municipalityId && municipalityId !== "" && !isValidObjectId(municipalityId)) {
    return apiError("municipalityId inválido", 400);
  }
  if (provinceId && provinceId !== "" && !isValidObjectId(provinceId)) {
    return apiError("provinceId inválido", 400);
  }

  try {
    await connectDB();

    const target = await User.findById(id).lean();
    if (!target) return apiNotFound("Usuario no encontrado");

    const previousStatus = target.status;
    const previousRole = target.role as Role;

    // admin_municipal y admin_provincial nunca pueden tocar usuarios de rango superior.
    if (session.role !== ROLES.SUPER_ADMIN) {
      if (target.role === "super_admin") {
        return apiForbidden("No puede modificar usuarios super_admin");
      }
      if (session.role === ROLES.ADMIN_MUNICIPAL && target.role === "admin_provincial") {
        return apiForbidden("No puede modificar usuarios de rango superior");
      }
    }

    // Aislamiento por tenant: usar canAccessMunicipality (cubre el caso
    // admin_provincial → muni de su provincia con resolución muni→province).
    if (target.municipalityId) {
      const allowed = await canAccessMunicipality(session, String(target.municipalityId));
      if (!allowed) return apiForbidden("El usuario no pertenece a su jurisdicción");
    } else if (
      session.role === ROLES.ADMIN_PROVINCIAL &&
      target.provinceId &&
      String(target.provinceId) !== String(session.provinceId)
    ) {
      return apiForbidden("El usuario no pertenece a su provincia");
    } else if (session.role === ROLES.ADMIN_MUNICIPAL && !target.municipalityId) {
      return apiForbidden("El usuario no pertenece a su municipio");
    }

    // Construir actualización
    const update: Record<string, unknown> = {};
    if (status        !== undefined) update.status = status;
    if (role          !== undefined) update.role   = role;
    if (name          !== undefined) update.name   = name;
    if (phone         !== undefined) update.phone  = phone ?? undefined;
    if (dni           !== undefined) update.dni    = dni   ?? undefined;
    if (municipalityId !== undefined) {
      update.municipalityId = municipalityId && municipalityId !== "" ? municipalityId : null;
    }
    if (provinceId !== undefined) {
      update.provinceId = provinceId && provinceId !== "" ? provinceId : null;
    }
    if (password) {
      update.password = await bcrypt.hash(password, 12);
    }
    if (rejectionReason !== undefined) {
      update.rejectionReason = rejectionReason;
    }
    // Al aprobar limpiamos el flag de "requestedRole" porque ya tomó decisión.
    if (status === "activo" && previousStatus === "pendiente") {
      update.requestedRole = undefined;
    }

    const updated = await User.findByIdAndUpdate(
      id,
      { $set: update },
      { returnDocument: "after", runValidators: true }
    )
      .select("name email role status municipalityId provinceId phone dni rejectionReason createdAt image")
      .populate("municipalityId", "name")
      .populate("provinceId", "name")
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
      municipality: updated.municipalityId as unknown as { _id: string; name: string } | null,
      province: updated.provinceId as unknown as { _id: string; name: string } | null,
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
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requireRole(request, [ROLES.SUPER_ADMIN]);
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
