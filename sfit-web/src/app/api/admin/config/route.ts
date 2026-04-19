import { NextRequest } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/db/mongoose";
import { Municipality } from "@/models/Municipality";
import { apiResponse, apiError, apiForbidden, apiUnauthorized } from "@/lib/api/response";
import { requireRole } from "@/lib/auth/guard";
import { ROLES } from "@/lib/constants";

const DEFAULT_CONFIG = {
  horasMaxConduccion: 8,
  limiteInspecciones: 100,
  alertaFatigaHoras: 4,
  notificacionesActivas: true,
};

const ConfigSchema = z.object({
  horasMaxConduccion: z.number().min(4).max(12).optional(),
  limiteInspecciones: z.number().min(1).optional(),
  alertaFatigaHoras: z.number().min(1).max(12).optional(),
  notificacionesActivas: z.boolean().optional(),
});

/**
 * GET /api/admin/config
 * Devuelve la configuración del municipio actual.
 * Acceso: admin_municipal+.
 */
export async function GET(request: NextRequest) {
  const auth = requireRole(request, [
    ROLES.ADMIN_MUNICIPAL,
    ROLES.ADMIN_PROVINCIAL,
    ROLES.SUPER_ADMIN,
  ]);
  if ("error" in auth) {
    return auth.error === "unauthorized" ? apiUnauthorized() : apiForbidden();
  }

  const { session } = auth;
  if (!session.municipalityId) {
    return apiForbidden("Se requiere municipalidad");
  }

  try {
    await connectDB();
    const muni = await Municipality.findById(session.municipalityId).lean();
    if (!muni) return apiError("Municipalidad no encontrada", 404);

    return apiResponse({
      ...(DEFAULT_CONFIG),
      ...(muni.config ?? {}),
    });
  } catch (error) {
    console.error("[admin/config GET]", error);
    return apiError("Error al obtener configuración", 500);
  }
}

/**
 * PATCH /api/admin/config
 * Actualiza la configuración del municipio actual.
 * Acceso: admin_municipal+.
 */
export async function PATCH(request: NextRequest) {
  const auth = requireRole(request, [
    ROLES.ADMIN_MUNICIPAL,
    ROLES.ADMIN_PROVINCIAL,
    ROLES.SUPER_ADMIN,
  ]);
  if ("error" in auth) {
    return auth.error === "unauthorized" ? apiUnauthorized() : apiForbidden();
  }

  const { session } = auth;
  if (!session.municipalityId) {
    return apiForbidden("Se requiere municipalidad");
  }

  let body: unknown;
  try { body = await request.json(); } catch { body = {}; }

  const parsed = ConfigSchema.safeParse(body);
  if (!parsed.success) {
    const first = parsed.error.issues[0]?.message ?? "Datos inválidos";
    return apiError(first, 422);
  }

  if (Object.keys(parsed.data).length === 0) {
    return apiError("No se proporcionaron campos para actualizar", 400);
  }

  try {
    await connectDB();

    // Construir $set parcial sobre el subdocumento config
    const setFields: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(parsed.data)) {
      if (v !== undefined) setFields[`config.${k}`] = v;
    }

    const updated = await Municipality.findByIdAndUpdate(
      session.municipalityId,
      { $set: setFields },
      { new: true, runValidators: true },
    ).lean();

    if (!updated) return apiError("Municipalidad no encontrada", 404);

    return apiResponse({
      ...(DEFAULT_CONFIG),
      ...(updated.config ?? {}),
    });
  } catch (error) {
    console.error("[admin/config PATCH]", error);
    return apiError("Error al guardar configuración", 500);
  }
}
