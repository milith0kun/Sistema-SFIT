import mongoose, { Schema, type Document, type Model } from "mongoose";

/**
 * Histórico de puntos GPS por turno (FleetEntry). Una colección separada
 * para que el documento de FleetEntry no crezca sin límite y para soportar
 * turnos largos (8h ≈ 5800 puntos a 5s/punto). El array embebido `trackPoints`
 * en FleetEntry quedó deprecado — solo se mantiene por compat con datos legacy.
 *
 * Índices:
 *   - { entryId, ts }   — leer trazo de un turno en orden cronológico
 *   - { driverId, ts }  — histórico completo de un conductor (auditoría)
 *   - { municipalityId, ts } — analítica agregada del tenant
 */
export interface ILocationPing extends Document {
  entryId: mongoose.Types.ObjectId;
  driverId: mongoose.Types.ObjectId;
  vehicleId: mongoose.Types.ObjectId;
  municipalityId: mongoose.Types.ObjectId;
  routeId?: mongoose.Types.ObjectId;
  lat: number;
  lng: number;
  /** Timestamp del fix (no `createdAt`, porque podemos recibir puntos del buffer offline retrasados). */
  ts: Date;
  accuracy?: number;
  /** Velocidad (m/s) reportada por el GPS. */
  speed?: number;
  createdAt: Date;
}

const LocationPingSchema = new Schema<ILocationPing>(
  {
    entryId: { type: Schema.Types.ObjectId, ref: "FleetEntry", required: true },
    driverId: { type: Schema.Types.ObjectId, ref: "Driver", required: true },
    vehicleId: { type: Schema.Types.ObjectId, ref: "Vehicle", required: true },
    municipalityId: { type: Schema.Types.ObjectId, ref: "Municipality", required: true },
    routeId: { type: Schema.Types.ObjectId, ref: "Route" },
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
    ts: { type: Date, required: true },
    accuracy: { type: Number },
    speed: { type: Number },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

LocationPingSchema.index({ entryId: 1, ts: 1 });
LocationPingSchema.index({ driverId: 1, ts: -1 });
LocationPingSchema.index({ municipalityId: 1, ts: -1 });

export const LocationPing: Model<ILocationPing> =
  (mongoose.models.LocationPing as Model<ILocationPing> | undefined) ||
  mongoose.model<ILocationPing>("LocationPing", LocationPingSchema);
