import mongoose, { Schema, type Document, type Model } from "mongoose";

/**
 * Provincia (RF-02-01).
 * Nivel más alto de la jerarquía geográfica.
 * El Super Admin gestiona el catálogo de provincias y el Admin Provincial
 * supervisa todas las municipalidades de la suya.
 */
export interface IProvince extends Document {
  name: string;
  region: string;
  active: boolean;
  // Catálogo oficial INEI — UBIGEO peruano
  ubigeoCode?: string;     // 4 dígitos: depto(2)+prov(2), p.ej. "0801"
  departmentCode?: string; // 2 dígitos, p.ej. "08"
  departmentName?: string; // p.ej. "Cusco"
  createdAt: Date;
  updatedAt: Date;
}

const ProvinceSchema = new Schema<IProvince>(
  {
    name: { type: String, required: true, trim: true },
    region: { type: String, required: true, trim: true },
    active: { type: Boolean, default: true },
    ubigeoCode:     { type: String, trim: true },
    departmentCode: { type: String, trim: true, index: true },
    departmentName: { type: String, trim: true },
  },
  { timestamps: true },
);

// Catálogo UBIGEO: clave única real es el código (los nombres se repiten entre departamentos).
ProvinceSchema.index({ ubigeoCode: 1 }, { unique: true, sparse: true });
// Compatibilidad con docs heredados sin ubigeoCode: nombre único dentro del departamento.
ProvinceSchema.index({ departmentCode: 1, name: 1 }, { unique: true, sparse: true });

export const Province: Model<IProvince> =
  (mongoose.models.Province as Model<IProvince> | undefined) ||
  mongoose.model<IProvince>("Province", ProvinceSchema);
