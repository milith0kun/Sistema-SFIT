/**
 * GET  /api/auth/perfil  — Datos del usuario autenticado.
 * PATCH /api/auth/perfil — Actualizar nombre, teléfono o DNI propios.
 *
 * El usuario solo puede modificar sus datos básicos. Rol, status y
 * municipalityId son inmutables desde aquí.
 */
import { NextRequest } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/db/mongoose";
import { User } from "@/models/User";
import {
  apiResponse,
  apiError,
  apiUnauthorized,
  apiNotFound,
  apiValidationError,
} from "@/lib/api/response";
import { requireAuth } from "@/lib/auth/guard";
import { logAudit } from "@/lib/audit/log";

const PatchSchema = z
  .object({
    name:  z.string().min(2).max(100).trim().optional(),
    phone: z.string().max(20).trim().nullable().optional(),
    dni:   z.string().length(8).regex(/^\d{8}$/, "DNI debe tener 8 dígitos").nullable().optional(),
  })
  .refine(
    (d) => d.name !== undefined || d.phone !== undefined || d.dni !== undefined,
    { message: "Especifica al menos un campo a actualizar" }
  );

export async function GET(request: NextRequest) {
  const session = requireAuth(request);
  if (!session) return apiUnauthorized();

  try {
    await connectDB();
    const user = await User.findById(session.userId)
      .select("name email role status phone dni image municipalityId provinceId createdAt")
      .lean();

    if (!user) return apiNotFound("Usuario no encontrado");

    return apiResponse({
      id:             String(user._id),
      name:           user.name,
      email:          user.email,
      role:           user.role,
      status:         user.status,
      phone:          user.phone ?? null,
      dni:            user.dni   ?? null,
      image:          user.image ?? null,
      municipalityId: user.municipalityId ? String(user.municipalityId) : null,
      provinceId:     user.provinceId     ? String(user.provinceId)     : null,
      createdAt:      user.createdAt,
    });
  } catch (err) {
    console.error("[auth/perfil GET]", err);
    return apiError("Error al obtener perfil", 500);
  }
}

export async function PATCH(request: NextRequest) {
  const session = requireAuth(request);
  if (!session) return apiUnauthorized();

  try {
    const body = await request.json().catch(() => ({}));
    const parsed = PatchSchema.safeParse(body);

    if (!parsed.success) {
      const errors: Record<string, string[]> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0]?.toString() ?? "general";
        errors[key] = [...(errors[key] ?? []), issue.message];
      }
      return apiValidationError(errors);
    }

    await connectDB();

    const update: Record<string, unknown> = {};
    if (parsed.data.name  !== undefined) update.name  = parsed.data.name;
    if (parsed.data.phone !== undefined) update.phone = parsed.data.phone;
    if (parsed.data.dni   !== undefined) update.dni   = parsed.data.dni;

    const updated = await User.findByIdAndUpdate(
      session.userId,
      { $set: update },
      { new: true, select: "name email role status phone dni image municipalityId provinceId" }
    ).lean();

    if (!updated) return apiNotFound("Usuario no encontrado");

    await logAudit(request, session, {
      action:       "user.update_perfil",
      resourceType: "user",
      resourceId:   session.userId,
      metadata:     { fields: Object.keys(update) },
    });

    return apiResponse({
      id:     String(updated._id),
      name:   updated.name,
      email:  updated.email,
      role:   updated.role,
      status: updated.status,
      phone:  updated.phone  ?? null,
      dni:    updated.dni    ?? null,
    });
  } catch (err) {
    console.error("[auth/perfil PATCH]", err);
    return apiError("Error al actualizar perfil", 500);
  }
}
