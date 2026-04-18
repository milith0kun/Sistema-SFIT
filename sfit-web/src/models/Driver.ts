import mongoose, { Schema, type Document, type Model } from "mongoose";
import { DRIVER_STATUS } from "@/lib/constants";

export interface IDriver extends Document {
  municipalityId: mongoose.Types.ObjectId;
  companyId?: mongoose.Types.ObjectId;
  name: string;
  dni: string;
  licenseNumber: string;
  licenseCategory: string;
  phone?: string;
  status: "apto" | "riesgo" | "no_apto";
  continuousHours: number;
  restHours: number;
  reputationScore: number;
  currentVehicleId?: mongoose.Types.ObjectId;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const DriverSchema = new Schema<IDriver>(
  {
    municipalityId: { type: Schema.Types.ObjectId, ref: "Municipality", required: true, index: true },
    companyId: { type: Schema.Types.ObjectId, ref: "Company", index: true },
    name: { type: String, required: true, trim: true },
    dni: { type: String, required: true, trim: true },
    licenseNumber: { type: String, required: true, trim: true },
    licenseCategory: { type: String, required: true, trim: true, default: "A-IIB" },
    phone: { type: String, trim: true },
    status: { type: String, enum: Object.values(DRIVER_STATUS), default: DRIVER_STATUS.APTO },
    continuousHours: { type: Number, default: 0, min: 0 },
    restHours: { type: Number, default: 8, min: 0 },
    reputationScore: { type: Number, default: 100, min: 0, max: 100 },
    currentVehicleId: { type: Schema.Types.ObjectId, ref: "Vehicle" },
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
);

DriverSchema.index({ municipalityId: 1, dni: 1 }, { unique: true });
DriverSchema.index({ municipalityId: 1, status: 1 });

export const Driver: Model<IDriver> =
  (mongoose.models.Driver as Model<IDriver> | undefined) ||
  mongoose.model<IDriver>("Driver", DriverSchema);
