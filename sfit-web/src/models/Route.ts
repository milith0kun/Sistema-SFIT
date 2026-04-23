import mongoose, { Schema, type Document, type Model } from "mongoose";

export interface IWaypoint {
  order: number;
  lat: number;
  lng: number;
  label?: string;
}

export interface IRoute extends Document {
  municipalityId: mongoose.Types.ObjectId;
  code: string;
  name: string;
  type: "ruta" | "zona";
  stops?: number;
  length?: string;
  area?: string;
  vehicleTypeKey?: string;
  companyId?: mongoose.Types.ObjectId;
  vehicleCount: number;
  status: "activa" | "suspendida";
  frequencies?: string[];
  waypoints: IWaypoint[];
  createdAt: Date;
  updatedAt: Date;
}

const WaypointSchema = new Schema<IWaypoint>(
  {
    order: { type: Number, required: true },
    lat:   { type: Number, required: true },
    lng:   { type: Number, required: true },
    label: { type: String },
  },
  { _id: false },
);

const RouteSchema = new Schema<IRoute>(
  {
    municipalityId: { type: Schema.Types.ObjectId, ref: "Municipality", required: true, index: true },
    code: { type: String, required: true, trim: true },
    name: { type: String, required: true, trim: true },
    type: { type: String, enum: ["ruta", "zona"], default: "ruta" },
    stops: { type: Number },
    length: { type: String },
    area: { type: String },
    vehicleTypeKey: { type: String },
    companyId: { type: Schema.Types.ObjectId, ref: "Company" },
    vehicleCount: { type: Number, default: 0 },
    status: { type: String, enum: ["activa", "suspendida"], default: "activa" },
    frequencies: { type: [String], default: [] },
    waypoints: { type: [WaypointSchema], default: [] },
  },
  { timestamps: true },
);

RouteSchema.index({ municipalityId: 1, code: 1 }, { unique: true });

export const Route: Model<IRoute> =
  (mongoose.models.Route as Model<IRoute> | undefined) ||
  mongoose.model<IRoute>("Route", RouteSchema);
