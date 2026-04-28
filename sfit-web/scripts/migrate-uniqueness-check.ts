/**
 * Detecta duplicados cross-municipales que bloquearían los índices únicos
 * nacionales (placa SUNARP, RUC SUNAT, DNI RENIEC).
 *
 * Solo lectura: reporta qué resolver antes de aplicar los nuevos índices.
 *
 * Uso: cd sfit-web && npx tsx scripts/migrate-uniqueness-check.ts
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import mongoose from "mongoose";
import dns from "dns";
dns.setServers(["8.8.8.8", "1.1.1.1", "8.8.4.4"]);

interface DupRow {
  key: string;
  count: number;
  docs: Array<{ _id: unknown; municipalityId?: unknown; createdAt?: Date }>;
}

async function detectDuplicates(
  collectionName: string,
  uniqueField: string,
): Promise<DupRow[]> {
  const db = mongoose.connection.db!;
  const coll = db.collection(collectionName);

  const groups = await coll
    .aggregate<{ _id: string; count: number; docs: DupRow["docs"] }>([
      { $match: { [uniqueField]: { $exists: true, $ne: null } } },
      {
        $group: {
          _id: `$${uniqueField}`,
          count: { $sum: 1 },
          docs: {
            $push: {
              _id: "$_id",
              municipalityId: "$municipalityId",
              createdAt: "$createdAt",
            },
          },
        },
      },
      { $match: { count: { $gt: 1 } } },
      { $sort: { count: -1 } },
    ])
    .toArray();

  return groups.map((g) => ({ key: g._id, count: g.count, docs: g.docs }));
}

async function report(
  label: string,
  collection: string,
  field: string,
): Promise<number> {
  const dups = await detectDuplicates(collection, field);
  console.log(`\n── ${label}: campo "${field}" en ${collection} ──`);
  if (dups.length === 0) {
    console.log("  OK — sin duplicados.");
    return 0;
  }
  console.log(`  ${dups.length} grupos con duplicados:`);
  for (const d of dups.slice(0, 20)) {
    console.log(`    "${d.key}" → ${d.count} docs`);
    for (const doc of d.docs) {
      console.log(
        `      _id=${doc._id}  muni=${doc.municipalityId ?? "(sin)"}  ` +
        `created=${doc.createdAt instanceof Date ? doc.createdAt.toISOString().slice(0, 10) : "?"}`,
      );
    }
  }
  if (dups.length > 20) console.log(`    ... y ${dups.length - 20} grupos más`);
  return dups.length;
}

async function main() {
  await mongoose.connect(process.env.MONGODB_URI!);
  console.log("Conectado a MongoDB");

  const totalDups =
    (await report("Vehicle.plate (SUNARP)",  "vehicles",  "plate")) +
    (await report("Company.ruc (SUNAT)",     "companies", "ruc")) +
    (await report("Driver.dni (RENIEC)",     "drivers",   "dni"));

  console.log(`\n=== TOTAL grupos duplicados: ${totalDups} ===`);
  if (totalDups === 0) {
    console.log("Es seguro aplicar índices únicos nacionales en Vehicle, Company y Driver.");
  } else {
    console.log("Resuelve los duplicados (mergea o renombra) antes de aplicar índices únicos nacionales.");
  }

  await mongoose.disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
