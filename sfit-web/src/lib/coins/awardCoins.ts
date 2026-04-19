import mongoose from "mongoose";
import { SfitCoin } from "@/models/SfitCoin";

/**
 * Otorga SFITCoins a un usuario, calculando el nuevo balance acumulado.
 *
 * @param userId    ID del usuario (ciudadano)
 * @param amount    Cantidad de coins a otorgar (positivo)
 * @param reason    Razón de la transacción ('reporte_enviado', 'reporte_validado', etc.)
 * @param referenceId  ID opcional del reporte o recompensa asociada
 */
export async function awardCoins(
  userId: string,
  amount: number,
  reason: string,
  referenceId?: string,
): Promise<void> {
  try {
    if (!mongoose.Types.ObjectId.isValid(userId)) return;

    // Calcular balance actual
    const lastTx = await SfitCoin.findOne({ userId })
      .sort({ createdAt: -1 })
      .select("balance")
      .lean();

    const currentBalance = lastTx?.balance ?? 0;
    const newBalance = currentBalance + amount;

    await SfitCoin.create({
      userId,
      type: amount >= 0 ? "ganado" : "canjeado",
      amount,
      reason,
      referenceId: referenceId && mongoose.Types.ObjectId.isValid(referenceId)
        ? new mongoose.Types.ObjectId(referenceId)
        : undefined,
      balance: newBalance,
    });
  } catch (error) {
    // No bloquear el flujo principal si falla la asignación de coins
    console.error("[awardCoins] Error al otorgar coins:", error);
  }
}

/**
 * Obtiene el balance actual de SFITCoins de un usuario.
 */
export async function getBalance(userId: string): Promise<number> {
  if (!mongoose.Types.ObjectId.isValid(userId)) return 0;
  const lastTx = await SfitCoin.findOne({ userId })
    .sort({ createdAt: -1 })
    .select("balance")
    .lean();
  return lastTx?.balance ?? 0;
}

/**
 * Determina el nivel del usuario según su balance de SFITCoins.
 * 0–99    → Bronce  (1)
 * 100–499 → Plata   (2)
 * 500–1999→ Oro     (3)
 * 2000+   → Platino (4)
 */
export function getNivel(balance: number): { nivel: number; label: string } {
  if (balance >= 2000) return { nivel: 4, label: "Platino" };
  if (balance >= 500)  return { nivel: 3, label: "Oro" };
  if (balance >= 100)  return { nivel: 2, label: "Plata" };
  return { nivel: 1, label: "Bronce" };
}
