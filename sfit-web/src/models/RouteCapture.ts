import mongoose, { Schema, type Document, type Model } from "mongoose";

/**
 * Punto GPS individual capturado por la app del conductor durante un viaje.
 */
export interface IRouteCapturePoint {
  lat: number;
  lng: number;
  ts: Date;
  accuracy?: number; // metros
  speed?: number;    // m/s
}

export type RouteCaptureStatus = "raw" | "validated" | "rejected" | "merged";

/**
 * Captura de un recorrido GPS asociado a una Ruta. Cada vez que un Trip
 * con `routeId` se cierra, se crea un RouteCapture con sus trackPoints.
 *
 * El operador puede ejecutar la convergencia (`POST /api/rutas/[id]/recalcular`)
 * para reemplazar los waypoints "oficiales" de la Route con un promedio
 * estadístico de varias capturas. Las capturas usadas pasan a status "merged".
 *
 * `qualityScore` (0-100) se calcula al crear la captura combinando:
 *   - precisión GPS promedio (mientras más bajo el accuracy, mejor)
 *   - cobertura de paraderos visitados (visitedStops/totalStops)
 *   - distancia recorrida razonable (no muy corta ni muy larga vs ruta oficial)
 *
 * Capturas con qualityScore < 60 se descartan automáticamente al converger.
 */
export interface IRouteCapture extends Document {
  routeId: mongoose.Types.ObjectId;
  tripId?: mongoose.Types.ObjectId;
  driverId?: mongoose.Types.ObjectId;
  vehicleId?: mongoose.Types.ObjectId;
  municipalityId: mongoose.Types.ObjectId;

  points: IRouteCapturePoint[];
  pointCount: number;
  avgAccuracy?: number;
  distanceMeters?: number;
  durationSeconds?: number;
  qualityScore: number;
  status: RouteCaptureStatus;

  /** Si fue usada en una convergencia, fecha y waypoints resultantes (audit). */
  mergedAt?: Date;

  createdAt: Date;
  updatedAt: Date;
}

const RouteCapturePointSchema = new Schema<IRouteCapturePoint>(
  {
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
    ts: { type: Date, required: true },
    accuracy: { type: Number },
    speed: { type: Number },
  },
  { _id: false },
);

const RouteCaptureSchema = new Schema<IRouteCapture>(
  {
    routeId: { type: Schema.Types.ObjectId, ref: "Route", required: true, index: true },
    tripId: { type: Schema.Types.ObjectId, ref: "Trip", index: true },
    driverId: { type: Schema.Types.ObjectId, ref: "Driver" },
    vehicleId: { type: Schema.Types.ObjectId, ref: "Vehicle" },
    municipalityId: { type: Schema.Types.ObjectId, ref: "Municipality", required: true, index: true },

    points: { type: [RouteCapturePointSchema], default: [] },
    pointCount: { type: Number, default: 0, min: 0 },
    avgAccuracy: { type: Number },
    distanceMeters: { type: Number },
    durationSeconds: { type: Number },
    qualityScore: { type: Number, default: 0, min: 0, max: 100 },
    status: {
      type: String,
      enum: ["raw", "validated", "rejected", "merged"],
      default: "raw",
      index: true,
    },
    mergedAt: { type: Date },
  },
  { timestamps: true },
);

// Índices: convergencia siempre filtra por routeId + status="raw".
RouteCaptureSchema.index({ routeId: 1, status: 1, qualityScore: -1 });
RouteCaptureSchema.index({ municipalityId: 1, createdAt: -1 });

export const RouteCapture: Model<IRouteCapture> =
  (mongoose.models.RouteCapture as Model<IRouteCapture> | undefined) ||
  mongoose.model<IRouteCapture>("RouteCapture", RouteCaptureSchema);
