/**
 * CitTokenTransaction — alias tipado de SfitCoin para las transacciones de tokens
 * del ciudadano (RF-15/16).
 *
 * El almacenamiento real se realiza en la colección `sfitcoins` a través del
 * modelo `SfitCoin`. Este módulo re-exporta ese modelo con el nombre esperado
 * por los endpoints de ciudadano, manteniendo una única fuente de verdad.
 */
import mongoose, { Schema, type Document, type Model } from "mongoose";

export type CitTokenTransactionType = "ganado" | "canjeado";

export interface ICitTokenTransaction extends Document {
  userId: mongoose.Types.ObjectId;
  type: CitTokenTransactionType;
  amount: number;
  reason: string;
  balance: number;
  rewardId?: mongoose.Types.ObjectId;
  createdAt: Date;
}

const CitTokenTransactionSchema = new Schema<ICitTokenTransaction>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    type: { type: String, enum: ["ganado", "canjeado"], required: true },
    amount: { type: Number, required: true },
    reason: { type: String, required: true, trim: true },
    balance: { type: Number, required: true, default: 0 },
    rewardId: { type: Schema.Types.ObjectId, ref: "Recompensa" },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

CitTokenTransactionSchema.index({ userId: 1, createdAt: -1 });

export const CitTokenTransaction: Model<ICitTokenTransaction> =
  (mongoose.models.CitTokenTransaction as Model<ICitTokenTransaction> | undefined) ||
  mongoose.model<ICitTokenTransaction>("CitTokenTransaction", CitTokenTransactionSchema);
