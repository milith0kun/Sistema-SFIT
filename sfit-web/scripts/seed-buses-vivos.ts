/**
 * Seed de buses TRANSMITIENDO en vivo.
 *
 * Toma todos los `FleetEntry` con `status=en_ruta` (los crea si no existen) y
 * les inyecta:
 *   - `currentLocation` con coords reales sobre un waypoint de su ruta
 *   - `visitedStops[]` con los paraderos ya pasados (índices < currentStopIndex)
 *   - `trackPoints[]` con un breve histórico (últimos 10 puntos hasta el actual)
 *   - `departureTime` reciente (hace 5–25 min)
 *
 * Esto desbloquea el endpoint público `/api/public/flota/activas` que filtra por
 * `currentLocation.lat: { $exists: true }`. Sin esto, aunque haya entries
 * `en_ruta` la app de buses-en-vivo ve vacío.
 *
 * Idempotente: re-ejecutarlo sólo varía las posiciones (avanza un waypoint).
 *
 * Uso:
 *   cd sfit-web && npx tsx scripts/seed-buses-vivos.ts
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

type Waypoint = {
  order: number;
  lat: number;
  lng: number;
  label?: string;
};

type AnyDoc = {
  _id: Types.ObjectId;
  municipalityId?: Types.ObjectId;
  vehicleId?: Types.ObjectId;
  driverId?: Types.ObjectId;
  routeId?: Types.ObjectId | { _id: Types.ObjectId; waypoints?: Waypoint[]; name?: string; code?: string };
  status?: string;
  currentLocation?: { lat: number; lng: number; updatedAt: Date };
  [k: string]: unknown;
};

function fmtTime(d: Date): string {
  const h = d.getHours().toString().padStart(2, "0");
  const m = d.getMinutes().toString().padStart(2, "0");
  return `${h}:${m}`;
}

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI no definida en .env.local");

  await mongoose.connect(uri);
  console.log("✅ Conectado a MongoDB");

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // ── 0. Cargar rutas con ≥2 waypoints (las únicas que sirven para "en vivo")
  const validRoutes = await RouteModel.find({
    status: { $ne: "inactiva" },
    "waypoints.1": { $exists: true },
  }).limit(20).lean() as AnyDoc[];

  if (validRoutes.length === 0) {
    console.error("❌ No hay rutas con ≥2 waypoints. Ejecuta seed-full-data.ts primero.");
    process.exit(1);
  }
  console.log(`📍 ${validRoutes.length} rutas válidas (con ≥2 waypoints) disponibles.`);

  // ── 1. Si no hay entries en_ruta, intentamos ascenderlos desde disponible ─
  let enRutaEntries = await FleetEntryModel.find({ status: "en_ruta", date: today }).lean() as AnyDoc[];

  if (enRutaEntries.length === 0) {
    console.log("ℹ️  No hay FleetEntries en_ruta hoy. Promoviendo entries 'disponible'…");
    const disponibles = await FleetEntryModel.find({ status: "disponible", date: today })
      .sort({ _id: 1 })
      .limit(4)
      .lean() as AnyDoc[];

    if (disponibles.length === 0) {
      // Crear desde scratch
      console.log("ℹ️  Tampoco hay 'disponible'. Creando entries en_ruta desde vehicles/drivers/routes…");
      const [vehicles, drivers, anyUser] = await Promise.all([
        VehicleModel.find({}).limit(8).lean() as Promise<AnyDoc[]>,
        DriverModel.find({}).limit(8).lean() as Promise<AnyDoc[]>,
        UserModel.findOne({}).lean() as Promise<AnyDoc | null>,
      ]);

      if (vehicles.length === 0 || drivers.length === 0) {
        console.error("❌ Faltan vehicles/drivers. Ejecuta seed-full-data.ts primero.");
        process.exit(1);
      }

      const created: Types.ObjectId[] = [];
      const target = Math.min(vehicles.length, drivers.length, validRoutes.length * 2, 6);
      for (let i = 0; i < target; i++) {
        const vehicle = vehicles[i];
        const driver  = drivers[i % drivers.length];
        const route   = validRoutes[i % validRoutes.length];
        const municipalityId =
          vehicle.municipalityId ??
          driver.municipalityId ??
          (route.municipalityId as Types.ObjectId | undefined);
        if (!municipalityId) {
          console.warn(`⚠️  Vehículo ${vehicle._id} sin municipalityId — saltando.`);
          continue;
        }

        const minutesAgo = 5 + i * 7; // 5, 12, 19, 26 min de turno
        const departure = new Date(Date.now() - minutesAgo * 60_000);

        const doc = await FleetEntryModel.findOneAndUpdate(
          { municipalityId, vehicleId: vehicle._id, date: today },
          {
            $set: {
              vehicleId: vehicle._id,
              driverId: driver._id,
              routeId: route._id,
              municipalityId,
              date: today,
              status: "en_ruta",
              departureTime: fmtTime(departure),
              checklistComplete: true,
              registeredBy: anyUser?._id,
              km: 0,
            },
          },
          { upsert: true, returnDocument: "after" }
        );
        if (doc) created.push(doc._id as Types.ObjectId);
      }
      console.log(`✅ Creados ${created.length} FleetEntries nuevos en_ruta.`);
    } else {
      // Promover los disponibles
      for (const d of disponibles) {
        const minutesAgo = 5 + Math.floor(Math.random() * 25);
        const departure = new Date(Date.now() - minutesAgo * 60_000);
        await FleetEntryModel.updateOne(
          { _id: d._id },
          { $set: { status: "en_ruta", departureTime: fmtTime(departure) } }
        );
      }
      console.log(`✅ Promovidos ${disponibles.length} entries disponibles → en_ruta.`);
    }

    enRutaEntries = await FleetEntryModel.find({ status: "en_ruta", date: today }).lean() as AnyDoc[];
  }

  if (enRutaEntries.length === 0) {
    console.error("❌ No se pudo obtener entries en_ruta. Revisa los datos base.");
    process.exit(1);
  }

  // ── 2. Reasignar entries con rutas inválidas a rutas válidas (round-robin)
  const validRouteIds = new Set(validRoutes.map((r) => r._id.toString()));
  let reassigned = 0;
  for (let i = 0; i < enRutaEntries.length; i++) {
    const entry = enRutaEntries[i];
    const currentRouteId = (entry.routeId as Types.ObjectId | undefined)?.toString();
    if (!currentRouteId || !validRouteIds.has(currentRouteId)) {
      const target = validRoutes[i % validRoutes.length];
      await FleetEntryModel.updateOne(
        { _id: entry._id },
        { $set: { routeId: target._id } }
      );
      entry.routeId = target._id;
      reassigned++;
    }
  }
  if (reassigned > 0) {
    console.log(`🔄 ${reassigned} entries reasignados a rutas válidas.`);
    enRutaEntries = await FleetEntryModel.find({ status: "en_ruta", date: today }).lean() as AnyDoc[];
  }

  // ── 3. Para cada entry en_ruta, inyectar currentLocation sobre la ruta ────
  let updated = 0;
  for (const entry of enRutaEntries) {
    const routeId = (entry.routeId as Types.ObjectId | undefined) ?? null;
    if (!routeId) {
      console.warn(`⚠️  Entry ${entry._id} sin routeId — saltando.`);
      continue;
    }

    const route = await RouteModel.findById(routeId).lean() as AnyDoc | null;
    const waypoints = ((route?.waypoints as Waypoint[] | undefined) ?? [])
      .slice()
      .sort((a, b) => a.order - b.order);

    if (waypoints.length < 2) {
      console.warn(`⚠️  Ruta ${routeId} tiene <2 waypoints — saltando entry ${entry._id}.`);
      continue;
    }

    // Posición pseudo-aleatoria pero estable según _id (mismo entry → mismo waypoint
    // entre runs hasta que se haga commit en otra dirección).
    const idHash = entry._id.toString().slice(-6);
    const idNum = parseInt(idHash, 16) || 0;
    const currentStopIndex = idNum % (waypoints.length - 1); // 0..N-2 (deja al menos uno pendiente)

    const wp = waypoints[currentStopIndex];
    const nextWp = waypoints[currentStopIndex + 1];

    // Para que se vea más realista: posición está a ~30% del camino entre wp y nextWp.
    const t = 0.3 + ((idNum >> 4) % 50) / 100; // 0.30..0.79
    const lat = wp.lat + (nextWp.lat - wp.lat) * t;
    const lng = wp.lng + (nextWp.lng - wp.lng) * t;

    // visitedStops: todos los waypoints con order <= currentStopIndex.
    const visitedStops = waypoints
      .filter((w) => w.order <= wp.order)
      .map((w) => ({
        stopIndex: w.order,
        label: w.label ?? `Paradero ${w.order + 1}`,
        lat: w.lat,
        lng: w.lng,
        visitedAt: new Date(Date.now() - (waypoints.length - w.order) * 90_000),
      }));

    // trackPoints: copia de visitedStops + el actual, con timestamps escalonados.
    const trackPoints = [
      ...visitedStops.map((v) => ({
        lat: v.lat,
        lng: v.lng,
        ts: v.visitedAt,
      })),
      {
        lat,
        lng,
        ts: new Date(),
        speed: 4.5, // ~16 km/h
      },
    ];

    await FleetEntryModel.updateOne(
      { _id: entry._id },
      {
        $set: {
          currentLocation: {
            lat,
            lng,
            updatedAt: new Date(),
            speed: 4.5,
            accuracy: 8,
          },
          visitedStops,
          trackPoints,
        },
      }
    );
    updated++;
  }

  console.log(`✅ ${updated} buses transmitiendo en vivo (currentLocation seteado).`);

  // ── 4. Resumen por ruta ────────────────────────────────────────────────
  const summary = await FleetEntryModel.aggregate([
    { $match: { status: "en_ruta", date: today, "currentLocation.lat": { $exists: true } } },
    { $group: { _id: "$routeId", count: { $sum: 1 } } },
    { $lookup: { from: "routes", localField: "_id", foreignField: "_id", as: "route" } },
    { $unwind: { path: "$route", preserveNullAndEmptyArrays: true } },
    { $project: { routeName: "$route.name", routeCode: "$route.code", count: 1 } },
    { $sort: { count: -1 } },
  ]);

  console.log("\n📊 Rutas con buses en vivo:");
  for (const r of summary) {
    console.log(`   ${r.routeCode ?? "—"} · ${r.routeName ?? "(sin nombre)"} → ${r.count} bus(es)`);
  }

  await mongoose.disconnect();
  console.log("\n✅ Listo. Recarga la app móvil → Buses en vivo.");
}

main().catch((err) => {
  console.error("❌ Error:", err);
  process.exit(1);
});
