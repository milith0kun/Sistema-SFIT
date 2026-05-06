/**
 * Reset de datos OPERACIONALES — borra todo lo del día a día para hacer
 * pruebas reales desde cero.
 *
 * Borra:
 *   - Route          (rutas con paraderos y polylines)
 *   - FleetEntry     (turnos del día)
 *   - LocationPing   (histórico GPS)
 *   - Trip           (viajes asociados)
 *   - RouteCapture   (captura para convergencia de rutas)
 *
 * Conserva (masters):
 *   - User, Driver, Vehicle, Company
 *   - Province, Municipality, Region
 *   - Recompensa, SfitCoin, Notification, AuditLog
 *
 * Uso: npx tsx scripts/reset-operational-data.ts
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import mongoose, { Schema, model } from "mongoose";
import dns from "dns";
dns.setServers(["8.8.8.8", "1.1.1.1", "8.8.4.4"]);

const loose = { strict: false } as const;

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("Falta MONGODB_URI");

  await mongoose.connect(uri);

  const Route = mongoose.models.Route ?? model("Route", new Schema({}, { ...loose, collection: "routes" }));
  const FleetEntry = mongoose.models.FleetEntry ?? model("FleetEntry", new Schema({}, { ...loose, collection: "fleetentries" }));
  const LocationPing = mongoose.models.LocationPing ?? model("LocationPing", new Schema({}, { ...loose, collection: "locationpings" }));
  const Trip = mongoose.models.Trip ?? model("Trip", new Schema({}, { ...loose, collection: "trips" }));
  const RouteCapture = mongoose.models.RouteCapture ?? model("RouteCapture", new Schema({}, { ...loose, collection: "routecaptures" }));

  console.log("⚠️  Borrando datos operacionales…");

  const r1 = await Route.deleteMany({});
  console.log(`✓ ${r1.deletedCount} rutas borradas`);

  const r2 = await FleetEntry.deleteMany({});
  console.log(`✓ ${r2.deletedCount} entradas de flota borradas`);

  const r3 = await LocationPing.deleteMany({});
  console.log(`✓ ${r3.deletedCount} pings GPS borrados`);

  const r4 = await Trip.deleteMany({});
  console.log(`✓ ${r4.deletedCount} viajes borrados`);

  const r5 = await RouteCapture.deleteMany({});
  console.log(`✓ ${r5.deletedCount} capturas de ruta borradas`);

  // Limpiar también currentVehicleId y lastRouteId del Driver, porque pueden
  // apuntar a documentos borrados.
  const Driver = mongoose.models.Driver ?? model("Driver", new Schema({}, { ...loose, collection: "drivers" }));
  const r6 = await Driver.updateMany(
    {},
    { $unset: { currentVehicleId: "", lastRouteId: "" } },
  );
  console.log(`✓ ${r6.modifiedCount} drivers limpiados (sin vehicle/route asignado)`);

  console.log("\n✅ Sistema reseteado para pruebas reales.");
  console.log("   Conductores, vehículos, empresas y usuarios se mantuvieron.");

  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
