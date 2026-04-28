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
  // Datos institucionales — los completa el admin_municipal en su primer login.
  ruc?: string;            // 11 dígitos, único nacional
  razonSocial?: string;    // Razón social oficial según SUNAT
  dataCompleted: boolean;  // true cuando RUC + razón social están registrados
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
    ruc:            { type: String, trim: true },
    razonSocial:    { type: String, trim: true },
    dataCompleted:  { type: Boolean, default: false },
  },
  { timestamps: true },
);

// RF-02-04: nombre único dentro de la provincia
MunicipalitySchema.index({ provinceId: 1, name: 1 }, { unique: true });
// Catálogo UBIGEO: el código de distrito es único a nivel nacional.
MunicipalitySchema.index({ ubigeoCode: 1 }, { unique: true, sparse: true });
// RUC institucional único nacional (sparse para permitir municipalidades
// activadas que aún no completaron sus datos).
MunicipalitySchema.index({ ruc: 1 }, { unique: true, sparse: true });

export const Municipality: Model<IMunicipality> =
  (mongoose.models.Municipality as Model<IMunicipality> | undefined) ||
  mongoose.model<IMunicipality>("Municipality", MunicipalitySchema);
