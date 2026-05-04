import mongoose, { Schema, type Document, type Model } from "mongoose";
import type { ServiceScope } from "./Company";
import { SERVICE_SCOPES } from "./Company";

export interface IWaypoint {
  order: number;
  lat: number;
  lng: number;
  label?: string;
  /** UBIGEO 6 dígitos del distrito al que pertenece el waypoint, si aplica. */
  districtCode?: string;
}

/**
 * Ruta o zona de operación.
 *
 * Para rutas urbano_distrital: `municipalityId` contiene la única jurisdicción
 * (origen y destino caen dentro del mismo distrito).
 *
 * Para rutas interprovinciales/regionales/nacionales:
 *   - `originDistrictCode` y `destinationDistrictCode` (UBIGEO 6 dígitos) son
 *     los extremos.
 *   - `traversedDistrictCodes[]` lista los distritos que la ruta atraviesa
 *     (incluyendo origen y destino) — usado para validar inspecciones cruzadas
 *     en la política de Etapa 3.
 *   - `municipalityId` se mantiene como sede administrativa (la municipalidad
 *     que registra la ruta), normalmente la del origen.
 */
export interface IRoute extends Document {
  municipalityId: mongoose.Types.ObjectId;
  code: string;
  name: string;
  type: "ruta" | "zona";
  stops?: number;
  length?: string;
  area?: string;
  vehicleTypeKey?: string;
  companyId?: mongoose.Types.ObjectId;
  vehicleCount: number;
  status: "activa" | "suspendida";
  frequencies?: string[];
  waypoints: IWaypoint[];

  serviceScope: ServiceScope;
  originDistrictCode?: string;        // UBIGEO 6
  destinationDistrictCode?: string;   // UBIGEO 6
  traversedDistrictCodes: string[];   // UBIGEO 6 — distritos que cruza

  /**
   * Sentido del trazado. "circular" para rutas que regresan al punto de
   * partida. "ida"/"vuelta" se usan en pares ligados via `siblingRouteId`.
   */
  direction?: "ida" | "vuelta" | "circular";

  /**
   * Cuando una ruta tiene ida y vuelta como dos polilíneas distintas,
   * `siblingRouteId` apunta a la otra mitad. Permite al conductor en la
   * app elegir "ida" o "vuelta" del mismo recorrido lógico.
   */
  siblingRouteId?: mongoose.Types.ObjectId;

  /**
   * Geometría real de la ruta siguiendo calles (cacheada de Google Routes
   * API). Se recomputa en cada PATCH que modifica `waypoints`. Si Google
   * está caído o la cuota se acabó queda null y la app cae al fallback
   * de líneas rectas entre waypoints.
   */
  polylineGeometry?: {
    coords: [number, number][];        // [lat, lng] siguiendo calles
    distanceMeters: number;
    durationSecondsBaseline: number;   // duración Google sin tráfico
    computedAt: Date;
  } | null;

  createdAt: Date;
  updatedAt: Date;
}

const WaypointSchema = new Schema<IWaypoint>(
  {
    order: { type: Number, required: true },
    lat:   { type: Number, required: true },
    lng:   { type: Number, required: true },
    label: { type: String },
    districtCode: { type: String, trim: true },
  },
  { _id: false },
);

const RouteSchema = new Schema<IRoute>(
  {
    municipalityId: { type: Schema.Types.ObjectId, ref: "Municipality", required: true, index: true },
    code: { type: String, required: true, trim: true },
    name: { type: String, required: true, trim: true },
    type: { type: String, enum: ["ruta", "zona"], default: "ruta" },
    stops: { type: Number },
    length: { type: String },
    area: { type: String },
    vehicleTypeKey: { type: String },
    companyId: { type: Schema.Types.ObjectId, ref: "Company" },
    vehicleCount: { type: Number, default: 0 },
    status: { type: String, enum: ["activa", "suspendida"], default: "activa" },
    frequencies: { type: [String], default: [] },
    waypoints: { type: [WaypointSchema], default: [] },

    serviceScope: {
      type: String,
      enum: SERVICE_SCOPES,
      default: "urbano_distrital",
      index: true,
    },
    originDistrictCode:      { type: String, trim: true },
    destinationDistrictCode: { type: String, trim: true },
    traversedDistrictCodes:  { type: [String], default: [], index: true },

    direction: { type: String, enum: ["ida", "vuelta", "circular"] },
    siblingRouteId: { type: Schema.Types.ObjectId, ref: "Route" },

    // Geometría real cacheada — opcional, se popula en PATCH waypoints
    polylineGeometry: {
      type: {
        coords: { type: [[Number]], default: [] },
        distanceMeters: { type: Number, default: 0 },
        durationSecondsBaseline: { type: Number, default: 0 },
        computedAt: { type: Date, default: () => new Date() },
        _id: false,
      },
      default: null,
    },
  },
  { timestamps: true },
);

RouteSchema.index({ municipalityId: 1, code: 1 }, { unique: true });
RouteSchema.index({ serviceScope: 1, originDistrictCode: 1 });

export const Route: Model<IRoute> =
  (mongoose.models.Route as Model<IRoute> | undefined) ||
  mongoose.model<IRoute>("Route", RouteSchema);
