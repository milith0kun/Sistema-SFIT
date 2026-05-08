import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db/mongoose";
import { SfitCoin } from "@/models/SfitCoin";
import { Recompensa } from "@/models/Recompensa";
import { apiResponse, apiError, apiUnauthorized } from "@/lib/api/response";
import { requireAuth } from "@/lib/auth/guard";

/**
 * GET /api/ciudadano/recompensas/historial
 *
 * Historial de canjes del ciudadano autenticado. Lee las transacciones de
 * SfitCoin con `type: "canjeado"` y populeamos el nombre/descripción de la
 * Recompensa asociada cuando referenceId es ObjectId. Para canjes contra el
 * catálogo estático (sin referenceId) reusamos `reason` como label.
 */
export async function GET(request: NextRequest) {
  const session = requireAuth(request);
  if (!session) return apiUnauthorized();

  try {
    await connectDB();
    const url = new URL(request.url);
    const limit = Math.min(50, Math.max(1, Number(url.searchParams.get("limit") ?? 30)));

    const txs = await SfitCoin.find({
      userId: session.userId,
      type: "canjeado",
    })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    // Resolver nombres de recompensa en una sola query.
    const refIds = txs
      .map((t) => t.referenceId)
      .filter((id): id is NonNullable<typeof id> => Boolean(id));

    const rewards = refIds.length > 0
      ? await Recompensa.find({ _id: { $in: refIds } })
          .select("_id name category imageUrl")
          .lean()
      : [];
    const rewardById = new Map(rewards.map((r) => [String(r._id), r]));

    return apiResponse({
      items: txs.map((t) => {
        const refKey = t.referenceId ? String(t.referenceId) : null;
        const reward = refKey ? rewardById.get(refKey) : null;
        return {
          id: String(t._id),
          name: (reward as { name?: string } | null)?.name ?? "Recompensa",
          category: (reward as { category?: string } | null)?.category ?? null,
          imageUrl: (reward as { imageUrl?: string | null } | null)?.imageUrl ?? null,
          amount: Math.abs(t.amount),
          balanceAfter: t.balance,
          reason: t.reason,
          createdAt: t.createdAt,
        };
      }),
      total: txs.length,
    });
  } catch (error) {
    console.error("[ciudadano/recompensas/historial GET]", error);
    return apiError("Error al obtener historial de canjes", 500);
  }
}
