/**
 * Backfill retroactivo de RouteCaptures.
 *
 * Para cada FleetEntry ya cerrado (cerrado | auto_cierre) que NO tenga
 * captura asociada y tenga ≥20 LocationPings, crea una RouteCapture:
 *   - Con `routeId` → status "raw" (alimenta convergencia normal).
 *   - Sin `routeId` → status "candidate" (queda esperando que el operador
 *     la valide desde /rutas/candidatas).
 *
 * Idempotente: chequea `RouteCapture.findOne({ fleetEntryId })` antes de
 * crear cada documento. Re-ejecutar es seguro.
 *
 * Uso:
 *   cd sfit-web && npx tsx scripts/backfill-route-captures.ts
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import mongoose from "mongoose";
import dns from "node:dns";
dns.setServers(["8.8.8.8", "1.1.1.1", "8.8.4.4"]);

import { computeQualityScore, polylineLengthMeters, type GpsPoint } from "../src/lib/routes/converge";

(async () => {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error("MONGODB_URI no definida en .env.local");
    process.exit(1);
  }
  await mongoose.connect(uri);
  console.log("Conectado a MongoDB");

  const loose = { strict: false } as const;
  const FleetEntry =
    mongoose.models.FleetEntry ??
    mongoose.model("FleetEntry", new mongoose.Schema({}, { ...loose, collection: "fleetentries" }));
  const LocationPing =
    mongoose.models.LocationPing ??
    mongoose.model("LocationPing", new mongoose.Schema({}, { ...loose, collection: "locationpings" }));
  const RouteCapture =
    mongoose.models.RouteCapture ??
    mongoose.model("RouteCapture", new mongoose.Schema({}, { ...loose, collection: "routecaptures" }));

  type AnyDoc = Record<string, unknown> & { _id: mongoose.Types.ObjectId };

  // 1) Listar FleetEntries cerrados.
  const closedEntries = (await FleetEntry.find({
    status: { $in: ["cerrado", "auto_cierre"] },
  })
    .select("_id municipalityId driverId vehicleId routeId status")
    .lean()) as AnyDoc[];

  console.log(`FleetEntries cerrados: ${closedEntries.length}`);

  let created = 0;
  let skippedExists = 0;
  let skippedFewPings = 0;
  let candidateCount = 0;
  let rawCount = 0;
  let errors = 0;

  for (const entry of closedEntries) {
    try {
      const exists = await RouteCapture.findOne({ fleetEntryId: entry._id }).select("_id").lean();
      if (exists) {
        skippedExists++;
        continue;
      }

      const pings = (await LocationPing.find({ entryId: entry._id })
        .sort({ ts: 1 })
        .select("lat lng ts accuracy speed")
        .lean()) as Array<{
          lat: number;
          lng: number;
          ts: Date;
          accuracy?: number;
          speed?: number;
        }>;

      if (pings.length < 20) {
        skippedFewPings++;
        continue;
      }

      const points = pings.map((p) => ({
        lat: p.lat,
        lng: p.lng,
        ts: p.ts,
        accuracy: p.accuracy,
        speed: p.speed,
      }));

      const accuracies = points.map((p) => p.accuracy).filter((x): x is number => typeof x === "number");
      const avgAccuracy = accuracies.length > 0
        ? accuracies.reduce((s, a) => s + a, 0) / accuracies.length
        : undefined;

      const distanceMeters = polylineLengthMeters(points as GpsPoint[]);
      const durationSeconds = points.length >= 2
        ? Math.round((points[points.length - 1].ts.getTime() - points[0].ts.getTime()) / 1000)
        : undefined;

      const qualityScore = computeQualityScore({
        avgAccuracy,
        pointCount: points.length,
        durationSeconds,
        distanceMeters,
      });

      const hasRoute = !!entry.routeId;
      const status = hasRoute ? "raw" : "candidate";

      await RouteCapture.create({
        routeId: entry.routeId ?? null,
        fleetEntryId: entry._id,
        driverId: entry.driverId,
        vehicleId: entry.vehicleId,
        municipalityId: entry.municipalityId,
        points,
        pointCount: points.length,
        avgAccuracy,
        distanceMeters,
        durationSeconds,
        qualityScore,
        status,
      });

      created++;
      if (status === "raw") rawCount++;
      else candidateCount++;
    } catch (e) {
      errors++;
      console.error(`Error en FleetEntry ${String(entry._id)}:`, (e as Error).message);
    }
  }

  console.log("\n=== Resumen ===");
  console.log(`  Capturas creadas:        ${created}`);
  console.log(`    - status "raw":        ${rawCount}`);
  console.log(`    - status "candidate":  ${candidateCount}`);
  console.log(`  Saltadas (ya existía):   ${skippedExists}`);
  console.log(`  Saltadas (<20 pings):    ${skippedFewPings}`);
  console.log(`  Errores:                 ${errors}`);

  await mongoose.disconnect();
})();
