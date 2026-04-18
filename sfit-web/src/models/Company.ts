import mongoose, { Schema, type Document, type Model } from "mongoose";

/**
 * Representante legal de la empresa (RF-04-01).
 */
export interface IRepresentanteLegal {
  name: string;
  dni: string;
  phone?: string;
}

/**
 * Documento adjunto de la empresa (RF-04-01).
 */
export interface ICompanyDocument {
  name: string;
  url: string;
}

/**
 * Empresa de transporte / flota municipal (RF-04).
 * Aislamiento por tenant: siempre filtrar por `municipalityId` (RNF-03).
 * `suspendedAt` implementa el soft-delete de RF-04-05.
 */
export interface ICompany extends Document {
  municipalityId: mongoose.Types.ObjectId;
  razonSocial: string;
  ruc: string;
  representanteLegal: IRepresentanteLegal;
  vehicleTypeKeys: string[];
  documents: ICompanyDocument[];
  active: boolean;
  suspendedAt?: Date;
  reputationScore: number;
  createdAt: Date;
  updatedAt: Date;
}

const RepresentanteLegalSchema = new Schema<IRepresentanteLegal>(
  {
    name: { type: String, required: true, trim: true },
    dni: { type: String, required: true, trim: true },
    phone: { type: String, trim: true },
  },
  { _id: false },
);

const CompanyDocumentSchema = new Schema<ICompanyDocument>(
  {
    name: { type: String, required: true, trim: true },
    url: { type: String, required: true, trim: true },
  },
  { _id: false },
);

const CompanySchema = new Schema<ICompany>(
  {
    municipalityId: {
      type: Schema.Types.ObjectId,
      ref: "Municipality",
      required: true,
      index: true,
    },
    razonSocial: { type: String, required: true, trim: true },
    ruc: { type: String, required: true, trim: true },
    representanteLegal: { type: RepresentanteLegalSchema, required: true },
    vehicleTypeKeys: { type: [String], default: [] },
    documents: { type: [CompanyDocumentSchema], default: [] },
    active: { type: Boolean, default: true },
    suspendedAt: { type: Date },
    reputationScore: { type: Number, default: 100, min: 0, max: 100 },
  },
  { timestamps: true },
);

// RF-04-01: RUC único dentro de la municipalidad
CompanySchema.index({ municipalityId: 1, ruc: 1 }, { unique: true });

export const Company: Model<ICompany> =
  (mongoose.models.Company as Model<ICompany> | undefined) ||
  mongoose.model<ICompany>("Company", CompanySchema);
