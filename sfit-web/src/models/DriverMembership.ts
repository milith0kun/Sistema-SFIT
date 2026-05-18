import mongoose, { Schema, type Document, type Model } from "mongoose";

/**
 * Membresía conductor ↔ empresa. Cada vez que un operador vincula un
 * conductor a su empresa se abre una membresía con `joinedAt`. Cuando lo
 * desvincula se cierra con `leftAt` y opcional `leftReason`.
 *
 * Esto da histórico auditable de "Juan estuvo en Empresa A del 2026-02-10
 * al 2026-04-30, ahora está en Empresa B desde 2026-05-01". El campo
 * `Driver.companyId` sigue siendo la pertenencia ACTUAL (cache rápido), pero
 * la verdad histórica vive en esta colección.
 */
export type DriverMembershipLeftReason =
  | "unlinked_by_operator"
  | "left_company"
  | "fired"
  | "other";

export const DRIVER_MEMBERSHIP_LEFT_REASONS: DriverMembershipLeftReason[] = [
  "unlinked_by_operator",
  "left_company",
  "fired",
  "other",
];

export interface IDriverMembership extends Document {
  driverId: mongoose.Types.ObjectId;
  companyId: mongoose.Types.ObjectId;
  /** Municipalidad activa al momento de la vinculación (para queries scoped). */
  municipalityId: mongoose.Types.ObjectId;
  joinedAt: Date;
  /** Usuario que abrió la membresía (típicamente el operador o un admin). */
  joinedBy?: mongoose.Types.ObjectId;
  leftAt?: Date;
  leftBy?: mongoose.Types.ObjectId;
  leftReason?: DriverMembershipLeftReason;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const DriverMembershipSchema = new Schema<IDriverMembership>(
  {
    driverId: {
      type: Schema.Types.ObjectId,
      ref: "Driver",
      required: true,
      index: true,
    },
    companyId: {
      type: Schema.Types.ObjectId,
      ref: "Company",
      required: true,
      index: true,
    },
    municipalityId: {
      type: Schema.Types.ObjectId,
      ref: "Municipality",
      required: true,
      index: true,
    },
    joinedAt: { type: Date, required: true, default: Date.now },
    joinedBy: { type: Schema.Types.ObjectId, ref: "User" },
    leftAt: { type: Date },
    leftBy: { type: Schema.Types.ObjectId, ref: "User" },
    leftReason: {
      type: String,
      enum: DRIVER_MEMBERSHIP_LEFT_REASONS,
    },
    notes: { type: String, trim: true, maxlength: 500 },
  },
  { timestamps: true },
);

// Para timeline del conductor (historia laboral ordenada desc).
DriverMembershipSchema.index({ driverId: 1, joinedAt: -1 });
// Para "empresa X, conductores actualmente vinculados" (leftAt = null).
DriverMembershipSchema.index({ companyId: 1, leftAt: 1 });
// Cuando hay UNA membresía abierta por conductor (regla de negocio: 1 conductor
// en 1 sola empresa a la vez). El índice parcial solo cubre los abiertos.
DriverMembershipSchema.index(
  { driverId: 1 },
  {
    unique: true,
    partialFilterExpression: { leftAt: { $exists: false } },
    name: "driverId_open_unique",
  },
);

export const DriverMembership: Model<IDriverMembership> =
  (mongoose.models.DriverMembership as Model<IDriverMembership> | undefined) ||
  mongoose.model<IDriverMembership>("DriverMembership", DriverMembershipSchema);
