import mongoose, { Schema, type Document, type Model } from "mongoose";

/**
 * Registro auto-servicio del ciudadano a un viaje interprovincial.
 *
 * El ciudadano escanea el QR del bus o ingresa su placa, y el sistema:
 *   1. Si hay un Trip "en_curso"/"aceptado" sobre ese `vehicleId`, lo asocia.
 *   2. Si NO hay Trip, crea uno "auto" con `driverId=null` que el conductor
 *      podrá adoptar cuando inicie su turno desde la app.
 *
 * Se mantiene separado del `Passenger` porque:
 *   - `Passenger` representa lista nominal exigida por normativa (DNI, asiento)
 *     y la firma el conductor/operador en una sola transacción.
 *   - `CitizenTripRegistration` representa la INTENCIÓN del ciudadano de
 *     seguir el viaje. Puede no haber `Passenger` cuando todavía no ingresó
 *     al manifiesto, o el `Passenger` puede compartirse con varios registros
 *     (familia con un solo `documentNumber` titular).
 *
 * El ciudadano puede finalizar su propio registro sin terminar el viaje
 * completo (puede haber otros pasajeros aún a bordo).
 */
export type CitizenTripRegistrationVia = "qr" | "plate";
export type CitizenTripRegistrationEndReason =
  | "by_citizen"   // El ciudadano marcó "Finalizar viaje" desde su app
  | "by_driver"    // El conductor cerró el viaje y arrastró todos los registros
  | "auto";        // Cierre automático por inactividad (>6h sin GPS, etc.)

export interface ICitizenTripRegistration extends Document {
  userId: mongoose.Types.ObjectId;
  vehicleId: mongoose.Types.ObjectId;
  tripId?: mongoose.Types.ObjectId;
  passengerId?: mongoose.Types.ObjectId;
  municipalityId?: mongoose.Types.ObjectId;
  registeredVia: CitizenTripRegistrationVia;
  boardedAt: Date;
  endedAt?: Date;
  endReason?: CitizenTripRegistrationEndReason;
  /** Si la posición del ciudadano se verificó vs la del bus al registrarse. */
  geoVerified?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const CitizenTripRegistrationSchema = new Schema<ICitizenTripRegistration>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    vehicleId: {
      type: Schema.Types.ObjectId,
      ref: "Vehicle",
      required: true,
      index: true,
    },
    tripId: {
      type: Schema.Types.ObjectId,
      ref: "Trip",
      index: true,
    },
    passengerId: { type: Schema.Types.ObjectId, ref: "Passenger" },
    municipalityId: { type: Schema.Types.ObjectId, ref: "Municipality" },
    registeredVia: {
      type: String,
      enum: ["qr", "plate"],
      required: true,
    },
    boardedAt: { type: Date, required: true, default: Date.now },
    endedAt: { type: Date },
    endReason: {
      type: String,
      enum: ["by_citizen", "by_driver", "auto"],
    },
    geoVerified: { type: Boolean, default: false },
  },
  { timestamps: true },
);

// Un mismo ciudadano no puede tener 2 registros activos sobre el mismo
// vehículo (evita doble click al escanear el QR).
CitizenTripRegistrationSchema.index(
  { userId: 1, vehicleId: 1, endedAt: 1 },
  {
    unique: true,
    partialFilterExpression: { endedAt: { $exists: false } },
  },
);
// Para la query "¿hay registros activos en este viaje?" del auto-close.
CitizenTripRegistrationSchema.index({ tripId: 1, endedAt: 1 });

export const CitizenTripRegistration: Model<ICitizenTripRegistration> =
  (mongoose.models.CitizenTripRegistration as
    | Model<ICitizenTripRegistration>
    | undefined) ||
  mongoose.model<ICitizenTripRegistration>(
    "CitizenTripRegistration",
    CitizenTripRegistrationSchema,
  );
