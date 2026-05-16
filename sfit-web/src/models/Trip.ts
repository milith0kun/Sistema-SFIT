import mongoose, { Schema, type Document, type Model } from "mongoose";

export type TripStatus =
  | "pendiente_aceptacion"  // Asignado por operador, esperando que el conductor confirme
  | "aceptado"              // Conductor confirmó, listo para iniciar
  | "rechazado"             // Conductor declinó (terminal)
  | "cancelado"             // Operador canceló (terminal)
  | "en_curso"              // En ejecución
  | "completado"            // Finalizado normalmente
  | "auto_cierre";          // Cerrado por el sistema (timeout)

export type TripDirection = "ida" | "vuelta" | "circular";

export interface ITrip extends Document {
  municipalityId: mongoose.Types.ObjectId;
  vehicleId: mongoose.Types.ObjectId;
  /**
   * Empresa operadora del viaje. Crítico para auditoría regulatoria en
   * rutas urbanas COMPARTIDAS (varias empresas usan misma ruta y paraderos),
   * donde no basta inferir de `Vehicle.companyId`. Para rutas no
   * compartidas coincide con la empresa del vehículo. Opcional para
   * compatibilidad con trips legacy.
   */
  companyId?: mongoose.Types.ObjectId;
  /**
   * Driver al que se asigna o que reclama el viaje. Opcional porque en el
   * flujo "pull" se puede crear un viaje sin driver y los conductores lo
   * toman desde el catálogo (`/api/viajes/disponibles`).
   */
  driverId?: mongoose.Types.ObjectId;
  routeId?: mongoose.Types.ObjectId;
  fleetEntryId?: mongoose.Types.ObjectId;
  startTime: Date;
  endTime?: Date;
  expectedReturnTime?: Date;
  km: number;
  passengers: number;
  status: TripStatus;
  /** Timestamps del workflow de asignación push/pull (RF-conductor). */
  assignedAt?: Date;
  acceptedAt?: Date;
  rejectedAt?: Date;
  rejectionReason?: string;
  /** Sentido del recorrido en rutas con ida/vuelta. */
  direction?: TripDirection;
  closedAt?: Date;
  autoClosedReason?: string;
  notes?: string;
  /**
   * URLs de fotos del manifiesto firmado. Array para soportar manifiestos
   * largos que requieren más de una página escaneada/fotografiada.
   */
  manifestPhotoUrls?: string[];
  /**
   * Modo de registro de pasajeros del viaje:
   *   - "count": solo se incrementa Trip.passengers (urbano).
   *   - "list":  se registran Passenger nominalmente (interprovincial).
   */
  passengerListMode?: "count" | "list";
  createdAt: Date;
  updatedAt: Date;
}

const TripSchema = new Schema<ITrip>(
  {
    municipalityId: { type: Schema.Types.ObjectId, ref: "Municipality", required: true, index: true },
    vehicleId: { type: Schema.Types.ObjectId, ref: "Vehicle", required: true },
    companyId: { type: Schema.Types.ObjectId, ref: "Company", index: true },
    // No required: el flujo "pull" admite viajes sin driver hasta que alguno lo toma.
    driverId: { type: Schema.Types.ObjectId, ref: "Driver", index: true },
    routeId: { type: Schema.Types.ObjectId, ref: "Route" },
    fleetEntryId: { type: Schema.Types.ObjectId, ref: "FleetEntry" },
    startTime: { type: Date, required: true },
    endTime: { type: Date },
    expectedReturnTime: { type: Date },
    km: { type: Number, default: 0 },
    passengers: { type: Number, default: 0 },
    status: {
      type: String,
      enum: [
        "pendiente_aceptacion", "aceptado", "rechazado", "cancelado",
        "en_curso", "completado", "auto_cierre",
      ],
      default: "en_curso",
    },
    assignedAt: { type: Date },
    acceptedAt: { type: Date },
    rejectedAt: { type: Date },
    rejectionReason: { type: String, trim: true, maxlength: 500 },
    direction: { type: String, enum: ["ida", "vuelta", "circular"] },
    closedAt: { type: Date },
    autoClosedReason: { type: String },
    notes: { type: String },
    manifestPhotoUrls: { type: [String], default: [] },
    passengerListMode: {
      type: String,
      enum: ["count", "list"],
      default: "count",
    },
  },
  { timestamps: true },
);

TripSchema.index({ municipalityId: 1, startTime: -1 });
TripSchema.index({ municipalityId: 1, status: 1 });
TripSchema.index({ driverId: 1, status: 1 });
// Auditoría regulatoria: viajes por empresa en un rango temporal.
TripSchema.index({ companyId: 1, startTime: -1 });
// Catálogo "pull": viajes disponibles sin driver asignado.
TripSchema.index({ municipalityId: 1, status: 1, driverId: 1 });

export const Trip: Model<ITrip> =
  (mongoose.models.Trip as Model<ITrip> | undefined) ||
  mongoose.model<ITrip>("Trip", TripSchema);
