import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db/mongoose";
import { Trip } from "@/models/Trip";
import { User } from "@/models/User";
import { Notification } from "@/models/Notification";
import { apiResponse, apiError, apiUnauthorized, apiForbidden } from "@/lib/api/response";
import { requireRole } from "@/lib/auth/guard";
import { ROLES } from "@/lib/constants";

/**
 * RF-10-04: Auto-cierre de viajes vencidos.
 * POST /api/viajes/auto-close — requiere token interno o super_admin.
 *
 * Cierra automáticamente los viajes activos cuyo tiempo estimado
 * + margen (2 horas) haya expirado. Cuando un viaje no tiene
 * expectedReturnTime se aplica el límite histórico de 12 horas
 * desde startTime (comportamiento anterior).
 *
 * Auth:
 *   - Header X-Cron-Secret: <CRON_SECRET>  (cron job externo)
 *   - Bearer token con rol super_admin       (llamada manual desde el panel)
 */
export async function POST(request: NextRequest) {
  // ── Autenticación: cron secret O super_admin ─────────────────────────────
  const cronSecret = request.headers.get("x-cron-secret");
  const validCron =
    !!cronSecret &&
    !!process.env.CRON_SECRET &&
    cronSecret === process.env.CRON_SECRET;

  if (!validCron) {
    const auth = requireRole(request, [ROLES.SUPER_ADMIN]);
    if ("error" in auth) {
      return auth.error === "unauthorized" ? apiUnauthorized() : apiForbidden();
    }
  }

  try {
    await connectDB();

    const now = new Date();
    // Margen de 2 horas sobre el tiempo de retorno esperado
    const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);
    // Límite de seguridad: viajes sin expectedReturnTime que lleven más de 12 h
    const twelveHoursAgo = new Date(now.getTime() - 12 * 60 * 60 * 1000);

    // Busca viajes activos en ambos escenarios
    const viajesVencidos = await Trip.find({
      status: "en_curso",
      $or: [
        // Tiene tiempo de retorno esperado y ya expiró + 2 h de margen
        { expectedReturnTime: { $lte: twoHoursAgo } },
        // No tiene tiempo de retorno pero lleva más de 12 h corriendo
        { expectedReturnTime: { $exists: false }, startTime: { $lte: twelveHoursAgo } },
        { expectedReturnTime: null, startTime: { $lte: twelveHoursAgo } },
      ],
    })
      .select("_id municipalityId vehicleId driverId")
      .lean();

    if (viajesVencidos.length === 0) {
      return apiResponse({ closed: 0 });
    }

    const ids = viajesVencidos.map((t) => t._id);

    // Cierra todos en un solo updateMany
    await Trip.updateMany(
      { _id: { $in: ids } },
      {
        $set: {
          status: "cerrado_automatico",
          closedAt: now,
          endTime: now,
          autoClosedReason: "tiempo_excedido",
        },
      },
    );

    // ── Notificaciones a Operadores por cada municipio afectado ─────────────
    // Agrupa viajes por municipio para emitir una notificación por municipio
    const porMunicipio = new Map<string, number>();
    for (const viaje of viajesVencidos) {
      const mId = String(viaje.municipalityId);
      porMunicipio.set(mId, (porMunicipio.get(mId) ?? 0) + 1);
    }

    const notificacionesBulk: Array<{
      userId: unknown;
      title: string;
      body: string;
      type: string;
      category: string;
    }> = [];

    for (const [municipalityId, count] of porMunicipio.entries()) {
      // Obtiene todos los Operadores del municipio
      const operadores = await User.find(
        { municipalityId, role: ROLES.OPERADOR, status: "activo" },
        { _id: 1 },
      ).lean();

      for (const op of operadores) {
        notificacionesBulk.push({
          userId: op._id,
          title: "Auto-cierre de viajes",
          body:
            count === 1
              ? "1 viaje fue cerrado automáticamente por superar el tiempo estimado."
              : `${count} viajes fueron cerrados automáticamente por superar el tiempo estimado.`,
          type: "warning",
          category: "otro",
        });
      }
    }

    if (notificacionesBulk.length > 0) {
      await Notification.insertMany(notificacionesBulk);
    }

    return apiResponse({ closed: viajesVencidos.length });
  } catch (error) {
    console.error("[viajes/auto-close POST]", error);
    return apiError("Error al ejecutar auto-cierre", 500);
  }
}
