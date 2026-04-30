import mongoose, { Schema, type Document, type Model } from "mongoose";

export interface IReportApoyo extends Document {
  reportId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  createdAt: Date;
}

const ReportApoyoSchema = new Schema<IReportApoyo>(
  {
    reportId: { type: Schema.Types.ObjectId, ref: "CitizenReport", required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

ReportApoyoSchema.index({ reportId: 1, userId: 1 }, { unique: true });

export const ReportApoyo: Model<IReportApoyo> =
  (mongoose.models.ReportApoyo as Model<IReportApoyo> | undefined) ||
  mongoose.model<IReportApoyo>("ReportApoyo", ReportApoyoSchema);
