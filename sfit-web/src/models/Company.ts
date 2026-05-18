import mongoose, { Schema, type Document, type Model } from "mongoose";

/**
 * Modalidad de servicio simplificada para Cotabambas (mono-muni administrativo).
 *
 *  - urbano         : rutas dentro de los 6 distritos de la provincia (incluye
 *                     lo que antes era `urbano_distrital` + `urbano_provincial`).
 *                     Autoridad: municipalidad provincial.
 *  - interprovincial: rutas a otras provincias/regiones (Cusco, Abancay,
 *                     Arequipa). Incluye lo que antes era
 *                     `interprovincial_regional` + `interregional_nacional`.
 *                     Autoridad: gobierno regional o MTC, según corresponda.
 *
 * El campo `Authorization.level` mantiene la distinción legal de la entidad
 * emisora (municipal/regional/MTC); el `serviceScope` solo describe la
 * cobertura operativa.
 */
export type ServiceScope = "urbano" | "interprovincial";

export const SERVICE_SCOPES: ServiceScope[] = ["urbano", "interprovincial"];

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
 * `coverage`, no por la sede. Para empresas `urbano` la sede coincide con
 * uno de los distritos en `coverage.districtCodes`.
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
  /**
   * Sello de aprobación administrativa. Cuando un operador crea la empresa
   * vía autoservicio (`POST /api/operador/crear-empresa`) queda con
   * `active: false` y `approvedAt: undefined`. El admin_municipal la aprueba
   * desde el centro de aprobaciones (`POST /api/empresas/[id]/aprobar`),
   * lo que setea `active: true`, `approvedAt: now`, `approvedBy: adminId`.
   * Sin estos campos no se sabe cuándo ni quién aprobó.
   */
  approvedAt?: Date;
  approvedBy?: mongoose.Types.ObjectId;
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
    approvedAt: { type: Date },
    approvedBy: { type: Schema.Types.ObjectId, ref: "User" },
    reputationScore: { type: Number, default: 100, min: 0, max: 100 },

    serviceScope: {
      type: String,
      enum: SERVICE_SCOPES,
      default: "urbano",
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
