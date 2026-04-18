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
  createdAt: Date;
  updatedAt: Date;
}

const ProvinceSchema = new Schema<IProvince>(
  {
    name: { type: String, required: true, trim: true, unique: true },
    region: { type: String, required: true, trim: true },
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
);

export const Province: Model<IProvince> =
  (mongoose.models.Province as Model<IProvince> | undefined) ||
  mongoose.model<IProvince>("Province", ProvinceSchema);
