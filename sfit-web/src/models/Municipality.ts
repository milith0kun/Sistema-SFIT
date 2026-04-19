import mongoose, { Schema, type Document, type Model } from "mongoose";

/**
 * Municipalidad (RF-02-04).
 * Tenant efectivo del sistema: toda query de dominio filtra por `municipalityId`
 * salvo que el rol sea Super Admin o Admin Provincial.
 */
export interface IMunicipalityConfig {
  horasMaxConduccion: number;
  limiteInspecciones: number;
  alertaFatigaHoras: number;
  notificacionesActivas: boolean;
}

export interface IMunicipality extends Document {
  name: string;
  provinceId: mongoose.Types.ObjectId;
  logoUrl?: string;
  active: boolean;
  config?: IMunicipalityConfig;
  createdAt: Date;
  updatedAt: Date;
}

const MunicipalityConfigSchema = new Schema<IMunicipalityConfig>(
  {
    horasMaxConduccion: { type: Number, default: 8, min: 4, max: 12 },
    limiteInspecciones: { type: Number, default: 100, min: 1 },
    alertaFatigaHoras: { type: Number, default: 4, min: 1, max: 12 },
    notificacionesActivas: { type: Boolean, default: true },
  },
  { _id: false },
);

const MunicipalitySchema = new Schema<IMunicipality>(
  {
    name: { type: String, required: true, trim: true },
    provinceId: {
      type: Schema.Types.ObjectId,
      ref: "Province",
      required: true,
      index: true,
    },
    logoUrl: { type: String },
    active: { type: Boolean, default: true },
    config: { type: MunicipalityConfigSchema, default: () => ({}) },
  },
  { timestamps: true },
);

// RF-02-04: nombre único dentro de la provincia
MunicipalitySchema.index({ provinceId: 1, name: 1 }, { unique: true });

export const Municipality: Model<IMunicipality> =
  (mongoose.models.Municipality as Model<IMunicipality> | undefined) ||
  mongoose.model<IMunicipality>("Municipality", MunicipalitySchema);
