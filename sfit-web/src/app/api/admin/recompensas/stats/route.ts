import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db/mongoose";
import { SfitCoin } from "@/models/SfitCoin";
import { Recompensa } from "@/models/Recompensa";
import { apiResponse, apiError, apiForbidden, apiUnauthorized } from "@/lib/api/response";
import { requireRole } from "@/lib/auth/guard";
import { ROLES } from "@/lib/constants";

const ALLOWED = [ROLES.SUPER_ADMIN, ROLES.ADMIN_MUNICIPAL];

/**
 * GET /api/admin/recompensas/stats
 * Devuelve KPIs del sistema de gamificación.
 */
export async function GET(request: NextRequest) {
  const auth = requireRole(request, ALLOWED);
  if ("error" in auth) return auth.error === "unauthorized" ? apiUnauthorized() : apiForbidden();

  try {
    await connectDB();

    const [totalCanjesAgg, coinsAgg, usuariosAgg, recompensasActivas] = await Promise.all([
      // Total de canjes (transacciones de tipo 'canjeado')
      SfitCoin.countDocuments({ type: "canjeado" }),

      // Suma de todos los coins ganados (positivos)
      SfitCoin.aggregate([
        { $match: { type: "ganado" } },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ]),

      // Usuarios únicos que tienen al menos una transacción
      SfitCoin.distinct("userId"),

      // Recompensas activas
      Recompensa.countDocuments({ active: true }),
    ]);

    const coinsEnCirculacion = (coinsAgg[0]?.total as number | undefined) ?? 0;

    return apiResponse({
      totalCanjes: totalCanjesAgg,
      coinsEnCirculacion,
      usuariosConCoins: usuariosAgg.length,
      recompensasActivas,
    });
  } catch (error) {
    console.error("[admin/recompensas/stats GET]", error);
    return apiError("Error al obtener estadísticas", 500);
  }
}
