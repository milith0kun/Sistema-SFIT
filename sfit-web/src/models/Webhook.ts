import mongoose, { Schema, type Document, type Model } from "mongoose";

/**
 * Webhook de integración externa (Parte 1).
 * Permite a municipios recibir notificaciones HTTP cuando ocurren eventos del sistema.
 */
export interface IWebhook extends Document {
  municipalityId: mongoose.Types.ObjectId;
  url: string;
  events: string[];
  secret: string; // HMAC-SHA256 secret — nunca se expone en listados
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const VALID_EVENTS = [
  "inspection.created",
  "report.validated",
  "sanction.issued",
] as const;

const WebhookSchema = new Schema<IWebhook>(
  {
    municipalityId: {
      type: Schema.Types.ObjectId,
      ref: "Municipality",
      required: true,
      index: true,
    },
    url: {
      type: String,
      required: true,
      trim: true,
    },
    events: {
      type: [String],
      enum: VALID_EVENTS,
      required: true,
    },
    secret: {
      type: String,
      required: true,
      select: false, // No se expone en queries por defecto
    },
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
);

WebhookSchema.index({ municipalityId: 1, active: 1 });

export const Webhook: Model<IWebhook> =
  (mongoose.models.Webhook as Model<IWebhook> | undefined) ||
  mongoose.model<IWebhook>("Webhook", WebhookSchema);
