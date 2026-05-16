/**
 * Backfill de Trip.companyId para trips legacy creados antes de Fase 2.2a.
 *
 * Estrategia: para cada Trip sin companyId, derivar la empresa desde
 * Trip.vehicleId → Vehicle.companyId. Si el vehículo no tiene empresa,
 * el trip se deja sin companyId y se registra en el reporte.
 *
 * Uso: npx tsx scripts/backfill-trip-companyid.ts [--dry-run]
 *
 * Idempotente: solo procesa documentos con companyId == null/undefined.
 */

import mongoose from "mongoose";
import { config } from "dotenv";
import dns from "node:dns";

dns.setServers(["8.8.8.8", "1.1.1.1", "8.8.4.4"]);
config({ path: ".env.local" });

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error("❌ MONGODB_URI no está definido en .env.local");
  process.exit(1);
}

const DRY_RUN = process.argv.includes("--dry-run");

async function main() {
  console.log(`🔌 Conectando a MongoDB Atlas... ${DRY_RUN ? "(DRY RUN)" : ""}`);
  await mongoose.connect(MONGODB_URI!);
  console.log(`✅ Conectado a la base: ${mongoose.connection.name}`);

  const tripsCol = mongoose.connection.db!.collection("trips");
  const vehiclesCol = mongoose.connection.db!.collection("vehicles");

  const pendingTrips = await tripsCol
    .find({ $or: [{ companyId: { $exists: false } }, { companyId: null }] })
    .project({ _id: 1, vehicleId: 1 })
    .toArray();

  console.log(`📦 Encontrados ${pendingTrips.length} trips sin companyId`);

  let resolved = 0;
  let unresolved = 0;
  const unresolvedIds: string[] = [];

  for (const trip of pendingTrips) {
    if (!trip.vehicleId) {
      unresolved += 1;
      unresolvedIds.push(String(trip._id));
      continue;
    }
    const vehicle = await vehiclesCol
      .findOne({ _id: trip.vehicleId }, { projection: { companyId: 1 } });
    if (!vehicle?.companyId) {
      unresolved += 1;
      unresolvedIds.push(String(trip._id));
      continue;
    }
    if (!DRY_RUN) {
      await tripsCol.updateOne(
        { _id: trip._id },
        { $set: { companyId: vehicle.companyId } },
      );
    }
    resolved += 1;
  }

  console.log(`\n✅ Resultado:`);
  console.log(`   ${resolved} trips actualizados con companyId`);
  console.log(`   ${unresolved} trips sin vehículo o vehículo sin empresa (omitidos)`);
  if (unresolvedIds.length > 0 && unresolvedIds.length <= 20) {
    console.log(`   IDs sin resolver: ${unresolvedIds.join(", ")}`);
  } else if (unresolvedIds.length > 20) {
    console.log(`   Primeros 20 IDs sin resolver: ${unresolvedIds.slice(0, 20).join(", ")}...`);
  }
  if (DRY_RUN) {
    console.log(`\n⚠️  DRY RUN: no se aplicó ningún cambio. Vuelve a correr sin --dry-run.`);
  }

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error("❌ Backfill falló:", err);
  process.exit(1);
});
