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
  lastInspectionDate?: Date;
  lastInspectionCertificate?: string;
  reputationScore: number;
  soatExpiry?: Date;
  soatInsurer?: string;
  soatCertificate?: string;
  /** Nombre del propietario registral (extraído de SUNARP). */
  ownerName?: string;
  citvExpiryDate?: Date;
  qrHmac?: string;
  /**
   * Foto referencial del vehículo (lateral o frontal). Aparece en el
   * escaneo del ciudadano cuando inicia un viaje interprovincial, en el
   * dashboard del admin_municipal y en los reportes del fiscalizador.
   * Se sube via POST /api/uploads/photos con category="vehicle".
   */
  photoUrl?: string;
  active: boolean;
  /**
   * Verificación administrativa del vehículo. Queda `false` al crearse; el
   * admin_municipal lo marca `true` desde el centro de aprobaciones tras
   * confirmar SOAT, revisión técnica y placa. Solo los vehículos verificados
   * pueden ser asignados a viajes (TripsEngine valida este flag).
   */
  verified: boolean;
  verifiedAt?: Date;
  verifiedBy?: mongoose.Types.ObjectId;
  scrapingStatus: "idle" | "pending" | "in_progress" | "complete" | "partial" | "error";
  scrapingRequestedAt?: Date;
  scrapingCompletedAt?: Date;
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
    lastInspectionDate: { type: Date },
    lastInspectionCertificate: { type: String, trim: true },
    reputationScore: { type: Number, default: 100, min: 0, max: 100 },
    soatExpiry: { type: Date },
    soatInsurer: { type: String, trim: true },
    soatCertificate: { type: String, trim: true },
    ownerName: { type: String, trim: true },
    citvExpiryDate: { type: Date },
    qrHmac: { type: String },
    photoUrl: { type: String, trim: true },
    active: { type: Boolean, default: true },
    verified: { type: Boolean, default: false, index: true },
    verifiedAt: { type: Date },
    verifiedBy: { type: Schema.Types.ObjectId, ref: "User" },
    scrapingStatus: {
      type: String,
      enum: ["idle", "pending", "in_progress", "complete", "partial", "error"],
      default: "idle",
      index: true,
    },
    scrapingRequestedAt: { type: Date },
    scrapingCompletedAt: { type: Date },
  },
  { timestamps: true },
);

// Placa única nacional (SUNARP) — solo entre vehículos activos.
// Vehículos soft-deleteados (active=false) no bloquean el re-registro.
VehicleSchema.index({ plate: 1 }, { unique: true, partialFilterExpression: { active: true } });
VehicleSchema.index({ municipalityId: 1, status: 1 });
VehicleSchema.index({ companyId: 1, status: 1 });
VehicleSchema.index({ municipalityId: 1, verified: 1 });

export const Vehicle: Model<IVehicle> =
  (mongoose.models.Vehicle as Model<IVehicle> | undefined) ||
  mongoose.model<IVehicle>("Vehicle", VehicleSchema);
