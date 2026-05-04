import mongoose, { Schema, type Document, type Model } from "mongoose";

/**
 * Pasajero de un viaje interprovincial.
 *
 * Para servicios urbano_distrital / urbano_provincial el manifiesto se reduce
 * a un contador (Trip.passengers). Para interprovincial_regional /
 * interregional_nacional la normativa exige una lista nominal con DNI.
 */
export type PassengerDocumentType = "DNI" | "CE" | "PASSPORT";

export interface IEmergencyContact {
  name: string;
  phone: string;
}

export interface IPassenger extends Document {
  tripId: mongoose.Types.ObjectId;
  fullName: string;
  documentNumber: string;
  documentType: PassengerDocumentType;
  seatNumber?: string;
  origin?: string;
  destination?: string;
  phone?: string;
  emergencyContact?: IEmergencyContact;
  boardedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const EmergencyContactSchema = new Schema<IEmergencyContact>(
  {
    name: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
  },
  { _id: false },
);

const PassengerSchema = new Schema<IPassenger>(
  {
    tripId: {
      type: Schema.Types.ObjectId,
      ref: "Trip",
      required: true,
      index: true,
    },
    fullName: { type: String, required: true, trim: true },
    documentNumber: { type: String, required: true, trim: true, index: true },
    documentType: {
      type: String,
      enum: ["DNI", "CE", "PASSPORT"],
      default: "DNI",
    },
    seatNumber: { type: String, trim: true },
    origin: { type: String, trim: true },
    destination: { type: String, trim: true },
    phone: { type: String, trim: true },
    emergencyContact: { type: EmergencyContactSchema },
    boardedAt: { type: Date },
  },
  { timestamps: true },
);

// Evita duplicar el mismo documento dentro de un mismo viaje.
PassengerSchema.index({ tripId: 1, documentNumber: 1 }, { unique: true });

export const Passenger: Model<IPassenger> =
  (mongoose.models.Passenger as Model<IPassenger> | undefined) ||
  mongoose.model<IPassenger>("Passenger", PassengerSchema);
