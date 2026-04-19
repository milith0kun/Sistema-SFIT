/**
 * PATCH /api/admin/usuarios/[id] — Actualizar status o role de un usuario.
 *
 * Restricciones:
 *   - admin_municipal NO puede editar ni crear super_admin ni admin_provincial.
 *   - admin_provincial NO puede editar super_admin.
 *   - Campos permitidos: status, role.
 */
import { NextRequest } from "next/server";
import { isValidObjectId } from "mongoose";
import { z } from "zod";
import { connectDB } from "@/lib/db/mongoose";
import { User } from "@/models/User";
import { apiResponse, apiError, apiUnauthorized, apiForbidden, apiNotFound } from "@/lib/api/response";
import { requireRole } from "@/lib/auth/guard";
import { ROLES } from "@/lib/constants";

const ALLOWED_ROLES = [ROLES.SUPER_ADMIN, ROLES.ADMIN_PROVINCIAL, ROLES.ADMIN_MUNICIPAL];

const PatchSchema = z.object({
  status: z.enum(["activo", "pendiente", "suspendido", "rechazado"]).optional(),
  role: z.enum([
    "super_admin", "admin_provincial", "admin_municipal",
    "fiscal", "operador", "conductor", "ciudadano",
  ]).optional(),
}).refine((d) => d.status !== undefined || d.role !== undefined, {
  message: "Se debe especificar al menos 'status' o 'role'",
});

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

  const { status, role } = parsed.data;

  // ── Protecciones de escalada de privilegios ───────────────────────────────
  // admin_municipal no puede asignar roles por encima de su nivel
  if (session.role === ROLES.ADMIN_MUNICIPAL) {
    if (role && (role === "super_admin" || role === "admin_provincial")) {
      return apiForbidden("No puede asignar roles de admin provincial o superior");
    }
  }

  // admin_provincial no puede asignar super_admin
  if (session.role === ROLES.ADMIN_PROVINCIAL) {
    if (role && role === "super_admin") {
      return apiForbidden("No puede asignar el rol super_admin");
    }
  }

  try {
    await connectDB();

    const target = await User.findById(id).lean();
    if (!target) return apiNotFound("Usuario no encontrado");

    // admin_municipal no puede modificar usuarios de rango superior
    if (session.role === ROLES.ADMIN_MUNICIPAL) {
      if (target.role === "super_admin" || target.role === "admin_provincial") {
        return apiForbidden("No puede modificar usuarios de rango superior");
      }
      // Debe pertenecer a su municipio
      if (
        session.municipalityId &&
        String(target.municipalityId) !== String(session.municipalityId)
      ) {
        return apiForbidden("El usuario no pertenece a su municipio");
      }
    }

    // admin_provincial no puede modificar super_admin
    if (session.role === ROLES.ADMIN_PROVINCIAL) {
      if (target.role === "super_admin") {
        return apiForbidden("No puede modificar usuarios super_admin");
      }
      // Debe pertenecer a su provincia
      if (
        session.provinceId &&
        String(target.provinceId) !== String(session.provinceId)
      ) {
        return apiForbidden("El usuario no pertenece a su provincia");
      }
    }

    // Construir actualización
    const update: Record<string, unknown> = {};
    if (status !== undefined) update.status = status;
    if (role   !== undefined) update.role   = role;

    const updated = await User.findByIdAndUpdate(
      id,
      { $set: update },
      { new: true, runValidators: true }
    )
      .select("name email role status municipalityId provinceId createdAt image")
      .populate("municipalityId", "name")
      .populate("provinceId", "name")
      .lean();

    if (!updated) return apiNotFound("Usuario no encontrado");

    return apiResponse({
      id: String(updated._id),
      name: updated.name,
      email: updated.email,
      role: updated.role,
      status: updated.status,
      municipality: updated.municipalityId as unknown as { _id: string; name: string } | null,
      province: updated.provinceId as unknown as { _id: string; name: string } | null,
      createdAt: updated.createdAt,
      image: updated.image ?? null,
    });
  } catch (error) {
    console.error("[admin/usuarios PATCH]", error);
    return apiError("Error al actualizar usuario", 500);
  }
}
