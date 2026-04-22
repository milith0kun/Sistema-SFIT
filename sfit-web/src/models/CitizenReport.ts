import mongoose, { Schema, type Document, type Model } from "mongoose";

export interface IFraudLayer {
  layer: string;
  passed: boolean;
  detail: string;
}

export interface ICitizenReport extends Document {
  municipalityId: mongoose.Types.ObjectId;
  vehicleId?: mongoose.Types.ObjectId;
  citizenId?: mongoose.Types.ObjectId;
  category: string;
  vehicleTypeKey?: string;
  citizenReputationLevel: number;
  status: "pendiente" | "revision" | "validado" | "rechazado";
  description: string;
  evidenceUrl?: string;
  fraudScore: number;
  fraudLayers: IFraudLayer[];
  assignedFiscalId?: mongoose.Types.ObjectId;
  /** RF-12-04: indica que el QR del vehículo fue verificado con HMAC válido */
  qrVerified?: boolean;
  /** Coordenadas opcionales del ciudadano al momento de enviar el reporte (capa 2 anti-fraude geográfico) */
  latitude?: number;
  longitude?: number;
  createdAt: Date;
  updatedAt: Date;
}

const FraudLayerSchema = new Schema<IFraudLayer>(
  {
    layer: { type: String, required: true },
    passed: { type: Boolean, required: true },
    detail: { type: String, required: true },
  },
  { _id: false },
);

const CitizenReportSchema = new Schema<ICitizenReport>(
  {
    municipalityId: { type: Schema.Types.ObjectId, ref: "Municipality", required: true, index: true },
    vehicleId: { type: Schema.Types.ObjectId, ref: "Vehicle" },
    citizenId: { type: Schema.Types.ObjectId, ref: "User" },
    category: { type: String, required: true, trim: true },
    vehicleTypeKey: { type: String },
    citizenReputationLevel: { type: Number, default: 1, min: 1, max: 5 },
    status: {
      type: String,
      enum: ["pendiente", "revision", "validado", "rechazado"],
      default: "pendiente",
    },
    description: { type: String, required: true },
    evidenceUrl: { type: String },
    fraudScore: { type: Number, default: 50, min: 0, max: 100 },
    fraudLayers: { type: [FraudLayerSchema], default: [] },
    assignedFiscalId: { type: Schema.Types.ObjectId, ref: "User" },
    qrVerified: { type: Boolean, default: false }, // RF-12-04
    latitude: { type: Number },
    longitude: { type: Number },
  },
  { timestamps: true },
);

CitizenReportSchema.index({ municipalityId: 1, status: 1, createdAt: -1 });
CitizenReportSchema.index({ municipalityId: 1, vehicleId: 1 });

export const CitizenReport: Model<ICitizenReport> =
  (mongoose.models.CitizenReport as Model<ICitizenReport> | undefined) ||
  mongoose.model<ICitizenReport>("CitizenReport", CitizenReportSchema);
