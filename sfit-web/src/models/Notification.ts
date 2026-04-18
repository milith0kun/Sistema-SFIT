import mongoose, { Schema, type Document, type Model } from "mongoose";

/**
 * Tipos de notificación (RF-18).
 */
export const NOTIFICATION_TYPES = [
  "info",
  "success",
  "warning",
  "error",
  "action_required",
] as const;

export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

/**
 * Categoría funcional de la notificación. Permite filtrar por módulo de origen.
 */
export const NOTIFICATION_CATEGORIES = [
  "sistema",
  "aprobacion",
  "sancion",
  "fatiga",
  "reporte",
  "canje",
  "asignacion",
  "otro",
] as const;

export type NotificationCategory = (typeof NOTIFICATION_CATEGORIES)[number];

/**
 * Notificación dirigida a un usuario (RF-18-01 / RF-18-02).
 * Se consume desde el panel web (bandeja) y la app móvil (push).
 */
export interface INotification extends Document {
  userId: mongoose.Types.ObjectId;
  title: string;
  body: string;
  type: NotificationType;
  category: NotificationCategory;
  link?: string;
  metadata?: Record<string, unknown>;
  readAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const NotificationSchema = new Schema<INotification>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    title: { type: String, required: true, trim: true },
    body: { type: String, required: true },
    type: {
      type: String,
      enum: NOTIFICATION_TYPES,
      default: "info",
    },
    category: {
      type: String,
      enum: NOTIFICATION_CATEGORIES,
      default: "otro",
    },
    link: { type: String },
    metadata: { type: Schema.Types.Mixed },
    readAt: { type: Date },
  },
  { timestamps: true },
);

// Índices para bandeja y conteo de no leídas.
NotificationSchema.index({ userId: 1, readAt: 1 });
NotificationSchema.index({ userId: 1, createdAt: -1 });

export const Notification: Model<INotification> =
  (mongoose.models.Notification as Model<INotification> | undefined) ||
  mongoose.model<INotification>("Notification", NotificationSchema);
