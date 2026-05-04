import mongoose, { Schema, type Document, type Model } from "mongoose";

/**
 * Región (departamento) — nivel más alto de la jerarquía geográfica peruana.
 * Una Región agrupa N Provincias, y cada Provincia agrupa N Municipalidades.
 *
 * El rol `admin_regional` tiene scope sobre todas las provincias y munis
 * de SU región. Antes de este modelo, la "región" vivía solo como string
 * en `Province.region`; ahora se vincula con `Province.regionId` para que
 * los filtros sean rápidos y la jerarquía sea consultable.
 *
 * El catálogo lo gestiona super_admin. La migración inicial corre el
 * endpoint POST /api/admin/migrate/sync-region-ids que normaliza los
 * strings existentes en `Province.region`.
 */
export interface IRegion extends Document {
  name: string;
  /** Código UBIGEO del departamento (2 dígitos), p.ej. "08" para Cusco. */
  code?: string;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const RegionSchema = new Schema<IRegion>(
  {
    name: { type: String, required: true, trim: true },
    code: { type: String, trim: true },
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
);

// El nombre de la región es único (ignorando case implícito por el cliente).
RegionSchema.index({ name: 1 }, { unique: true });
// El code UBIGEO también es único cuando está presente.
RegionSchema.index({ code: 1 }, { unique: true, sparse: true });

export const Region: Model<IRegion> =
  (mongoose.models.Region as Model<IRegion> | undefined) ||
  mongoose.model<IRegion>("Region", RegionSchema);
