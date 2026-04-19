import mongoose, { Schema, type Document, type Model } from "mongoose";

export type SfitCoinType = "ganado" | "canjeado";

export interface ISfitCoin extends Document {
  userId: mongoose.Types.ObjectId;
  type: SfitCoinType;
  amount: number; // positivo = ganado, negativo = canjeado
  reason: string; // 'reporte_validado' | 'reporte_enviado' | 'canje_recompensa' | etc.
  referenceId?: mongoose.Types.ObjectId; // ID del reporte o recompensa asociada
  balance: number; // balance acumulado después de esta transacción
  createdAt: Date;
}

const SfitCoinSchema = new Schema<ISfitCoin>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    type: {
      type: String,
      enum: ["ganado", "canjeado"],
      required: true,
    },
    amount: { type: Number, required: true },
    reason: { type: String, required: true, trim: true },
    referenceId: { type: Schema.Types.ObjectId },
    balance: { type: Number, required: true, default: 0 },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

SfitCoinSchema.index({ userId: 1, createdAt: -1 });

export const SfitCoin: Model<ISfitCoin> =
  (mongoose.models.SfitCoin as Model<ISfitCoin> | undefined) ||
  mongoose.model<ISfitCoin>("SfitCoin", SfitCoinSchema);
