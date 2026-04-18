import mongoose, { Schema, type Document, type Model } from "mongoose";

export interface IChecklistResult {
  item: string;
  passed: boolean;
  notes?: string;
}

export interface IInspection extends Document {
  municipalityId: mongoose.Types.ObjectId;
  vehicleId: mongoose.Types.ObjectId;
  driverId?: mongoose.Types.ObjectId;
  fiscalId: mongoose.Types.ObjectId;
  date: Date;
  vehicleTypeKey: string;
  checklistResults: IChecklistResult[];
  score: number;
  result: "aprobada" | "observada" | "rechazada";
  observations?: string;
  evidenceUrls: string[];
  qrCode?: string;
  createdAt: Date;
  updatedAt: Date;
}

const ChecklistResultSchema = new Schema<IChecklistResult>(
  {
    item: { type: String, required: true },
    passed: { type: Boolean, required: true },
    notes: { type: String },
  },
  { _id: false },
);

const InspectionSchema = new Schema<IInspection>(
  {
    municipalityId: { type: Schema.Types.ObjectId, ref: "Municipality", required: true, index: true },
    vehicleId: { type: Schema.Types.ObjectId, ref: "Vehicle", required: true },
    driverId: { type: Schema.Types.ObjectId, ref: "Driver" },
    fiscalId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    date: { type: Date, required: true, default: Date.now },
    vehicleTypeKey: { type: String, required: true },
    checklistResults: { type: [ChecklistResultSchema], default: [] },
    score: { type: Number, required: true, min: 0, max: 100 },
    result: { type: String, enum: ["aprobada", "observada", "rechazada"], required: true },
    observations: { type: String },
    evidenceUrls: { type: [String], default: [] },
    qrCode: { type: String },
  },
  { timestamps: true },
);

InspectionSchema.index({ municipalityId: 1, date: -1 });
InspectionSchema.index({ municipalityId: 1, vehicleId: 1, date: -1 });

export const Inspection: Model<IInspection> =
  (mongoose.models.Inspection as Model<IInspection> | undefined) ||
  mongoose.model<IInspection>("Inspection", InspectionSchema);
