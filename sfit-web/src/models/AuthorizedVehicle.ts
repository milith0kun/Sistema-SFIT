import mongoose, { Schema, type Document, type Model } from "mongoose";

/**
 * Catálogo nacional MTC de vehículos habilitados para transporte de pasajeros.
 * Read-only para SFIT — se puebla con `scripts/seed-mtc-pasajeros.ts`.
 *
 * Cada documento representa una placa habilitada con su empresa autorizadora,
 * datos técnicos y ámbito de servicio. Se usa para autocompletar formularios
 * cuando un admin_municipal registra un `Vehicle` operativo en su tenant.
 */
export interface IAuthorizedVehicle extends Document {
  placa: string;          // alfanumérica, uppercase, único nacional dentro de un mode
  authorizationId: mongoose.Types.ObjectId;
  ruc: string;            // denormalizado de la authorization para queries
  mode: "terrestre_pasajeros";

  // Identificación del vehículo
  clase?: string;         // OMNIBUS / CMTA RURAL / AUTOMOVIL / STAT WAGON
  marca?: string;
  anioFabr?: number;
  nChasis?: string;
  nMotor?: string;

  // Servicio y ámbito
  ambitoOpera?: string;       // PERU / EXTRANJERO
  ambitoTerritorial?: string; // NACIONAL / REGIONAL / DISTRITAL
  naturalezaServicio?: string; // PUBLICO / PRIVADO
  tipoServicio?: string;      // REGULAR / ESPECIAL / PRIVADO
  actividadServicio?: string; // DE TRABAJADORES / TURISTICO / SOCIAL / etc.

  // Especificaciones técnicas
  nLlantas?: number;
  nAsientos?: number;
  nEjes?: number;
  cargaUtil?: number;     // toneladas
  pesoSeco?: number;
  pesoBruto?: number;
  largo?: number;
  ancho?: number;
  altura?: number;

  // Ubicación administrativa.
  // El XLSX trae los códigos UBIGEO sólo para parte de las filas; por eso
  // conservamos también los nombres textuales tal como vienen.
  ubigeoCode?: string;    // 6 dígitos
  departmentCode?: string; // 2 dígitos
  provinceCode?: string;   // 4 dígitos
  departmentName?: string;
  provinceName?: string;
  districtName?: string;

  vigenciaHasta?: Date | null;
  fechaCorte?: number;    // yyyymmdd del corte del dataset

  active: boolean;
  source: {
    dataset: string;
    rowHash: string;
    lastSeenRunId: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

const AuthorizedVehicleSchema = new Schema<IAuthorizedVehicle>(
  {
    placa:           { type: String, required: true, trim: true, uppercase: true },
    authorizationId: { type: Schema.Types.ObjectId, ref: "TransportAuthorization", required: true, index: true },
    ruc:             { type: String, required: true, trim: true, index: true },
    mode:            { type: String, enum: ["terrestre_pasajeros"], required: true, default: "terrestre_pasajeros" },

    clase:    { type: String, trim: true, index: true },
    marca:    { type: String, trim: true },
    anioFabr: { type: Number },
    nChasis:  { type: String, trim: true },
    nMotor:   { type: String, trim: true },

    ambitoOpera:        { type: String, trim: true },
    ambitoTerritorial:  { type: String, trim: true },
    naturalezaServicio: { type: String, trim: true },
    tipoServicio:       { type: String, trim: true, index: true },
    actividadServicio:  { type: String, trim: true },

    nLlantas:  { type: Number },
    nAsientos: { type: Number },
    nEjes:     { type: Number },
    cargaUtil: { type: Number },
    pesoSeco:  { type: Number },
    pesoBruto: { type: Number },
    largo:     { type: Number },
    ancho:     { type: Number },
    altura:    { type: Number },

    ubigeoCode:     { type: String, trim: true },
    departmentCode: { type: String, trim: true, index: true },
    provinceCode:   { type: String, trim: true },
    departmentName: { type: String, trim: true, index: true },
    provinceName:   { type: String, trim: true },
    districtName:   { type: String, trim: true },

    vigenciaHasta: { type: Date, default: null },
    fechaCorte:    { type: Number },

    active: { type: Boolean, default: true, index: true },
    source: {
      dataset:       { type: String, required: true },
      rowHash:       { type: String, required: true },
      lastSeenRunId: { type: String, required: true },
    },
  },
  { timestamps: true },
);

// Una placa por modo es la identidad del registro.
AuthorizedVehicleSchema.index({ placa: 1, mode: 1 }, { unique: true });

export const AuthorizedVehicle: Model<IAuthorizedVehicle> =
  (mongoose.models.AuthorizedVehicle as Model<IAuthorizedVehicle> | undefined) ||
  mongoose.model<IAuthorizedVehicle>("AuthorizedVehicle", AuthorizedVehicleSchema);
