import { config } from "dotenv";
config({ path: ".env.local" });
import mongoose, { Schema, model } from "mongoose";
import dns from "dns";
dns.setServers(["8.8.8.8", "1.1.1.1", "8.8.4.4"]);

const loose = { strict: false } as const;
const User = mongoose.models.User ?? model("User", new Schema({}, loose));
const FleetEntry = mongoose.models.FleetEntry ?? model("FleetEntry", new Schema({}, loose));

async function main() {
  await mongoose.connect(process.env.MONGODB_URI!);

  const ciudadano = await User.findOne({ email: "ciudadano@sfit.test" }).lean() as any;
  console.log("=== Usuario ciudadano ===");
  console.log("  email:", ciudadano?.email);
  console.log("  role:", ciudadano?.role);
  console.log("  municipalityId:", String(ciudadano?.municipalityId ?? "null"));
  console.log("  provinceId:", String(ciudadano?.provinceId ?? "null"));
  console.log("  regionId:", String(ciudadano?.regionId ?? "null"));
  console.log("  status:", ciudadano?.status);

  console.log("\n=== Buses en_ruta con currentLocation ===");
  const buses = await FleetEntry.find({
    status: "en_ruta",
    "currentLocation.lat": { $exists: true },
  }).lean() as any[];
  console.log(`  count: ${buses.length}`);
  for (const b of buses) {
    console.log(`  - mun=${String(b.municipalityId)} route=${String(b.routeId)} loc=${b.currentLocation?.lat},${b.currentLocation?.lng}`);
  }

  console.log("\n=== ¿Coinciden? ===");
  const userMun = String(ciudadano?.municipalityId ?? "");
  const matchingBuses = buses.filter((b) => String(b.municipalityId) === userMun);
  console.log(`  Buses en municipalityId del ciudadano: ${matchingBuses.length}`);
  if (matchingBuses.length === 0 && buses.length > 0) {
    const recommendedMun = String(buses[0].municipalityId);
    console.log(`\n  ⚠️  El ciudadano NO tiene la misma municipalityId que los buses.`);
    console.log(`  Para arreglar: actualizar el ciudadano con municipalityId=${recommendedMun}`);
  }

  await mongoose.disconnect();
}
main().catch(console.error);
