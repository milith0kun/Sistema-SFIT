import mongoose, { Schema, type Document, type Model } from "mongoose";
import { VEHICLE_STATUS } from "@/lib/constants";

export interface IVehicle extends Omit<Document, "model"> {
  municipalityId: mongoose.Types.ObjectId;
  companyId?: mongoose.Types.ObjectId;
  plate: string;
  vehicleTypeKey: string;
  brand: string;
  model: string;
  year: number;
  status: "disponible" | "en_ruta" | "en_mantenimiento" | "fuera_de_servicio";
  currentDriverId?: mongoose.Types.ObjectId;
  lastInspectionStatus?: "aprobada" | "observada" | "rechazada" | "pendiente";
  reputationScore: number;
  soatExpiry?: Date;
  qrHmac?: string;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const VehicleSchema = new Schema<IVehicle>(
  {
    municipalityId: { type: Schema.Types.ObjectId, ref: "Municipality", required: true, index: true },
    companyId: { type: Schema.Types.ObjectId, ref: "Company", index: true },
    plate: { type: String, required: true, trim: true, uppercase: true },
    vehicleTypeKey: { type: String, required: true, trim: true },
    brand: { type: String, required: true, trim: true },
    model: { type: String, required: true, trim: true },
    year: { type: Number, required: true },
    status: { type: String, enum: Object.values(VEHICLE_STATUS), default: VEHICLE_STATUS.DISPONIBLE },
    currentDriverId: { type: Schema.Types.ObjectId, ref: "Driver" },
    lastInspectionStatus: {
      type: String,
      enum: ["aprobada", "observada", "rechazada", "pendiente"],
      default: "pendiente",
    },
    reputationScore: { type: Number, default: 100, min: 0, max: 100 },
    soatExpiry: { type: Date },
    qrHmac: { type: String },
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
);

VehicleSchema.index({ municipalityId: 1, plate: 1 }, { unique: true });
VehicleSchema.index({ municipalityId: 1, status: 1 });

export const Vehicle: Model<IVehicle> =
  (mongoose.models.Vehicle as Model<IVehicle> | undefined) ||
  mongoose.model<IVehicle>("Vehicle", VehicleSchema);
