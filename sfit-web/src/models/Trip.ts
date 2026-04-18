import mongoose, { Schema, type Document, type Model } from "mongoose";

export interface ITrip extends Document {
  municipalityId: mongoose.Types.ObjectId;
  vehicleId: mongoose.Types.ObjectId;
  driverId: mongoose.Types.ObjectId;
  routeId?: mongoose.Types.ObjectId;
  fleetEntryId?: mongoose.Types.ObjectId;
  startTime: Date;
  endTime?: Date;
  km: number;
  passengers: number;
  status: "en_curso" | "completado" | "auto_cierre";
  createdAt: Date;
  updatedAt: Date;
}

const TripSchema = new Schema<ITrip>(
  {
    municipalityId: { type: Schema.Types.ObjectId, ref: "Municipality", required: true, index: true },
    vehicleId: { type: Schema.Types.ObjectId, ref: "Vehicle", required: true },
    driverId: { type: Schema.Types.ObjectId, ref: "Driver", required: true },
    routeId: { type: Schema.Types.ObjectId, ref: "Route" },
    fleetEntryId: { type: Schema.Types.ObjectId, ref: "FleetEntry" },
    startTime: { type: Date, required: true },
    endTime: { type: Date },
    km: { type: Number, default: 0 },
    passengers: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ["en_curso", "completado", "auto_cierre"],
      default: "en_curso",
    },
  },
  { timestamps: true },
);

TripSchema.index({ municipalityId: 1, startTime: -1 });
TripSchema.index({ municipalityId: 1, status: 1 });

export const Trip: Model<ITrip> =
  (mongoose.models.Trip as Model<ITrip> | undefined) ||
  mongoose.model<ITrip>("Trip", TripSchema);
