import mongoose, { Schema, type Document, type Model } from "mongoose";

/**
 * Catálogo nacional MTC de empresas autorizadas para transporte de pasajeros.
 * Read-only para SFIT — se puebla con `scripts/seed-mtc-pasajeros.ts`.
 *
 * No es un tenant (no lleva `municipalityId`); es referencia compartida que
 * cualquier admin del sistema puede consultar para validar a una empresa
 * antes de registrarla como `Company` operativa en su municipalidad.
 */
export interface ITransportAuthorization extends Document {
  ruc: string;            // 11 dígitos, único (por modo)
  razonSocial: string;
  mode: "terrestre_pasajeros";
  // Última fecha de vigencia observada en el dataset (yyyymmdd → Date).
  vigenciaHasta?: Date | null;
  // Lista de códigos de departamento UBIGEO (2 dígitos) donde la empresa
  // tiene vehículos habilitados; calculada a partir de `AuthorizedVehicle`.
  // El XLSX del MTC trae UBIGEO sólo en parte de las filas, así que también
  // guardamos los nombres textuales (CUSCO, AREQUIPA, …) para no perder
  // cobertura cuando el código no viene.
  coverageDepartments: string[];
  coverageDepartmentNames: string[];
  // Tipos de servicio observados (REGULAR / ESPECIAL / PRIVADO).
  tiposServicio: string[];
  // Ámbito territorial observado (NACIONAL, REGIONAL, etc.).
  ambitos: string[];
  vehicleCount: number;   // cuántos vehículos del catálogo apuntan aquí
  active: boolean;        // true si fue visto en el último run del seed
  source: {
    dataset: string;      // identificador del XLSX (p.ej. "mtc-pasajeros-2022-2024")
    fechaCorte?: number;  // yyyymmdd del último corte observado
    lastSeenRunId: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

const TransportAuthorizationSchema = new Schema<ITransportAuthorization>(
  {
    ruc:         { type: String, required: true, trim: true },
    razonSocial: { type: String, required: true, trim: true },
    mode:        { type: String, enum: ["terrestre_pasajeros"], required: true, default: "terrestre_pasajeros", index: true },
    vigenciaHasta:       { type: Date, default: null },
    coverageDepartments:     { type: [String], default: [] },
    coverageDepartmentNames: { type: [String], default: [] },
    tiposServicio:       { type: [String], default: [] },
    ambitos:             { type: [String], default: [] },
    vehicleCount:        { type: Number, default: 0 },
    active:              { type: Boolean, default: true, index: true },
    source: {
      dataset:        { type: String, required: true },
      fechaCorte:     { type: Number },
      lastSeenRunId:  { type: String, required: true },
    },
  },
  { timestamps: true },
);

// RUC + modo es la identidad lógica del registro (un RUC podría existir en
// otros modos si más adelante cargamos carga / acuático).
TransportAuthorizationSchema.index({ ruc: 1, mode: 1 }, { unique: true });
TransportAuthorizationSchema.index({ coverageDepartments: 1, mode: 1 });
TransportAuthorizationSchema.index({ coverageDepartmentNames: 1, mode: 1 });

export const TransportAuthorization: Model<ITransportAuthorization> =
  (mongoose.models.TransportAuthorization as Model<ITransportAuthorization> | undefined) ||
  mongoose.model<ITransportAuthorization>("TransportAuthorization", TransportAuthorizationSchema);
