import mongoose, { Schema, type Document, type Model } from "mongoose";

export type ScrapingSource = "soat" | "mtc_citv" | "sunarp_vehicular";
export type ScrapingStatus = "pending" | "running" | "ok" | "error" | "not_found";

export interface IVehicleScrapingResult extends Document {
  vehicleId: mongoose.Types.ObjectId;
  plate: string;
  source: ScrapingSource;
  status: ScrapingStatus;
  rawData: Record<string, unknown> | null;
  errorMessage?: string;
  captchaCost: number;
  durationMs: number;
  screenshotS3Key?: string;
  retryCount: number;
  lastAttemptAt?: Date;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const VehicleScrapingResultSchema = new Schema<IVehicleScrapingResult>(
  {
    vehicleId: { type: Schema.Types.ObjectId, ref: "Vehicle", required: true, index: true },
    plate: { type: String, required: true, uppercase: true, trim: true },
    source: {
      type: String,
      required: true,
      enum: ["soat", "mtc_citv", "sunarp_vehicular"],
    },
    status: {
      type: String,
      required: true,
      enum: ["pending", "running", "ok", "error", "not_found"],
      default: "pending",
    },
    rawData: { type: Schema.Types.Mixed, default: null },
    errorMessage: { type: String },
    captchaCost: { type: Number, default: 0 },
    durationMs: { type: Number, default: 0 },
    screenshotS3Key: { type: String },
    retryCount: { type: Number, default: 0, min: 0, max: 3 },
    lastAttemptAt: { type: Date },
    completedAt: { type: Date },
  },
  { timestamps: true },
);

VehicleScrapingResultSchema.index({ vehicleId: 1, source: 1 }, { unique: true });
VehicleScrapingResultSchema.index({ status: 1 });

export const VehicleScrapingResult: Model<IVehicleScrapingResult> =
  (mongoose.models.VehicleScrapingResult as Model<IVehicleScrapingResult> | undefined) ||
  mongoose.model<IVehicleScrapingResult>("VehicleScrapingResult", VehicleScrapingResultSchema);
