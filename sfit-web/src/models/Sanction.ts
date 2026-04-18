import mongoose, { Schema, type Document, type Model } from "mongoose";

export interface ISanctionNotification {
  channel: "email" | "whatsapp" | "push";
  target: string;
  status: "enviado" | "entregado" | "leido" | "pendiente";
  sentAt?: Date;
}

export interface ISanction extends Document {
  municipalityId: mongoose.Types.ObjectId;
  vehicleId: mongoose.Types.ObjectId;
  driverId?: mongoose.Types.ObjectId;
  companyId?: mongoose.Types.ObjectId;
  reportId?: mongoose.Types.ObjectId;
  inspectionId?: mongoose.Types.ObjectId;
  faultType: string;
  amountSoles: number;
  amountUIT: string;
  status: "emitida" | "notificada" | "apelada" | "confirmada" | "anulada";
  notifications: ISanctionNotification[];
  appealNotes?: string;
  resolvedAt?: Date;
  issuedBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const NotificationSchema = new Schema<ISanctionNotification>(
  {
    channel: { type: String, enum: ["email", "whatsapp", "push"], required: true },
    target: { type: String, required: true },
    status: {
      type: String,
      enum: ["enviado", "entregado", "leido", "pendiente"],
      default: "pendiente",
    },
    sentAt: { type: Date },
  },
  { _id: false },
);

const SanctionSchema = new Schema<ISanction>(
  {
    municipalityId: { type: Schema.Types.ObjectId, ref: "Municipality", required: true, index: true },
    vehicleId: { type: Schema.Types.ObjectId, ref: "Vehicle", required: true },
    driverId: { type: Schema.Types.ObjectId, ref: "Driver" },
    companyId: { type: Schema.Types.ObjectId, ref: "Company" },
    reportId: { type: Schema.Types.ObjectId, ref: "CitizenReport" },
    inspectionId: { type: Schema.Types.ObjectId, ref: "Inspection" },
    faultType: { type: String, required: true, trim: true },
    amountSoles: { type: Number, required: true, min: 0 },
    amountUIT: { type: String, required: true },
    status: {
      type: String,
      enum: ["emitida", "notificada", "apelada", "confirmada", "anulada"],
      default: "emitida",
    },
    notifications: { type: [NotificationSchema], default: [] },
    appealNotes: { type: String },
    resolvedAt: { type: Date },
    issuedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true },
);

SanctionSchema.index({ municipalityId: 1, status: 1, createdAt: -1 });
SanctionSchema.index({ municipalityId: 1, vehicleId: 1 });

export const Sanction: Model<ISanction> =
  (mongoose.models.Sanction as Model<ISanction> | undefined) ||
  mongoose.model<ISanction>("Sanction", SanctionSchema);
