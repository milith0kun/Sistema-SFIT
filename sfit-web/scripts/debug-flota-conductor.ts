/**
 * Diagnóstico: por qué el conductor ve flota vacía aunque hay entries.
 */
import { config } from "dotenv";
config({ path: ".env.local" });
import mongoose, { Schema, model, Types } from "mongoose";
import dns from "dns";
dns.setServers(["8.8.8.8", "1.1.1.1", "8.8.4.4"]);

const loose = { strict: false } as const;
const UserModel       = mongoose.models.User       ?? model("User",       new Schema({}, loose));
const DriverModel     = mongoose.models.Driver     ?? model("Driver",     new Schema({}, loose));
const FleetEntryModel = mongoose.models.FleetEntry ?? model("FleetEntry", new Schema({}, loose));

async function main() {
  await mongoose.connect(process.env.MONGODB_URI!);

  const condUser = await UserModel.findOne({ email: "conductor@sfit.test" }).lean<{ _id: Types.ObjectId }>();
  console.log("User._id:", condUser?._id.toString());

  const driver = await DriverModel.findOne({ userId: condUser!._id }).lean<{ _id: Types.ObjectId; userId?: Types.ObjectId }>();
  console.log("Driver._id:", driver?._id.toString(), "Driver.userId:", driver?.userId?.toString());

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
  console.log("Today filter:", today.toISOString(), "→", tomorrow.toISOString());

  const allDriverEntries = await FleetEntryModel.find({ driverId: driver!._id }).select("_id date status").lean<Array<{ _id: Types.ObjectId; date?: Date; status?: string }>>();
  console.log(`Total entries del driver: ${allDriverEntries.length}`);
  for (const e of allDriverEntries) {
    console.log(`  - ${e._id} date=${e.date?.toISOString() ?? "NO DATE"} status=${e.status ?? "?"}`);
  }

  const todayEntries = await FleetEntryModel.find({
    driverId: driver!._id,
    date: { $gte: today, $lt: tomorrow },
  }).select("_id date").lean();
  console.log(`Entries de HOY (con filtro $gte/$lt): ${todayEntries.length}`);

  // Sin filtro de date
  const todayEntriesNoFilter = await FleetEntryModel.countDocuments({ driverId: driver!._id });
  console.log(`Total entries sin filtro fecha: ${todayEntriesNoFilter}`);

  await mongoose.disconnect();
}

main().catch(async (e) => { console.error(e); await mongoose.disconnect(); process.exit(1); });
