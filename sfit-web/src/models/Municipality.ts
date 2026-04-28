import mongoose, { Schema, type Document, type Model } from "mongoose";

/**
 * Municipalidad (RF-02-04).
 * Tenant efectivo del sistema: toda query de dominio filtra por `municipalityId`
 * salvo que el rol sea Super Admin o Admin Provincial.
 */
export interface IMunicipality extends Document {
  name: string;
  provinceId: mongoose.Types.ObjectId;
  logoUrl?: string;
  active: boolean;
  // Catálogo oficial INEI — UBIGEO peruano (distrito)
  ubigeoCode?: string;     // 6 dígitos: depto(2)+prov(2)+dist(2), p.ej. "080101"
  departmentCode?: string; // 2 dígitos, p.ej. "08"
  provinceCode?: string;   // 4 dígitos, p.ej. "0801"
  createdAt: Date;
  updatedAt: Date;
}

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
    ubigeoCode:     { type: String, trim: true },
    departmentCode: { type: String, trim: true, index: true },
    provinceCode:   { type: String, trim: true, index: true },
  },
  { timestamps: true },
);

// RF-02-04: nombre único dentro de la provincia
MunicipalitySchema.index({ provinceId: 1, name: 1 }, { unique: true });
// Catálogo UBIGEO: el código de distrito es único a nivel nacional.
MunicipalitySchema.index({ ubigeoCode: 1 }, { unique: true, sparse: true });

export const Municipality: Model<IMunicipality> =
  (mongoose.models.Municipality as Model<IMunicipality> | undefined) ||
  mongoose.model<IMunicipality>("Municipality", MunicipalitySchema);
