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
  },
  { timestamps: true },
);

// RF-02-04: nombre único dentro de la provincia
MunicipalitySchema.index({ provinceId: 1, name: 1 }, { unique: true });

export const Municipality: Model<IMunicipality> =
  (mongoose.models.Municipality as Model<IMunicipality> | undefined) ||
  mongoose.model<IMunicipality>("Municipality", MunicipalitySchema);
