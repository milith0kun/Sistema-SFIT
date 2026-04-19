import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db/mongoose";
import { Trip } from "@/models/Trip";
import { apiResponse, apiError, apiUnauthorized, apiForbidden } from "@/lib/api/response";
import { requireRole } from "@/lib/auth/guard";
import { ROLES } from "@/lib/constants";

/**
 * POST /api/viajes/auto-close
 * Cierra automáticamente viajes en curso que superaron el tiempo máximo.
 * Pensado para ser llamado por un cron job o al listar viajes.
 * Roles: admin_municipal, admin_provincial, super_admin (o sistema interno).
 */
export async function POST(request: NextRequest) {
  const auth = requireRole(request, [ROLES.SUPER_ADMIN, ROLES.ADMIN_MUNICIPAL, ROLES.ADMIN_PROVINCIAL]);
  if ("error" in auth) return auth.error === "unauthorized" ? apiUnauthorized() : apiForbidden();

  try {
    await connectDB();

    // Cierra viajes que llevan más de 12 horas en curso
    const cutoff = new Date(Date.now() - 12 * 60 * 60 * 1000);

    const result = await Trip.updateMany(
      { status: "en_curso", startTime: { $lte: cutoff } },
      {
        $set: {
          status: "auto_cierre",
          endTime: new Date(),
          notes: "Cerrado automáticamente por superar 12 horas en curso",
        },
      },
    );

    return apiResponse({
      closed: result.modifiedCount,
      cutoffHours: 12,
      cutoffDate: cutoff.toISOString(),
    });
  } catch (error) {
    console.error("[viajes/auto-close POST]", error);
    return apiError("Error al ejecutar auto-cierre", 500);
  }
}
