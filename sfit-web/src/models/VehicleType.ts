import mongoose, { Schema, type Document, type Model } from "mongoose";

/**
 * Tipo de campo del formulario de inspección (RF-03-04).
 */
export type InspectionFieldType = "boolean" | "scale" | "text";

export interface IInspectionField {
  key: string;
  label: string;
  type: InspectionFieldType;
}

/**
 * Tipo de vehículo configurable por municipalidad (RF-03).
 * Los predefinidos se instancian por tenant al activarse (RF-03-01) y los
 * personalizados se crean por el Admin Municipal (RF-03-02). Nunca se
 * comparten entre tenants (Restricción — sección 9).
 */
export interface IVehicleType extends Document {
  municipalityId: mongoose.Types.ObjectId;
  key: string;
  name: string;
  description: string;
  icon?: string;
  checklistItems: string[];
  inspectionFields: IInspectionField[];
  reportCategories: string[];
  isCustom: boolean;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const InspectionFieldSchema = new Schema<IInspectionField>(
  {
    key: { type: String, required: true, trim: true },
    label: { type: String, required: true, trim: true },
    type: {
      type: String,
      enum: ["boolean", "scale", "text"],
      required: true,
    },
  },
  { _id: false },
);

const VehicleTypeSchema = new Schema<IVehicleType>(
  {
    municipalityId: {
      type: Schema.Types.ObjectId,
      ref: "Municipality",
      required: true,
      index: true,
    },
    key: { type: String, required: true, trim: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    icon: { type: String },
    checklistItems: { type: [String], default: [] },
    inspectionFields: { type: [InspectionFieldSchema], default: [] },
    reportCategories: { type: [String], default: [] },
    isCustom: { type: Boolean, default: false },
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
);

// RF-03-01 / RF-03-02: key único dentro de la municipalidad
VehicleTypeSchema.index({ municipalityId: 1, key: 1 }, { unique: true });

export const VehicleType: Model<IVehicleType> =
  (mongoose.models.VehicleType as Model<IVehicleType> | undefined) ||
  mongoose.model<IVehicleType>("VehicleType", VehicleTypeSchema);
