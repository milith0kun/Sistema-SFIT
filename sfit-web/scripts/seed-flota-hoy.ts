/**
 * Seed rápido de flota para HOY.
 *
 * Pone fecha = hoy en todos los FleetEntries existentes (los del último día con
 * datos), de modo que la pantalla "Flota del día" muestre algo sin tener que
 * volver a correr el seed completo.
 *
 * Si no encuentra ningún FleetEntry, crea 3 entries básicos a partir de los
 * vehículos + conductores existentes (variedad de status: en_ruta, disponible,
 * mantenimiento) para que el dashboard se vea poblado.
 *
 * Uso:
 *   cd sfit-web && npx tsx scripts/seed-flota-hoy.ts
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import mongoose, { Schema, model, Types } from "mongoose";
import dns from "dns";

dns.setServers(["8.8.8.8", "1.1.1.1", "8.8.4.4"]);

const loose = { strict: false, timestamps: true } as const;

const FleetEntryModel = mongoose.models.FleetEntry ?? model("FleetEntry", new Schema({}, loose));
const VehicleModel    = mongoose.models.Vehicle    ?? model("Vehicle",    new Schema({}, loose));
const DriverModel     = mongoose.models.Driver     ?? model("Driver",     new Schema({}, loose));
const RouteModel      = mongoose.models.Route      ?? model("Route",      new Schema({}, loose));
const UserModel       = mongoose.models.User       ?? model("User",       new Schema({}, loose));

type AnyDoc = { _id: Types.ObjectId; [k: string]: unknown };

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI no definida en .env.local");

  await mongoose.connect(uri);
  console.log("✅ Conectado a MongoDB");

  // Hoy con hora 00:00:00 (igual al filtro del endpoint /api/flota).
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // ── Estrategia 1: re-fechar FleetEntries existentes a HOY ──────────────────
  const existing = await FleetEntryModel.find({}).lean();
  if (existing.length > 0) {
    console.log(`Encontrados ${existing.length} FleetEntries existentes. Actualizando fecha a HOY…`);
    const result = await FleetEntryModel.updateMany({}, { $set: { date: today } });
    console.log(`✅ ${result.modifiedCount} entries re-fechados.`);

    // Garantizar que haya variedad de status (al menos 1 en_ruta, 1 disponible, 1 mantenimiento)
    const allEntries = await FleetEntryModel.find({}).sort({ _id: 1 }).limit(6).lean() as AnyDoc[];
    const desiredStatuses = ["disponible", "en_ruta", "en_ruta", "mantenimiento", "disponible", "fuera_de_servicio"];
    for (let i = 0; i < allEntries.length; i++) {
      const status = desiredStatuses[i] ?? "disponible";
      await FleetEntryModel.updateOne(
        { _id: allEntries[i]._id },
        { $set: { status, departureTime: status === "en_ruta" ? "07:00" : status === "disponible" ? "06:30" : undefined, returnTime: status === "en_ruta" ? undefined : "12:30" } }
      );
    }
    console.log(`✅ ${Math.min(allEntries.length, desiredStatuses.length)} entries con status diversificado.`);
  } else {
    // ── Estrategia 2: crear 3 entries nuevos desde vehículos + conductores existentes ──
    console.log("No hay FleetEntries. Creando 3 nuevos desde vehículos y conductores existentes…");

    const [vehicles, drivers, routes, anyUser] = await Promise.all([
      VehicleModel.find({}).limit(3).lean() as Promise<AnyDoc[]>,
      DriverModel.find({}).limit(3).lean() as Promise<AnyDoc[]>,
      RouteModel.find({}).limit(3).lean() as Promise<AnyDoc[]>,
      UserModel.findOne({}).lean() as Promise<AnyDoc | null>,
    ]);

    if (vehicles.length === 0 || drivers.length === 0) {
      console.error("❌ No hay vehículos o conductores. Ejecuta seed-full-data.ts primero.");
      process.exit(1);
    }

    const seedData = [
      { status: "disponible",   departureTime: "06:30", km: 0  },
      { status: "en_ruta",      departureTime: "07:15", km: 12 },
      { status: "mantenimiento" as const, departureTime: undefined, km: 0 },
    ];

    for (let i = 0; i < Math.min(3, vehicles.length); i++) {
      const vehicle = vehicles[i];
      const driver  = drivers[i % drivers.length];
      const route   = routes[i % Math.max(1, routes.length)];
      const sd      = seedData[i];

      // municipalityId — tomamos el del vehículo si lo tiene, sino el del driver
      const municipalityId =
        (vehicle.municipalityId as Types.ObjectId | undefined) ??
        (driver.municipalityId as Types.ObjectId | undefined);
      if (!municipalityId) {
        console.warn(`⚠️ Vehículo ${vehicle._id} sin municipalityId — saltando.`);
        continue;
      }

      await FleetEntryModel.findOneAndUpdate(
        { municipalityId, vehicleId: vehicle._id, date: today },
        {
          $set: {
            vehicleId: vehicle._id,
            driverId: driver._id,
            routeId: route?._id,
            municipalityId,
            date: today,
            departureTime: sd.departureTime,
            km: sd.km,
            status: sd.status,
            checklistComplete: true,
            registeredBy: anyUser?._id,
          },
        },
        { upsert: true, returnDocument: "after" }
      );
    }
    console.log("✅ 3 FleetEntries creados con fecha HOY.");
  }

  await mongoose.disconnect();
  console.log("✅ Listo. Recarga /flota en el navegador.");
}

main().catch(err => {
  console.error("❌ Error:", err);
  process.exit(1);
});
