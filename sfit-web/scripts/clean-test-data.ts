/**
 * Limpieza completa de datos de prueba de SFIT.
 *
 * MANTIENE:
 *   - users (7 — los que ya limpiaste)
 *   - provinces (196 — catálogo real UBIGEO)
 *   - municipalities (1874 — catálogo real UBIGEO)
 *   - vehicletypes (34 — catálogo)
 *
 * BORRA TODO LO DEMÁS.
 *
 * Uso: npx tsx scripts/clean-test-data.ts
 */

import mongoose from "mongoose";
import { config } from "dotenv";
import dns from "node:dns";

dns.setServers(["8.8.8.8", "1.1.1.1", "8.8.4.4"]);
config({ path: ".env.local" });

const MONGODB_URI = process.env.MONGODB_URI!;

const CLEAN = [
  "authorizedvehicles",
  "transportauthorizations",
  "locationpings",
  "auditlogs",
  "inspections",
  "citizenreports",
  "sanctions",
  "notifications",
  "vehicles",
  "drivers",
  "drivermemberships",
  "fleetentries",
  "companies",
  "sfitcoins",
  "uploadedfiles",
  "apelacions",
  "routecaptures",
  "recompensas",
  "routes",
  "trips",
  "passengers",
  "citizenTripRegistrations",
  "reportapoyos",
  "webhooks",
];

const KEEP = ["users", "provinces", "municipalities", "vehicletypes"];

async function main() {
  console.log("🧹 LIMPIEZA DE DATOS DE PRUEBA — SFIT");
  console.log("═".repeat(60));

  await mongoose.connect(MONGODB_URI, {
    bufferCommands: false,
    serverSelectionTimeoutMS: 15000,
    family: 4,
  });

  const db = mongoose.connection.db!;
  console.log(`✅ Conectado a: ${db.databaseName}\n`);

  // Mostrar estado actual
  console.log("📊 Estado ANTES de limpiar:\n");
  const beforeCounts: Record<string, number> = {};
  for (const name of [...CLEAN, ...KEEP]) {
    try {
      const count = await db.collection(name).countDocuments();
      beforeCounts[name] = count;
      const icon = KEEP.includes(name) ? "🔒" : count > 0 ? "🗑️" : "⬜";
      console.log(`  ${icon} ${name}: ${count}`);
    } catch {
      beforeCounts[name] = 0;
      console.log(`  ⬜ ${name}: (no existe)`);
    }
  }

  const totalDelete = CLEAN.reduce((s, c) => s + (beforeCounts[c] || 0), 0);
  console.log(`\n  Se borrarán ${totalDelete.toLocaleString()} documentos de ${CLEAN.length} colecciones.`);
  console.log(`  Se mantendrán las colecciones: ${KEEP.join(", ")}`);

  // Confirmar
  console.log("\n⏳ Ejecutando limpieza en 3 segundos...");
  await new Promise((r) => setTimeout(r, 3000));

  console.log("\n🗑️  Borrando...\n");
  let totalDeleted = 0;

  for (const name of CLEAN) {
    try {
      const col = db.collection(name);
      const count = await col.countDocuments();
      if (count === 0) {
        console.log(`  ⬜ ${name}: ya vacía`);
        continue;
      }
      const result = await col.deleteMany({});
      totalDeleted += result.deletedCount;
      console.log(`  ✅ ${name}: ${result.deletedCount} documentos borrados`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.log(`  ❌ ${name}: error — ${msg}`);
    }
  }

  // Verificar estado final
  console.log("\n\n📊 Estado DESPUÉS de limpiar:\n");
  for (const name of [...CLEAN, ...KEEP]) {
    try {
      const count = await db.collection(name).countDocuments();
      const icon = count === 0 ? "⬜" : "🔒";
      console.log(`  ${icon} ${name}: ${count}`);
    } catch {
      console.log(`  ⬜ ${name}: (no existe)`);
    }
  }

  console.log(`\n✅ Limpieza completada. ${totalDeleted.toLocaleString()} documentos eliminados.`);

  // Verificar integridad post-limpieza
  console.log("\n🔗 Verificando integridad post-limpieza...\n");

  const users = await db.collection("users").find().toArray();
  const userIds = new Set(users.map((u) => u._id.toString()));
  const muns = await db.collection("municipalities").find().toArray();
  const munIds = new Set(muns.map((m) => m._id.toString()));

  let issues = 0;
  for (const u of users) {
    if (u.municipalityId && !munIds.has(u.municipalityId.toString())) {
      console.log(`  ⚠️  User ${u.email} → municipalityId ${u.municipalityId} NO EXISTE`);
      issues++;
    }
  }

  if (issues === 0) {
    console.log("  ✅ Sin problemas de integridad detectados.");
  }

  await mongoose.disconnect();
  console.log("\n✅ Proceso completado.");
}

main().catch((e) => {
  console.error("ERROR:", e);
  process.exit(1);
});
