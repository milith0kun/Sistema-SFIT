import mongoose, { Schema, type Document, type Model } from "mongoose";

/**
 * Registro de auditoría (RNF-16).
 * Acciones críticas quedan trazadas con actor, rol, tenant e IP.
 * Inmutable: sin `updatedAt` relevante; sólo `createdAt`.
 */
export interface IAuditLog extends Document {
  actorId: mongoose.Types.ObjectId;
  actorRole: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  municipalityId?: mongoose.Types.ObjectId;
  provinceId?: mongoose.Types.ObjectId;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  createdAt: Date;
}

const AuditLogSchema = new Schema<IAuditLog>(
  {
    actorId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    actorRole: { type: String, required: true },
    action: { type: String, required: true, trim: true },
    resourceType: { type: String, required: true, trim: true },
    resourceId: { type: String },
    municipalityId: {
      type: Schema.Types.ObjectId,
      ref: "Municipality",
      index: true,
    },
    provinceId: {
      type: Schema.Types.ObjectId,
      ref: "Province",
      index: true,
    },
    metadata: { type: Schema.Types.Mixed },
    ipAddress: { type: String },
    userAgent: { type: String },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

// Índices para consultas habituales.
AuditLogSchema.index({ createdAt: -1 });
AuditLogSchema.index({ actorId: 1, createdAt: -1 });
AuditLogSchema.index({ action: 1, createdAt: -1 });

export const AuditLog: Model<IAuditLog> =
  (mongoose.models.AuditLog as Model<IAuditLog> | undefined) ||
  mongoose.model<IAuditLog>("AuditLog", AuditLogSchema);
