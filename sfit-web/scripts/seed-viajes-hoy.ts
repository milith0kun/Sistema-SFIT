/**
 * Seed rápido de viajes (Trips) para HOY.
 *
 * Estrategia:
 * - Si ya existen Trips: re-fecha los `startTime` al rango de HOY y
 *   diversifica el `status` (en_curso / completado / auto_cierre) para que la
 *   pantalla de Viajes muestre datos representativos.
 * - Si no hay Trips: crea 5 desde los Vehicles + Drivers + Routes existentes.
 *
 * Uso:
 *   cd sfit-web && npx tsx scripts/seed-viajes-hoy.ts
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import mongoose, { Schema, model, Types } from "mongoose";
import dns from "dns";

dns.setServers(["8.8.8.8", "1.1.1.1", "8.8.4.4"]);

const loose = { strict: false, timestamps: true } as const;

const TripModel    = mongoose.models.Trip    ?? model("Trip",    new Schema({}, loose));
const VehicleModel = mongoose.models.Vehicle ?? model("Vehicle", new Schema({}, loose));
const DriverModel  = mongoose.models.Driver  ?? model("Driver",  new Schema({}, loose));
const RouteModel   = mongoose.models.Route   ?? model("Route",   new Schema({}, loose));
const FleetModel   = mongoose.models.FleetEntry ?? model("FleetEntry", new Schema({}, loose));

type AnyDoc = { _id: Types.ObjectId; [k: string]: unknown };

function todayAt(hour: number, minute = 0): Date {
  const d = new Date();
  d.setHours(hour, minute, 0, 0);
  return d;
}

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI no definida en .env.local");

  await mongoose.connect(uri);
  console.log("✅ Conectado a MongoDB");

  // ── 1) Re-fechar Trips existentes a HOY ────────────────────────────────────
  const existing = await TripModel.find({}).sort({ _id: 1 }).lean() as AnyDoc[];

  if (existing.length > 0) {
    console.log(`Encontrados ${existing.length} Trips. Re-fechando a HOY y diversificando status…`);

    // Mezcla intencional de horarios y estados para que la pantalla luzca real.
    const updates: Array<{
      startHour: number; startMinute: number;
      endHour?: number; endMinute?: number;
      status: string;
      km: number;
      passengers: number;
    }> = [
      { startHour: 6,  startMinute: 30, endHour: 8,  endMinute: 15, status: "completado",   km: 18, passengers: 24 },
      { startHour: 7,  startMinute: 0,  endHour: 9,  endMinute: 30, status: "completado",   km: 32, passengers: 41 },
      { startHour: 8,  startMinute: 45,                              status: "en_curso",     km: 12, passengers: 18 },
      { startHour: 9,  startMinute: 15, endHour: 11, endMinute: 0,  status: "auto_cierre",  km: 22, passengers: 8  },
      { startHour: 10, startMinute: 0,                               status: "en_curso",     km: 7,  passengers: 12 },
      { startHour: 11, startMinute: 30, endHour: 13, endMinute: 45, status: "completado",   km: 28, passengers: 33 },
      { startHour: 13, startMinute: 0,                               status: "en_curso",     km: 5,  passengers: 9  },
    ];

    for (let i = 0; i < existing.length; i++) {
      const u = updates[i % updates.length];
      const start = todayAt(u.startHour, u.startMinute);
      const end = u.endHour != null ? todayAt(u.endHour, u.endMinute ?? 0) : undefined;
      const set: Record<string, unknown> = {
        startTime: start,
        status: u.status,
        km: u.km,
        passengers: u.passengers,
      };
      if (end) {
        set.endTime = end;
        set.closedAt = end;
      } else {
        // En curso → quitar endTime previo si lo había
        set.endTime = null;
        set.closedAt = null;
      }
      if (u.status === "auto_cierre") {
        set.autoClosedReason = "Cierre automático por superar el horario máximo de retorno";
      } else {
        set.autoClosedReason = null;
      }
      await TripModel.updateOne({ _id: existing[i]._id }, { $set: set });
    }
    console.log(`✅ ${existing.length} Trips actualizados con fecha HOY.`);
  } else {
    // ── 2) No hay Trips: crear nuevos desde vehículos + conductores ──────────
    console.log("No hay Trips. Creando 5 nuevos desde vehículos y conductores existentes…");

    const [vehicles, drivers, routes, fleetEntries] = await Promise.all([
      VehicleModel.find({}).limit(5).lean() as Promise<AnyDoc[]>,
      DriverModel.find({}).limit(5).lean() as Promise<AnyDoc[]>,
      RouteModel.find({}).limit(5).lean() as Promise<AnyDoc[]>,
      FleetModel.find({}).limit(5).lean() as Promise<AnyDoc[]>,
    ]);

    if (vehicles.length === 0 || drivers.length === 0) {
      console.error("❌ No hay vehículos o conductores. Ejecuta seed-full-data.ts primero.");
      process.exit(1);
    }

    const seedData = [
      { startHour: 6,  startMinute: 30, endHour: 8,  endMinute: 15, status: "completado",  km: 18, passengers: 24 },
      { startHour: 7,  startMinute: 0,  endHour: 9,  endMinute: 30, status: "completado",  km: 32, passengers: 41 },
      { startHour: 8,  startMinute: 45,                              status: "en_curso",    km: 12, passengers: 18 },
      { startHour: 9,  startMinute: 15, endHour: 11, endMinute: 0,  status: "auto_cierre", km: 22, passengers: 8  },
      { startHour: 10, startMinute: 0,                               status: "en_curso",    km: 7,  passengers: 12 },
    ];

    for (let i = 0; i < Math.min(5, vehicles.length); i++) {
      const v = vehicles[i];
      const d = drivers[i % drivers.length];
      const r = routes[i % Math.max(1, routes.length)];
      const fe = fleetEntries[i % Math.max(1, fleetEntries.length)];
      const sd = seedData[i];

      const municipalityId =
        (v.municipalityId as Types.ObjectId | undefined) ??
        (d.municipalityId as Types.ObjectId | undefined);
      if (!municipalityId) {
        console.warn(`⚠️ Vehículo ${v._id} sin municipalityId — saltando.`);
        continue;
      }

      const start = todayAt(sd.startHour, sd.startMinute);
      const end = sd.endHour != null ? todayAt(sd.endHour, sd.endMinute ?? 0) : undefined;

      await TripModel.create({
        municipalityId,
        vehicleId: v._id,
        driverId: d._id,
        routeId: r?._id,
        fleetEntryId: fe?._id,
        startTime: start,
        endTime: end,
        km: sd.km,
        passengers: sd.passengers,
        status: sd.status,
        closedAt: end,
        autoClosedReason: sd.status === "auto_cierre"
          ? "Cierre automático por superar el horario máximo de retorno"
          : undefined,
      });
    }
    console.log("✅ 5 Trips creados con fecha HOY.");
  }

  await mongoose.disconnect();
  console.log("✅ Listo. Recarga /viajes en el navegador.");
}

main().catch(err => {
  console.error("❌ Error:", err);
  process.exit(1);
});
