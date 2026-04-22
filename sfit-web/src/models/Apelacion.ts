import mongoose, { Schema, type Document, type Model } from "mongoose";

export type ApelacionStatus = "pendiente" | "aprobada" | "rechazada";

export interface IApelacion extends Document {
  inspectionId: mongoose.Types.ObjectId;
  vehicleId: mongoose.Types.ObjectId;
  municipalityId: mongoose.Types.ObjectId;
  submittedBy: mongoose.Types.ObjectId; // operador que apela
  reason: string;
  evidence: string[]; // URLs de fotos/docs
  status: ApelacionStatus;
  resolvedBy?: mongoose.Types.ObjectId;
  resolvedAt?: Date;
  resolution?: string; // comentario del revisor
  createdAt: Date;
  updatedAt: Date;
}

const ApelacionSchema = new Schema<IApelacion>(
  {
    inspectionId:   { type: Schema.Types.ObjectId, ref: "Inspection",    required: true, index: true },
    vehicleId:      { type: Schema.Types.ObjectId, ref: "Vehicle",        required: true, index: true },
    municipalityId: { type: Schema.Types.ObjectId, ref: "Municipality",   required: true, index: true },
    submittedBy:    { type: Schema.Types.ObjectId, ref: "User",           required: true, index: true },
    reason: { type: String, required: true, trim: true, maxlength: 2000 },
    evidence: { type: [String], default: [] },
    status: {
      type: String,
      enum: ["pendiente", "aprobada", "rechazada"],
      default: "pendiente",
      index: true,
    },
    resolvedBy: { type: Schema.Types.ObjectId, ref: "User" },
    resolvedAt: { type: Date },
    resolution: { type: String, trim: true, maxlength: 2000 },
  },
  { timestamps: true },
);

ApelacionSchema.index({ submittedBy: 1, status: 1 });
ApelacionSchema.index({ inspectionId: 1 }, { unique: true }); // Una apelación por inspección

export const Apelacion: Model<IApelacion> =
  (mongoose.models.Apelacion as Model<IApelacion> | undefined) ||
  mongoose.model<IApelacion>("Apelacion", ApelacionSchema);
