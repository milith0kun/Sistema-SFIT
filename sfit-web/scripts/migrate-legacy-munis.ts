/**
 * Migra municipalidades legacy (sin ubigeoCode) a sus contrapartes UBIGEO oficiales.
 *
 * Estrategia:
 *   1. Detecta cada muni sin ubigeoCode.
 *   2. Resuelve target UBIGEO:
 *      - mapping manual MANUAL_MAP[name] si existe
 *      - sino, match por nombre del distrito (quitando prefijo "Municipalidad de…")
 *   3. Activa la muni UBIGEO real, reapunta todas las refs y elimina la legacy.
 *   4. Reasigna User.provinceId si apunta a una provincia legacy → provincia UBIGEO real.
 *   5. Elimina provincias legacy huérfanas (sin refs en municipalities ni users).
 *
 * Idempotente: re-ejecutar es seguro.
 *
 * Uso: cd sfit-web && npx tsx scripts/migrate-legacy-munis.ts
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import mongoose, { Types } from "mongoose";
import dns from "dns";
dns.setServers(["8.8.8.8", "1.1.1.1", "8.8.4.4"]);

// Mapping manual para casos donde el nombre legacy no coincide con el INEI.
// Clave: nombre legacy. Valor: ubigeoCode (6 dígitos) destino.
const MANUAL_MAP: Record<string, string> = {
  "Municipalidad de Puerto Maldonado": "170101", // INEI: distrito "Tambopata"
};

const COLLECTIONS_WITH_MUNI = [
  "vehicles", "companies", "drivers", "routes", "sanctions",
  "fleetentries", "trips", "citizenreports", "inspections",
  "vehicletypes", "apelacions", "users", "auditlogs",
] as const;

const COLLECTIONS_WITH_PROVINCE = ["users", "auditlogs"] as const;

interface Doc { _id: Types.ObjectId; [k: string]: unknown }

async function main() {
  await mongoose.connect(process.env.MONGODB_URI!);
  const db = mongoose.connection.db!;
  const Muni = db.collection("municipalities");
  const Prov = db.collection("provinces");

  console.log("Buscando municipalidades legacy (sin ubigeoCode)…");
  const legacyMunis = (await Muni.find({
    $or: [{ ubigeoCode: { $exists: false } }, { ubigeoCode: null }],
  }).toArray()) as Doc[];

  console.log(`Encontradas: ${legacyMunis.length}\n`);

  const provinceIdsToReassign = new Map<string, Types.ObjectId>(); // legacyProvId → realProvId
  let migrated = 0, skipped = 0;

  for (const m of legacyMunis) {
    const name = String(m.name);

    // 1. Resolver target ubigeoCode
    let targetUbigeo: string | undefined = MANUAL_MAP[name];

    if (!targetUbigeo) {
      const district = name
        .replace(/^Municipalidad\s+(Provincial\s+|Distrital\s+)?(de\s+|del\s+)?/i, "")
        .trim();
      const candidates = (await Muni.find({
        name: district,
        ubigeoCode: { $exists: true, $ne: null },
      }).toArray()) as Doc[];

      if (candidates.length === 1) {
        targetUbigeo = String(candidates[0].ubigeoCode);
      } else if (candidates.length > 1) {
        console.warn(`  ⚠ "${name}" tiene ${candidates.length} candidatos UBIGEO; saltado. Agregar a MANUAL_MAP.`);
        skipped++;
        continue;
      } else {
        console.warn(`  ⚠ "${name}" sin match UBIGEO; saltado. Agregar a MANUAL_MAP.`);
        skipped++;
        continue;
      }
    }

    // 2. Localizar destino en BD y activarlo
    const target = await Muni.findOne({ ubigeoCode: targetUbigeo }) as Doc | null;
    if (!target) {
      console.warn(`  ⚠ "${name}" → ${targetUbigeo} pero no existe en BD; saltado.`);
      skipped++;
      continue;
    }

    if (String(target._id) === String(m._id)) {
      console.log(`  · "${name}" ya es la entrada UBIGEO; saltando.`);
      continue;
    }

    console.log(`Migrando "${name}" → UBIGEO ${targetUbigeo} ("${target.name}")`);

    // Activar destino
    await Muni.updateOne({ _id: target._id }, {
      $set: { active: true, logoUrl: m.logoUrl ?? target.logoUrl },
    });

    // Tracker para borrar provincia legacy después
    if (m.provinceId) {
      provinceIdsToReassign.set(
        String(m.provinceId),
        target.provinceId as Types.ObjectId,
      );
    }

    // 3. Reapuntar refs
    let totalRefs = 0;
    for (const coll of COLLECTIONS_WITH_MUNI) {
      const r = await db.collection(coll).updateMany(
        { municipalityId: m._id },
        { $set: { municipalityId: target._id } },
      );
      if (r.modifiedCount > 0) {
        totalRefs += r.modifiedCount;
        console.log(`  ${coll}: ${r.modifiedCount}`);
      }
    }

    // 4. Eliminar legacy
    await Muni.deleteOne({ _id: m._id });
    console.log(`  ✓ migrada (${totalRefs} refs reapuntadas, legacy eliminada)`);
    migrated++;
    console.log("");
  }

  // 5. Reasignar User.provinceId / AuditLog.provinceId de provincias legacy → reales
  if (provinceIdsToReassign.size > 0) {
    console.log("Reasignando provinceId en colecciones que la usan:");
    for (const [legacyId, realId] of provinceIdsToReassign) {
      for (const coll of COLLECTIONS_WITH_PROVINCE) {
        const r = await db.collection(coll).updateMany(
          { provinceId: new Types.ObjectId(legacyId) },
          { $set: { provinceId: realId } },
        );
        if (r.modifiedCount > 0) {
          console.log(`  ${coll}.provinceId ${legacyId} → ${realId}: ${r.modifiedCount}`);
        }
      }
    }
  }

  // 6. Eliminar provincias legacy huérfanas
  console.log("\nLimpiando provincias legacy sin refs:");
  const legacyProvs = (await Prov.find({
    $or: [{ ubigeoCode: { $exists: false } }, { ubigeoCode: null }],
  }).toArray()) as Doc[];

  for (const p of legacyProvs) {
    const inUseInMunis = await Muni.countDocuments({ provinceId: p._id });
    let refsInUsers = 0;
    for (const coll of COLLECTIONS_WITH_PROVINCE) {
      refsInUsers += await db.collection(coll).countDocuments({ provinceId: p._id });
    }
    if (inUseInMunis === 0 && refsInUsers === 0) {
      await Prov.deleteOne({ _id: p._id });
      console.log(`  ✓ eliminada provincia legacy "${p.name}"`);
    } else {
      console.log(`  ⚠ "${p.name}" conserva ${inUseInMunis} munis y ${refsInUsers} otras refs; mantenida.`);
    }
  }

  console.log("\n=== RESUMEN ===");
  console.log(`Municipalidades migradas : ${migrated}`);
  console.log(`Saltadas                 : ${skipped}`);

  await mongoose.disconnect();
  console.log("\nMigración completada.");
}

main().catch((e: unknown) => {
  console.error("Error:", e instanceof Error ? e.message : e);
  process.exit(1);
});
