import mongoose, { Schema, type Document, type Model } from "mongoose";

export interface IGpsPoint {
  lat: number;
  lng: number;
}

export interface ICurrentLocation extends IGpsPoint {
  updatedAt: Date;
}

export interface IFleetEntry extends Document {
  municipalityId: mongoose.Types.ObjectId;
  date: Date;
  vehicleId: mongoose.Types.ObjectId;
  routeId?: mongoose.Types.ObjectId;
  driverId: mongoose.Types.ObjectId;
  departureTime?: string;
  returnTime?: string;
  km: number;
  status: "disponible" | "en_ruta" | "cerrado" | "auto_cierre" | "mantenimiento" | "fuera_de_servicio";
  observations?: string;
  checklistComplete: boolean;
  registeredBy: mongoose.Types.ObjectId;
  currentLocation?: ICurrentLocation;
  startLocation?: IGpsPoint;
  endLocation?: IGpsPoint;
  createdAt: Date;
  updatedAt: Date;
}

const FleetEntrySchema = new Schema<IFleetEntry>(
  {
    municipalityId: { type: Schema.Types.ObjectId, ref: "Municipality", required: true, index: true },
    date: { type: Date, required: true, index: true },
    vehicleId: { type: Schema.Types.ObjectId, ref: "Vehicle", required: true },
    routeId: { type: Schema.Types.ObjectId, ref: "Route" },
    driverId: { type: Schema.Types.ObjectId, ref: "Driver", required: true },
    departureTime: { type: String },
    returnTime: { type: String },
    km: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ["disponible", "en_ruta", "cerrado", "auto_cierre", "mantenimiento", "fuera_de_servicio"],
      default: "disponible",
    },
    observations: { type: String },
    checklistComplete: { type: Boolean, default: false },
    registeredBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    currentLocation: {
      lat: { type: Number },
      lng: { type: Number },
      updatedAt: { type: Date },
    },
    startLocation: {
      lat: { type: Number },
      lng: { type: Number },
    },
    endLocation: {
      lat: { type: Number },
      lng: { type: Number },
    },
  },
  { timestamps: true },
);

FleetEntrySchema.index({ municipalityId: 1, date: 1 });
FleetEntrySchema.index({ municipalityId: 1, vehicleId: 1, date: 1 });

export const FleetEntry: Model<IFleetEntry> =
  (mongoose.models.FleetEntry as Model<IFleetEntry> | undefined) ||
  mongoose.model<IFleetEntry>("FleetEntry", FleetEntrySchema);
