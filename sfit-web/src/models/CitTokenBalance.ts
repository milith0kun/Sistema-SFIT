/**
 * CitTokenBalance — balance acumulado de SFITCoins por usuario.
 *
 * En este proyecto el balance se deriva de la última transacción en SfitCoin.
 * Este modelo existe como vista materializada opcional para consultas rápidas.
 * Si requiere el balance actual de un usuario, usa `getBalance(userId)` de
 * `@/lib/coins/awardCoins`.
 */
import mongoose, { Schema, type Document, type Model } from "mongoose";

export interface ICitTokenBalance extends Document {
  userId: mongoose.Types.ObjectId;
  municipalityId?: mongoose.Types.ObjectId;
  balance: number;
  nivel: number; // 1=Bronce, 2=Plata, 3=Oro, 4=Platino
  updatedAt: Date;
}

const CitTokenBalanceSchema = new Schema<ICitTokenBalance>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true, index: true },
    municipalityId: { type: Schema.Types.ObjectId, ref: "Municipality" },
    balance: { type: Number, required: true, default: 0 },
    nivel: { type: Number, required: true, default: 1, min: 1, max: 4 },
  },
  { timestamps: { createdAt: false, updatedAt: true } },
);

export const CitTokenBalance: Model<ICitTokenBalance> =
  (mongoose.models.CitTokenBalance as Model<ICitTokenBalance> | undefined) ||
  mongoose.model<ICitTokenBalance>("CitTokenBalance", CitTokenBalanceSchema);
