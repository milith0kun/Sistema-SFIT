import mongoose, { Schema, type Document, type Model } from "mongoose";

export interface IGpsPoint {
  lat: number;
  lng: number;
}

export interface ICurrentLocation extends IGpsPoint {
  updatedAt: Date;
  /** Precisión reportada por el GPS del dispositivo (metros). */
  accuracy?: number;
  /** Velocidad estimada (m/s) en el momento del fix. */
  speed?: number;
}

/** Visita a un paradero detectada automáticamente al pasar dentro del radio. */
export interface IVisitedStop {
  /** Índice del waypoint en `Route.waypoints` (coincide con `waypoint.order`). */
  stopIndex: number;
  /** Etiqueta del paradero (copiada del waypoint para histórico aún si la ruta cambia). */
  label?: string;
  /** Coordenada efectiva donde se registró la visita. */
  lat: number;
  lng: number;
  visitedAt: Date;
}

export interface IFleetEntry extends Document {
  municipalityId: mongoose.Types.ObjectId;
  date: Date;
  vehicleId: mongoose.Types.ObjectId;
  routeId?: mongoose.Types.ObjectId;
  driverId: mongoose.Types.ObjectId;
  departureTime?: string;
  returnTime?: string;
  km: number;
  status: "disponible" | "en_ruta" | "cerrado" | "auto_cierre" | "mantenimiento" | "fuera_de_servicio";
  observations?: string;
  checklistComplete: boolean;
  registeredBy: mongoose.Types.ObjectId;
  currentLocation?: ICurrentLocation;
  startLocation?: IGpsPoint;
  endLocation?: IGpsPoint;
  trackPoints?: Array<{ lat: number; lng: number; ts: Date; accuracy?: number; speed?: number }>;
  /** Paraderos visitados durante el turno (detección automática por proximidad). */
  visitedStops?: IVisitedStop[];
  /** % de paraderos cubiertos al cierre (0-100). Solo se calcula al pasar a 'cerrado'. */
  routeCompliancePercentage?: number;
  /** Distancia real recorrida (m), sumando haversine entre trackPoints. Se calcula al cerrar. */
  distanceMeters?: number;
  /** Duración total del turno (s). returnTime − departureTime, solo al cerrar. */
  durationSeconds?: number;
  createdAt: Date;
  updatedAt: Date;
}

const FleetEntrySchema = new Schema<IFleetEntry>(
  {
    municipalityId: { type: Schema.Types.ObjectId, ref: "Municipality", required: true, index: true },
    date: { type: Date, required: true, index: true },
    vehicleId: { type: Schema.Types.ObjectId, ref: "Vehicle", required: true },
    routeId: { type: Schema.Types.ObjectId, ref: "Route" },
    driverId: { type: Schema.Types.ObjectId, ref: "Driver", required: true },
    departureTime: { type: String },
    returnTime: { type: String },
    km: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ["disponible", "en_ruta", "cerrado", "auto_cierre", "mantenimiento", "fuera_de_servicio"],
      default: "disponible",
    },
    observations: { type: String },
    checklistComplete: { type: Boolean, default: false },
    registeredBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    currentLocation: {
      lat: { type: Number },
      lng: { type: Number },
      updatedAt: { type: Date },
      accuracy: { type: Number },
      speed: { type: Number },
    },
    startLocation: {
      lat: { type: Number },
      lng: { type: Number },
    },
    endLocation: {
      lat: { type: Number },
      lng: { type: Number },
    },
    trackPoints: [{
      lat: { type: Number },
      lng: { type: Number },
      ts: { type: Date },
      accuracy: { type: Number },
      speed: { type: Number },
      _id: false,
    }],
    visitedStops: [{
      stopIndex: { type: Number, required: true },
      label: { type: String },
      lat: { type: Number, required: true },
      lng: { type: Number, required: true },
      visitedAt: { type: Date, required: true },
      _id: false,
    }],
    routeCompliancePercentage: { type: Number, min: 0, max: 100 },
    distanceMeters: { type: Number, min: 0 },
    durationSeconds: { type: Number, min: 0 },
  },
  { timestamps: true },
);

FleetEntrySchema.index({ municipalityId: 1, date: 1 });
FleetEntrySchema.index({ municipalityId: 1, vehicleId: 1, date: 1 });

export const FleetEntry: Model<IFleetEntry> =
  (mongoose.models.FleetEntry as Model<IFleetEntry> | undefined) ||
  mongoose.model<IFleetEntry>("FleetEntry", FleetEntrySchema);
