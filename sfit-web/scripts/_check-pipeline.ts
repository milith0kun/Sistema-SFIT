/**
 * Diagnóstico end-to-end del pipeline conductor → backend → ciudadano.
 * No commitear (prefijo "_"). Uso: npx tsx scripts/_check-pipeline.ts
 */
import { config } from "dotenv";
config({ path: ".env.local" });
import mongoose, { Schema, model } from "mongoose";
import dns from "dns";
dns.setServers(["8.8.8.8", "1.1.1.1", "8.8.4.4"]);

const loose = { strict: false } as const;
const FleetEntry = mongoose.models.FleetEntry ?? model("FleetEntry", new Schema({}, loose));
const LocationPing = mongoose.models.LocationPing ?? model("LocationPing", new Schema({}, loose));
const Route = mongoose.models.Route ?? model("Route", new Schema({}, loose));

const MUN_STR = "69ee4ac7a1702346aefb1c1c"; // Cusco-Cusco-Cusco

async function main() {
  await mongoose.connect(process.env.MONGODB_URI!);
  const MUN = new mongoose.Types.ObjectId(MUN_STR);
  const now = Date.now();

  // 1. Buses en_ruta del municipio
  const enRuta = await FleetEntry.find({ status: "en_ruta", municipalityId: MUN }).lean() as any[];
  console.log(`\n=== Buses en_ruta en Cusco-Cusco-Cusco ===`);
  console.log(`Total: ${enRuta.length}`);

  let frescos = 0, viejos = 0, sinLoc = 0;
  for (const b of enRuta) {
    if (!b.currentLocation?.updatedAt) { sinLoc++; continue; }
    const ageMs = now - new Date(b.currentLocation.updatedAt).getTime();
    if (ageMs <= 2 * 60_000) frescos++;
    else viejos++;
  }
  console.log(`  Con currentLocation fresca (<2min): ${frescos}  ← visibles para ciudadano`);
  console.log(`  Con currentLocation vieja (>2min):  ${viejos}   ← filtrados como fantasma`);
  console.log(`  Sin currentLocation:                ${sinLoc}`);

  // 2. Distribución por driver
  const byDriver = new Map<string, number>();
  for (const b of enRuta) {
    const k = String(b.driverId);
    byDriver.set(k, (byDriver.get(k) ?? 0) + 1);
  }
  console.log(`\n=== Drivers con turno activo ===`);
  console.log(`  Drivers únicos: ${byDriver.size}`);

  // 3. LocationPings recibidos en los últimos 5 minutos
  const recent = await LocationPing.find({
    municipalityId: MUN,
    ts: { $gte: new Date(now - 5 * 60_000) },
  }).lean() as any[];
  console.log(`\n=== Pings GPS recibidos últimos 5 min ===`);
  console.log(`  Total: ${recent.length}`);
  if (recent.length > 0) {
    const byEntry = new Map<string, number>();
    for (const p of recent) {
      const k = String(p.entryId);
      byEntry.set(k, (byEntry.get(k) ?? 0) + 1);
    }
    console.log(`  Por turno:`);
    for (const [k, v] of byEntry) console.log(`    ${k}: ${v} pings`);
  } else {
    console.log(`  ⚠️  NINGÚN ping en los últimos 5 minutos`);
    console.log(`     → Verificar que hay conductores con la app abierta y turno activo`);
  }

  // 4. Verificar que las rutas existen
  const rutas = await Route.find({ municipalityId: MUN, status: "activa" }).lean() as any[];
  console.log(`\n=== Rutas activas en el municipio ===`);
  console.log(`  Total: ${rutas.length}`);
  for (const r of rutas.slice(0, 5)) {
    console.log(`  - ${r.code} · ${r.name} (${r.waypoints?.length ?? 0} paraderos, polyline: ${r.polylineGeometry?.coords ? 'sí' : 'no'})`);
  }

  await mongoose.disconnect();
}
main().catch(e => { console.error(e); process.exit(1); });
