import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db/mongoose";
import { SfitCoin } from "@/models/SfitCoin";
import { apiResponse, apiError, apiUnauthorized } from "@/lib/api/response";
import { requireAuth } from "@/lib/auth/guard";
import { getNivel } from "@/lib/coins/awardCoins";

/**
 * GET /api/ciudadano/coins
 * Devuelve el balance, nivel y últimas 20 transacciones del usuario autenticado.
 * Auth: cualquier rol.
 */
export async function GET(request: NextRequest) {
  const session = requireAuth(request);
  if (!session) return apiUnauthorized();

  try {
    await connectDB();

    const transactions = await SfitCoin.find({ userId: session.userId })
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();

    const balance = transactions.length > 0 ? (transactions[0].balance ?? 0) : 0;
    const { nivel } = getNivel(balance);

    return apiResponse({
      balance,
      nivel,
      transactions: transactions.map((tx) => ({
        id: String(tx._id),
        type: tx.type,
        amount: tx.amount,
        reason: tx.reason,
        balance: tx.balance,
        referenceId: tx.referenceId ? String(tx.referenceId) : undefined,
        createdAt: tx.createdAt,
      })),
    });
  } catch (error) {
    console.error("[ciudadano/coins GET]", error);
    return apiError("Error al obtener balance", 500);
  }
}
