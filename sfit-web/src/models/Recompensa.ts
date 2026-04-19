import mongoose, { Schema, type Document, type Model } from "mongoose";

export type RecompensaCategory = "descuento" | "beneficio" | "certificado" | "otro";

export interface IRecompensa extends Document {
  name: string;
  description: string;
  cost: number; // en SFITCoins
  category: RecompensaCategory;
  stock: number; // -1 = ilimitado
  active: boolean;
  imageUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}

const RecompensaSchema = new Schema<IRecompensa>(
  {
    name: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, required: true, trim: true, maxlength: 2000 },
    cost: { type: Number, required: true, min: 1 },
    category: {
      type: String,
      enum: ["descuento", "beneficio", "certificado", "otro"],
      required: true,
    },
    stock: { type: Number, required: true, default: -1 }, // -1 = ilimitado
    active: { type: Boolean, required: true, default: true },
    imageUrl: { type: String, trim: true },
  },
  { timestamps: true },
);

RecompensaSchema.index({ active: 1, cost: 1 });

export const Recompensa: Model<IRecompensa> =
  (mongoose.models.Recompensa as Model<IRecompensa> | undefined) ||
  mongoose.model<IRecompensa>("Recompensa", RecompensaSchema);
