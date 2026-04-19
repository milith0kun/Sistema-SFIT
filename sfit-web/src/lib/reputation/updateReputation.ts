import mongoose from "mongoose";
import { Vehicle } from "@/models/Vehicle";
import { Driver } from "@/models/Driver";

/** Ajusta el reputationScore de un vehículo, clampando a [0,100]. */
export async function adjustVehicleReputation(vehicleId: string | mongoose.Types.ObjectId, delta: number) {
  await Vehicle.findByIdAndUpdate(vehicleId, [
    { $set: { reputationScore: { $max: [0, { $min: [100, { $add: ["$reputationScore", delta] }] }] } } },
  ]);
}

/** Ajusta el reputationScore de un conductor, clampando a [0,100]. */
export async function adjustDriverReputation(driverId: string | mongoose.Types.ObjectId, delta: number) {
  await Driver.findByIdAndUpdate(driverId, [
    { $set: { reputationScore: { $max: [0, { $min: [100, { $add: ["$reputationScore", delta] }] }] } } },
  ]);
}
