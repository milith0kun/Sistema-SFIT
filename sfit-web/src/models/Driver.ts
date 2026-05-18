import mongoose, { Schema, type Document, type Model } from "mongoose";
import { DRIVER_STATUS } from "@/lib/constants";

export interface IDriver extends Document {
  municipalityId: mongoose.Types.ObjectId;
  userId?: mongoose.Types.ObjectId;
  companyId?: mongoose.Types.ObjectId;
  name: string;
  dni: string;
  licenseNumber: string;
  licenseCategory: string;
  /**
   * Fecha de emisión de la licencia (MTC). Opcional porque los conductores
   * que migran desde flujos legacy no necesariamente la traen — se completa
   * en la siguiente edición desde el panel admin o desde el onboarding.
   */
  licenseIssuedAt?: Date;
  /**
   * Fecha de vencimiento de la licencia. Crítica para validar que un
   * conductor pueda operar: TripsEngine y la asignación a rutas la
   * consultan. Si está vacía la licencia se trata como "sin fecha"
   * (warning visible) — no se bloquea hasta capturarla.
   */
  licenseExpiryDate?: Date;
  phone?: string;
  /**
   * Foto referencial del conductor (subida via POST /api/uploads/photos
   * con category="driver"). Aparece en el escaneo del ciudadano cuando
   * inicia un viaje interprovincial, en el dashboard del admin_municipal
   * y en los reportes del fiscalizador.
   */
  photoUrl?: string;
  status: "apto" | "riesgo" | "no_apto";
  continuousHours: number;
  restHours: number;
  reputationScore: number;
  currentVehicleId?: mongoose.Types.ObjectId;
  /** Última ruta operada por el conductor — usada para sugerir al iniciar turno. */
  lastRouteId?: mongoose.Types.ObjectId;
  active: boolean;
  /**
   * Verificación administrativa del conductor. Al crearse queda `false`;
   * el admin_municipal lo marca `true` desde el centro de aprobaciones tras
   * revisar licencia, antecedentes y fotos. Solo los conductores verificados
   * pueden ser asignados a viajes (TripsEngine valida este flag).
   */
  verified: boolean;
  verifiedAt?: Date;
  verifiedBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const DriverSchema = new Schema<IDriver>(
  {
    municipalityId: { type: Schema.Types.ObjectId, ref: "Municipality", required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", index: true, sparse: true },
    companyId: { type: Schema.Types.ObjectId, ref: "Company", index: true },
    name: { type: String, required: true, trim: true },
    dni: { type: String, required: true, trim: true },
    licenseNumber: { type: String, required: true, trim: true },
    licenseCategory: { type: String, required: true, trim: true, default: "A-IIB" },
    licenseIssuedAt: { type: Date },
    licenseExpiryDate: { type: Date },
    phone: { type: String, trim: true },
    photoUrl: { type: String, trim: true },
    status: { type: String, enum: Object.values(DRIVER_STATUS), default: DRIVER_STATUS.APTO },
    continuousHours: { type: Number, default: 0, min: 0 },
    restHours: { type: Number, default: 8, min: 0 },
    reputationScore: { type: Number, default: 100, min: 0, max: 100 },
    currentVehicleId: { type: Schema.Types.ObjectId, ref: "Vehicle" },
    lastRouteId: { type: Schema.Types.ObjectId, ref: "Route" },
    active: { type: Boolean, default: true },
    verified: { type: Boolean, default: false, index: true },
    verifiedAt: { type: Date },
    verifiedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true },
);

// DNI único nacional (RENIEC).
DriverSchema.index({ dni: 1 }, { unique: true });
DriverSchema.index({ municipalityId: 1, status: 1 });
DriverSchema.index({ companyId: 1, status: 1 });
DriverSchema.index({ municipalityId: 1, verified: 1 });
// Para queries de vencimiento ("conductores con licencia vencida o por
// vencer en 30 días"). Sparse porque la fecha es opcional.
DriverSchema.index({ licenseExpiryDate: 1 }, { sparse: true });

export const Driver: Model<IDriver> =
  (mongoose.models.Driver as Model<IDriver> | undefined) ||
  mongoose.model<IDriver>("Driver", DriverSchema);
