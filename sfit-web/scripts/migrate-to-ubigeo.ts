/**
 * Migración de la "Municipalidad de Prueba SFIT" sintética a Cusco-Cusco-Cusco
 * UBIGEO real (ubigeoCode: "080101"), y de la "Provincia de Prueba SFIT" a la
 * provincia UBIGEO Cusco (ubigeoCode: "0801").
 *
 * Reapunta TODAS las referencias municipalityId / provinceId de las colecciones
 * de dominio a las entidades UBIGEO reales y elimina las sintéticas si quedan
 * sin referencias.
 *
 * Idempotente: si ya se ejecutó (no hay sintética que migrar), reporta y termina.
 *
 * IMPORTANTE: antes de correr, considerar un dump de respaldo:
 *   mongodump --uri="$MONGODB_URI" --collection=users --collection=municipalities --collection=provinces
 *
 * Uso: cd sfit-web && npx tsx scripts/migrate-to-ubigeo.ts
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import mongoose, { Schema, model, Types } from "mongoose";
import dns from "dns";

dns.setServers(["8.8.8.8", "1.1.1.1", "8.8.4.4"]);

const SYNTHETIC_PROVINCE_NAME     = "Provincia de Prueba SFIT";
const SYNTHETIC_MUNICIPALITY_NAME = "Municipalidad de Prueba SFIT";
const TARGET_PROVINCE_UBIGEO      = "0801";   // Cusco (provincia)
const TARGET_MUNICIPALITY_UBIGEO  = "080101"; // Cusco (distrito capital)

// Colecciones que tienen municipalityId / provinceId
const COLLECTIONS_WITH_MUNI = [
  "vehicles",
  "companies",
  "drivers",
  "routes",
  "sanctions",
  "fleetentries",
  "trips",
  "citizenreports",
  "inspections",
  "vehicletypes",
  "apelacions",
  "users",
  "auditlogs",
] as const;

const COLLECTIONS_WITH_PROVINCE = ["users", "auditlogs"] as const;

const loose = { strict: false, timestamps: true } as const;
const ProvinceModel     = mongoose.models.Province     ?? model("Province",     new Schema({}, loose));
const MunicipalityModel = mongoose.models.Municipality ?? model("Municipality", new Schema({}, loose));

interface DocWithId { _id: Types.ObjectId }

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI no definida en .env.local");

  await mongoose.connect(uri);
  console.log("Conectado a MongoDB");

  // ── 1. Localizar entidades UBIGEO reales ──────────────────────────────────
  const targetProvince = await ProvinceModel.findOne({
    ubigeoCode: TARGET_PROVINCE_UBIGEO,
  }).lean() as DocWithId | null;
  if (!targetProvince) {
    throw new Error(
      `No se encontró la provincia UBIGEO ${TARGET_PROVINCE_UBIGEO}. ` +
      `Ejecuta primero: npx tsx scripts/seed-ubigeo.ts`,
    );
  }

  const targetMunicipality = await MunicipalityModel.findOne({
    ubigeoCode: TARGET_MUNICIPALITY_UBIGEO,
  }).lean() as DocWithId | null;
  if (!targetMunicipality) {
    throw new Error(
      `No se encontró la municipalidad UBIGEO ${TARGET_MUNICIPALITY_UBIGEO}. ` +
      `Ejecuta primero: npx tsx scripts/seed-ubigeo.ts`,
    );
  }

  console.log(`Target provincia (UBIGEO ${TARGET_PROVINCE_UBIGEO}): ${targetProvince._id}`);
  console.log(`Target municipalidad (UBIGEO ${TARGET_MUNICIPALITY_UBIGEO}): ${targetMunicipality._id}`);

  // ── 2. Activar las entidades UBIGEO reales ────────────────────────────────
  await MunicipalityModel.findByIdAndUpdate(targetMunicipality._id, {
    $set: { active: true },
  });
  await ProvinceModel.findByIdAndUpdate(targetProvince._id, {
    $set: { active: true },
  });
  console.log("Provincia y municipalidad UBIGEO real marcadas como activas");

  // ── 3. Localizar entidades sintéticas ─────────────────────────────────────
  const syntheticProvince = await ProvinceModel.findOne({
    name: SYNTHETIC_PROVINCE_NAME,
  }).lean() as DocWithId | null;
  const syntheticMunicipality = await MunicipalityModel.findOne({
    name: SYNTHETIC_MUNICIPALITY_NAME,
  }).lean() as DocWithId | null;

  if (!syntheticProvince && !syntheticMunicipality) {
    console.log("\nNo se encontraron entidades sintéticas. Migración ya aplicada o no hubo seeds previos.");
    await mongoose.disconnect();
    return;
  }

  console.log(`\nEntidades sintéticas detectadas:`);
  if (syntheticProvince)     console.log(`  provincia sintética    : ${syntheticProvince._id}`);
  if (syntheticMunicipality) console.log(`  municipalidad sintética: ${syntheticMunicipality._id}`);

  // Si la sintética coincide con la real, no hay nada que migrar.
  const synthMuniIsTarget =
    syntheticMunicipality && String(syntheticMunicipality._id) === String(targetMunicipality._id);
  const synthProvIsTarget =
    syntheticProvince && String(syntheticProvince._id) === String(targetProvince._id);

  if (synthMuniIsTarget && synthProvIsTarget) {
    console.log("Las sintéticas coinciden con las UBIGEO reales — nada que migrar.");
    await mongoose.disconnect();
    return;
  }

  const db = mongoose.connection.db;
  if (!db) throw new Error("No hay conexión db disponible.");

  // ── 4. Reapuntar municipalityId en todas las colecciones ──────────────────
  if (syntheticMunicipality && !synthMuniIsTarget) {
    console.log("\nReapuntando municipalityId en colecciones de dominio:");
    for (const coll of COLLECTIONS_WITH_MUNI) {
      const result = await db.collection(coll).updateMany(
        { municipalityId: syntheticMunicipality._id },
        { $set: { municipalityId: targetMunicipality._id } },
      );
      if (result.modifiedCount > 0 || result.matchedCount > 0) {
        console.log(`  ${coll.padEnd(16)} matched=${result.matchedCount} modified=${result.modifiedCount}`);
      }
    }
  }

  // ── 5. Reapuntar provinceId en colecciones que lo usen ────────────────────
  if (syntheticProvince && !synthProvIsTarget) {
    console.log("\nReapuntando provinceId en colecciones de dominio:");
    for (const coll of COLLECTIONS_WITH_PROVINCE) {
      const result = await db.collection(coll).updateMany(
        { provinceId: syntheticProvince._id },
        { $set: { provinceId: targetProvince._id } },
      );
      if (result.modifiedCount > 0 || result.matchedCount > 0) {
        console.log(`  ${coll.padEnd(16)} matched=${result.matchedCount} modified=${result.modifiedCount}`);
      }
    }
  }

  // ── 6. Verificar que no queden refs y eliminar sintéticas ─────────────────
  if (syntheticMunicipality && !synthMuniIsTarget) {
    let remainingMuniRefs = 0;
    for (const coll of COLLECTIONS_WITH_MUNI) {
      remainingMuniRefs += await db.collection(coll).countDocuments({
        municipalityId: syntheticMunicipality._id,
      });
    }
    if (remainingMuniRefs === 0) {
      await MunicipalityModel.deleteOne({ _id: syntheticMunicipality._id });
      console.log(`\nMunicipalidad sintética eliminada: "${SYNTHETIC_MUNICIPALITY_NAME}"`);
    } else {
      console.log(`\nMunicipalidad sintética CONSERVADA — quedan ${remainingMuniRefs} refs sin migrar.`);
    }
  }

  if (syntheticProvince && !synthProvIsTarget) {
    let remainingProvRefs = 0;
    for (const coll of COLLECTIONS_WITH_PROVINCE) {
      remainingProvRefs += await db.collection(coll).countDocuments({
        provinceId: syntheticProvince._id,
      });
    }
    // También chequear que no queden municipalidades apuntando a la provincia sintética
    const munisAtSyntheticProv = await MunicipalityModel.countDocuments({
      provinceId: syntheticProvince._id,
    });
    if (remainingProvRefs === 0 && munisAtSyntheticProv === 0) {
      await ProvinceModel.deleteOne({ _id: syntheticProvince._id });
      console.log(`Provincia sintética eliminada: "${SYNTHETIC_PROVINCE_NAME}"`);
    } else {
      console.log(
        `Provincia sintética CONSERVADA — quedan ${remainingProvRefs} refs en docs y ` +
        `${munisAtSyntheticProv} municipalidades apuntando a ella.`,
      );
    }
  }

  // ── 7. Resumen ────────────────────────────────────────────────────────────
  const totalMunisActivas = await MunicipalityModel.countDocuments({ active: true });
  const totalProvActivas = await ProvinceModel.countDocuments({ active: true });
  console.log("\n=== RESUMEN POST-MIGRACIÓN ===");
  console.log(`Municipalidades activas : ${totalMunisActivas}`);
  console.log(`Provincias activas      : ${totalProvActivas}`);
  console.log("\nMigración completada.");

  await mongoose.disconnect();
}

main().catch((err: unknown) => {
  console.error("Error en migración:", err instanceof Error ? err.message : err);
  process.exit(1);
});
