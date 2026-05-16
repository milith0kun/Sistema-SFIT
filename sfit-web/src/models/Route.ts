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
  /**
   * Empresa propietaria de la ruta. Aplica cuando `isShared=false` (caso
   * normal: ruta interprovincial pertenece a una empresa específica). Para
   * rutas compartidas (`isShared=true`) este campo queda en null y la lista
   * de operadores autorizados vive en `companyIds`.
   */
  companyId?: mongoose.Types.ObjectId;
  /**
   * Ruta compartida por múltiples empresas con misma tarifa y mismos
   * paraderos (caso típico de transporte urbano intra-provincial en
   * Cotabambas). Cuando es `true`:
   *   - `companyId` se ignora (queda null).
   *   - `companyIds` lista las empresas autorizadas a operarla.
   *   - Cada Trip debe traer `companyId` explícito para saber qué empresa
   *     ejecutó cada viaje (auditoría regulatoria).
   */
  isShared: boolean;
  /**
   * Empresas autorizadas a operar una ruta compartida. Solo se usa si
   * `isShared=true`. Vacío en rutas no compartidas.
   */
  companyIds: mongoose.Types.ObjectId[];
  vehicleCount: number;
  status: "activa" | "suspendida";
  frequencies?: string[];
  /**
   * Horarios fijos de salida en formato HH:mm (24h). Pensado para rutas
   * interprovinciales donde el operador define salidas programadas
   * (p.ej. ["06:00", "12:00", "18:00"]). Las urbanas suelen usar
   * `frequencies` (cada N min) en su lugar.
   */
  departureSchedules?: string[];
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

  /**
   * Override manual del operador: una pasada (FleetEntry) o captura GPS
   * marcada explícitamente como la "mejor" del corredor. Cuando está
   * presente gana sobre el `isBest` automático calculado por score —
   * la UI debe mostrarla como "MEJOR (manual)" para distinguirla.
   */
  preferredCaptureId?: mongoose.Types.ObjectId;
  preferredAt?: Date;
  preferredBy?: mongoose.Types.ObjectId;     // userId del operador que marcó

  /**
   * Etiquetas libres que el operador asigna al corredor. Suelen describir
   * características operativas (ej. "congestionada", "rapida",
   * "alternativa_lluvia") y se filtran/agrupan en la UI. Formato libre,
   * sin validación de catálogo — la app sugiere presets pero acepta custom.
   */
  tags: string[];

  /**
   * Parámetros operativos editables. Reemplazan/extienden a `frequencies`:
   * `frecuenciaMinutos` es estructurado (numérico) mientras que el array
   * `frequencies` está en texto libre legacy. Mantener ambos hasta migrar.
   */
  parameters?: {
    frecuenciaMinutos?: number | null;
    capacidadAsientos?: number | null;
    horarioPico?: { from: string; to: string }[];
    observaciones?: string | null;
  };

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
    isShared: { type: Boolean, default: false, index: true },
    companyIds: { type: [{ type: Schema.Types.ObjectId, ref: "Company" }], default: [], index: true },
    vehicleCount: { type: Number, default: 0 },
    status: { type: String, enum: ["activa", "suspendida"], default: "activa" },
    frequencies: { type: [String], default: [] },
    departureSchedules: { type: [String], default: [] },
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

    // Override manual: el operador puede marcar una captura/pasada como
    // "preferida". Tiene precedencia sobre el `isBest` automático calculado
    // a partir del score. Validamos en el endpoint que la captura pertenezca
    // a la misma empresa que la ruta (multi-tenant).
    preferredCaptureId: { type: Schema.Types.ObjectId, ref: "FleetEntry" },
    preferredAt: { type: Date },
    preferredBy: { type: Schema.Types.ObjectId, ref: "User" },

    // Etiquetas y parámetros operativos. `tags` es flexible (presets +
    // custom). `parameters` agrupa metadata estructurada para reportes.
    tags: { type: [String], default: [] },
    parameters: {
      type: {
        frecuenciaMinutos: { type: Number, min: 0, max: 240, default: null },
        capacidadAsientos: { type: Number, min: 0, max: 200, default: null },
        horarioPico: {
          type: [
            {
              from: { type: String, required: true }, // HH:mm
              to:   { type: String, required: true }, // HH:mm
              _id: false,
            },
          ],
          default: [],
        },
        observaciones: { type: String, default: null, maxlength: 500 },
        _id: false,
      },
      default: () => ({}),
    },
  },
  { timestamps: true },
);

RouteSchema.index({ municipalityId: 1, code: 1 }, { unique: true });
RouteSchema.index({ serviceScope: 1, originDistrictCode: 1 });

/**
 * Hook pre-validate: garantiza coherencia entre `isShared`, `companyId` y
 * `companyIds`. Ejecutado tanto en `.save()` como en `.create()`.
 *   - Ruta compartida: companyId debe ser null/undefined; companyIds
 *     debe tener al menos 1 empresa.
 *   - Ruta no compartida: companyIds debe estar vacío. companyId puede
 *     ser opcional (rutas sin dueño asignado todavía).
 */
RouteSchema.pre("validate", function () {
  if (this.isShared) {
    if (this.companyId) this.companyId = undefined;
    if (!this.companyIds || this.companyIds.length === 0) {
      throw new Error("Una ruta compartida debe listar al menos una empresa en companyIds");
    }
  } else if (this.companyIds && this.companyIds.length > 0) {
    // Limpiamos en lugar de fallar para tolerar payloads laxos
    this.companyIds = [] as never;
  }
});

export const Route: Model<IRoute> =
  (mongoose.models.Route as Model<IRoute> | undefined) ||
  mongoose.model<IRoute>("Route", RouteSchema);
