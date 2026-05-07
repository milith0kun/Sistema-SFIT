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

export type RouteCaptureStatus =
  | "raw"
  | "candidate"
  | "validated"
  | "rejected"
  | "merged";

/**
 * Captura de un recorrido GPS. Dos orígenes:
 *
 *   1) Conductor sale con `routeId` ya elegida → captura `status="raw"`,
 *      alimenta la convergencia de esa ruta.
 *   2) Conductor sale SIN ruta (caso común al onboardear empresas con
 *      recorridos no formalizados) → captura `status="candidate"` y
 *      `routeId=null`. El operador la valida desde el panel y entonces:
 *         - genera una nueva Route a partir de la captura, o
 *         - la asigna a una Route existente.
 *
 * `qualityScore` (0-100) se calcula al crear la captura combinando:
 *   - precisión GPS promedio (mientras más bajo el accuracy, mejor)
 *   - cobertura de paraderos visitados (visitedStops/totalStops)
 *   - distancia recorrida razonable (no muy corta ni muy larga vs ruta oficial)
 *
 * Capturas con qualityScore < 60 se descartan automáticamente al converger.
 */
export interface IRouteCapture extends Document {
  /** Cuando se valida o cuando el turno tenía ruta. Null si la captura es candidata. */
  routeId?: mongoose.Types.ObjectId | null;
  /** Link al turno (FleetEntry) que originó la captura. */
  fleetEntryId?: mongoose.Types.ObjectId;
  /** Legacy — link al modelo Trip (en deshuso). */
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

  /** Metadata propuesta cuando la captura es `candidate` (la rellena el operador). */
  proposedName?: string;
  proposedCode?: string;
  proposedCompanyId?: mongoose.Types.ObjectId;
  proposedOriginLabel?: string;
  proposedDestinationLabel?: string;

  /** Si fue validada y se creó/asignó una Route, link de auditoría. */
  promotedToRouteId?: mongoose.Types.ObjectId;

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
    routeId: { type: Schema.Types.ObjectId, ref: "Route", default: null, index: true },
    fleetEntryId: { type: Schema.Types.ObjectId, ref: "FleetEntry", index: true },
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
      enum: ["raw", "candidate", "validated", "rejected", "merged"],
      default: "raw",
      index: true,
    },

    proposedName: { type: String, trim: true },
    proposedCode: { type: String, trim: true },
    proposedCompanyId: { type: Schema.Types.ObjectId, ref: "Company" },
    proposedOriginLabel: { type: String, trim: true },
    proposedDestinationLabel: { type: String, trim: true },

    promotedToRouteId: { type: Schema.Types.ObjectId, ref: "Route" },

    mergedAt: { type: Date },
  },
  { timestamps: true },
);

// Índices: convergencia siempre filtra por routeId + status="raw".
RouteCaptureSchema.index({ routeId: 1, status: 1, qualityScore: -1 });
RouteCaptureSchema.index({ municipalityId: 1, createdAt: -1 });
// Listado del panel de operador: capturas candidatas por muni, ordenadas por fecha.
RouteCaptureSchema.index({ municipalityId: 1, status: 1, createdAt: -1 });

export const RouteCapture: Model<IRouteCapture> =
  (mongoose.models.RouteCapture as Model<IRouteCapture> | undefined) ||
  mongoose.model<IRouteCapture>("RouteCapture", RouteCaptureSchema);
