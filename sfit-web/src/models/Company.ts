import mongoose, { Schema, type Document, type Model } from "mongoose";

/**
 * Modalidad de servicio reconocida por el marco regulatorio peruano
 * (Ley 27181 — Ley General de Transporte y Tránsito Terrestre).
 *
 *  - urbano_distrital        : dentro de un distrito (autoridad: muni distrital)
 *  - urbano_provincial       : entre distritos de la misma provincia (autoridad: muni provincial)
 *  - interprovincial_regional: entre provincias del mismo departamento o entre departamentos
 *                              (autoridad: gobierno regional + MTC)
 *  - interregional_nacional  : entre departamentos / nacional (autoridad: MTC)
 */
export type ServiceScope =
  | "urbano_distrital"
  | "urbano_provincial"
  | "interprovincial_regional"
  | "interregional_nacional";

export const SERVICE_SCOPES: ServiceScope[] = [
  "urbano_distrital",
  "urbano_provincial",
  "interprovincial_regional",
  "interregional_nacional",
];

export type AuthorityLevel =
  | "municipal_distrital"
  | "municipal_provincial"
  | "regional"
  | "mtc";

export const AUTHORITY_LEVELS: AuthorityLevel[] = [
  "municipal_distrital",
  "municipal_provincial",
  "regional",
  "mtc",
];

export interface IRepresentanteLegal {
  name: string;
  dni: string;
  phone?: string;
}

export interface ICompanyDocument {
  name: string;
  url: string;
}

/**
 * Resolución de autorización para operar una modalidad. Una empresa puede
 * tener varias (urbana + interprovincial), cada una con su entidad reguladora.
 */
export interface IAuthorization {
  level: AuthorityLevel;
  scope: ServiceScope;
  issuedBy?: string;          // nombre de la autoridad emisora
  resolutionNumber?: string;  // número de resolución
  issuedAt?: Date;
  expiresAt?: Date;
  documentUrl?: string;
}

export interface ICoverage {
  departmentCodes: string[]; // 2 dígitos UBIGEO
  provinceCodes: string[];   // 4 dígitos UBIGEO
  districtCodes: string[];   // 6 dígitos UBIGEO
}

/**
 * Empresa de transporte (RF-04).
 *
 * Multi-tenancy: `municipalityId` representa la municipalidad SEDE (donde está
 * el domicilio fiscal). El alcance operativo está dado por `serviceScope` +
 * `coverage`, no por la sede. Para empresas urbano_distrital la sede coincide
 * con el único distrito en `coverage.districtCodes`.
 *
 * Unicidad nacional: el RUC SUNAT es único en todo el país (no compuesto).
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

  serviceScope: ServiceScope;
  coverage: ICoverage;
  authorizations: IAuthorization[];

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

const AuthorizationSchema = new Schema<IAuthorization>(
  {
    level: { type: String, enum: AUTHORITY_LEVELS, required: true },
    scope: { type: String, enum: SERVICE_SCOPES, required: true },
    issuedBy: { type: String, trim: true },
    resolutionNumber: { type: String, trim: true },
    issuedAt: { type: Date },
    expiresAt: { type: Date },
    documentUrl: { type: String, trim: true },
  },
  { _id: false },
);

const CoverageSchema = new Schema<ICoverage>(
  {
    departmentCodes: { type: [String], default: [] },
    provinceCodes: { type: [String], default: [] },
    districtCodes: { type: [String], default: [] },
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

    serviceScope: {
      type: String,
      enum: SERVICE_SCOPES,
      default: "urbano_distrital",
      index: true,
    },
    coverage: { type: CoverageSchema, default: () => ({}) },
    authorizations: { type: [AuthorizationSchema], default: [] },
  },
  { timestamps: true },
);

// RUC único nacional (SUNAT).
CompanySchema.index({ ruc: 1 }, { unique: true });

// Índices auxiliares para consultas por cobertura desde el super_admin.
CompanySchema.index({ serviceScope: 1, "coverage.departmentCodes": 1 });
CompanySchema.index({ "coverage.provinceCodes": 1 });
CompanySchema.index({ "coverage.districtCodes": 1 });

export const Company: Model<ICompany> =
  (mongoose.models.Company as Model<ICompany> | undefined) ||
  mongoose.model<ICompany>("Company", CompanySchema);
