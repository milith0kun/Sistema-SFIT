import { NextRequest } from "next/server";
import { isValidObjectId } from "mongoose";
import { z } from "zod";
import { connectDB } from "@/lib/db/mongoose";
import { Recompensa } from "@/models/Recompensa";
import { apiResponse, apiError, apiUnauthorized } from "@/lib/api/response";
import { requireAuth } from "@/lib/auth/guard";
import { awardCoins, getBalance } from "@/lib/coins/awardCoins";

const RedeemSchema = z.object({
  recompensaId: z.string().refine(isValidObjectId, "ID inválido"),
});

/**
 * GET /api/ciudadano/recompensas
 * Lista el catálogo de recompensas activas.
 * Auth: cualquier rol.
 */
export async function GET(request: NextRequest) {
  const session = requireAuth(request);
  if (!session) return apiUnauthorized();

  try {
    await connectDB();

    const items = await Recompensa.find({ active: true })
      .sort({ cost: 1 })
      .lean();

    return apiResponse({
      items: items.map((r) => ({
        id: String(r._id),
        name: r.name,
        description: r.description,
        cost: r.cost,
        category: r.category,
        stock: r.stock,
        imageUrl: r.imageUrl,
      })),
    });
  } catch (error) {
    console.error("[ciudadano/recompensas GET]", error);
    return apiError("Error al listar recompensas", 500);
  }
}

/**
 * POST /api/ciudadano/recompensas
 * Canjea una recompensa descontando coins del usuario autenticado.
 * Body: { recompensaId: string }
 * Auth: cualquier rol.
 */
export async function POST(request: NextRequest) {
  const session = requireAuth(request);
  if (!session) return apiUnauthorized();

  try {
    const body = await request.json().catch(() => ({}));
    const parsed = RedeemSchema.safeParse(body);
    if (!parsed.success) {
      return apiError("recompensaId inválido", 400);
    }

    await connectDB();

    const recompensa = await Recompensa.findById(parsed.data.recompensaId);
    if (!recompensa || !recompensa.active) {
      return apiError("Recompensa no encontrada o inactiva", 404);
    }

    // Verificar stock
    if (recompensa.stock !== -1 && recompensa.stock <= 0) {
      return apiError("Recompensa sin stock disponible", 409);
    }

    // Verificar balance suficiente
    const currentBalance = await getBalance(session.userId);
    if (currentBalance < recompensa.cost) {
      return apiError(
        `Saldo insuficiente. Necesitas ${recompensa.cost} coins, tienes ${currentBalance}.`,
        422,
      );
    }

    // Descontar stock si no es ilimitado
    if (recompensa.stock !== -1) {
      recompensa.stock -= 1;
      await recompensa.save();
    }

    // Crear transacción negativa
    await awardCoins(
      session.userId,
      -recompensa.cost,
      "canje_recompensa",
      String(recompensa._id),
    );

    return apiResponse({
      message: "Canje exitoso",
      recompensa: {
        id: String(recompensa._id),
        name: recompensa.name,
        cost: recompensa.cost,
      },
      newBalance: currentBalance - recompensa.cost,
    });
  } catch (error) {
    console.error("[ciudadano/recompensas POST]", error);
    return apiError("Error al canjear recompensa", 500);
  }
}
