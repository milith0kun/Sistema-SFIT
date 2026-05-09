/**
 * Migración: consolidar Trip.status de "cerrado_automatico" → "auto_cierre".
 *
 * Histórico: el modelo Trip mantenía dos valores equivalentes en el enum de
 * status ("auto_cierre" y "cerrado_automatico") por compatibilidad con un
 * cambio temprano de naming. El handler /api/viajes/auto-close escribía
 * "cerrado_automatico", mientras que el resto del código (pages, dashboards,
 * scripts, FleetEntry.status) usaba "auto_cierre". Esta migración unifica a
 * "auto_cierre" y deja el enum con un solo valor.
 *
 * Idempotente: re-ejecutar es seguro (los matches caen a 0 después del primer
 * run).
 *
 * Uso: cd sfit-web && npx tsx scripts/migrate-trip-status.ts
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import mongoose, { Schema, model } from "mongoose";
import dns from "dns";
dns.setServers(["8.8.8.8", "1.1.1.1", "8.8.4.4"]);

const loose = { strict: false, timestamps: true } as const;
const TripModel = mongoose.models.Trip ?? model("Trip", new Schema({}, loose));

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error("✖ Falta MONGODB_URI en .env.local");
    process.exit(1);
  }

  console.log("→ Conectando a Mongo…");
  await mongoose.connect(uri);

  console.log("→ Contando documentos con status='cerrado_automatico'…");
  const before = await TripModel.countDocuments({ status: "cerrado_automatico" });
  console.log(`  ${before} encontrados`);

  if (before === 0) {
    console.log("✓ Nada que migrar — la colección ya está limpia.");
    await mongoose.disconnect();
    return;
  }

  console.log("→ Aplicando updateMany…");
  const res = await TripModel.updateMany(
    { status: "cerrado_automatico" },
    { $set: { status: "auto_cierre" } },
  );
  console.log(`  matched=${res.matchedCount} modified=${res.modifiedCount}`);

  const after = await TripModel.countDocuments({ status: "cerrado_automatico" });
  if (after !== 0) {
    console.error(`✖ Quedaron ${after} documentos con el valor viejo. Re-ejecutar.`);
    process.exit(2);
  }

  console.log("✓ Migración completada.");
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error("✖ Error en migración:", err);
  process.exit(1);
});
