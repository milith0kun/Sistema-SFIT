import { config } from "dotenv";
config({ path: ".env.local" });
import mongoose, { Schema, model } from "mongoose";
import dns from "dns";
dns.setServers(["8.8.8.8", "1.1.1.1", "8.8.4.4"]);

const loose = { strict: false } as const;
const User = mongoose.models.User ?? model("User", new Schema({}, loose));
const Municipality = mongoose.models.Municipality ?? model("Municipality", new Schema({}, loose));
const FleetEntry = mongoose.models.FleetEntry ?? model("FleetEntry", new Schema({}, loose));

const TARGET_MUN = "69ee4ac7a1702346aefb1c1c";

async function main() {
  await mongoose.connect(process.env.MONGODB_URI!);

  // 1. Resolver provinceId/regionId desde la municipalidad
  const muni = await Municipality.findById(TARGET_MUN).lean() as any;
  if (!muni) throw new Error(`Municipality ${TARGET_MUN} no existe`);
  console.log("Municipalidad:", muni.name, "·", muni.ubigeoCode);

  // 2. Actualizar el ciudadano de prueba con la cadena tenant
  const r = await User.updateOne(
    { email: "ciudadano@sfit.test" },
    {
      $set: {
        municipalityId: muni._id,
        provinceId: muni.provinceId ?? null,
        regionId: muni.regionId ?? null,
      },
    }
  );
  console.log(`✅ Ciudadano actualizado: matched=${r.matchedCount} modified=${r.modifiedCount}`);

  // 3. Limpiar buses con coords claramente fuera de Cusco (lat fuera del rango -14..-13)
  // Cusco está en ~lat -13.5. California (37) o cualquier dato basura se descarta.
  const cleanRes = await FleetEntry.updateMany(
    {
      status: "en_ruta",
      $or: [
        { "currentLocation.lat": { $gt: -10 } },  // California, etc.
        { "currentLocation.lat": { $lt: -20 } },
      ],
    },
    { $unset: { currentLocation: "" } }
  );
  console.log(`🧹 Limpiados ${cleanRes.modifiedCount} entries con coords fuera de Cusco.`);

  // 4. Estado final
  const ciudadano = await User.findOne({ email: "ciudadano@sfit.test" }).lean() as any;
  console.log("\nCiudadano final:");
  console.log("  municipalityId:", String(ciudadano.municipalityId));
  console.log("  provinceId:", String(ciudadano.provinceId ?? "—"));
  console.log("  regionId:", String(ciudadano.regionId ?? "—"));

  const buses = await FleetEntry.find({
    status: "en_ruta",
    municipalityId: muni._id,
    "currentLocation.lat": { $exists: true },
  }).lean() as any[];
  console.log(`\n📡 Buses transmitiendo en ${muni.name}: ${buses.length}`);

  await mongoose.disconnect();
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
