/**
 * Migración Etapa 2: scope/coverage/authorizations + índices nacionales.
 *
 * 1. Dropea índices compuestos legacy cross-municipales:
 *      vehicles    : (municipalityId, plate) → reemplazado por (plate) único nacional
 *      companies   : (municipalityId, ruc)   → reemplazado por (ruc)   único nacional
 *      drivers     : (municipalityId, dni)   → reemplazado por (dni)   único nacional
 *
 * 2. Pobla serviceScope + coverage en companies existentes:
 *      - Si no tienen serviceScope: marcadas como "urbano_distrital".
 *      - coverage.districtCodes se deriva del Municipality.ubigeoCode.
 *      - authorizations[]: una entrada inferida con level=municipal_distrital.
 *
 * 3. Llama a syncIndexes en cada modelo para crear los nuevos índices.
 *
 * Idempotente: re-ejecutar es seguro.
 *
 * Pre-requisito: scripts/migrate-uniqueness-check.ts debe reportar 0 duplicados.
 *
 * Uso: cd sfit-web && npx tsx scripts/migrate-company-scope.ts
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import mongoose, { Schema, model, Types } from "mongoose";
import dns from "dns";
dns.setServers(["8.8.8.8", "1.1.1.1", "8.8.4.4"]);

const loose = { strict: false, timestamps: true } as const;
const VehicleModel      = mongoose.models.Vehicle      ?? model("Vehicle",      new Schema({}, loose));
const CompanyModel      = mongoose.models.Company      ?? model("Company",      new Schema({}, loose));
const DriverModel       = mongoose.models.Driver       ?? model("Driver",       new Schema({}, loose));
const MunicipalityModel = mongoose.models.Municipality ?? model("Municipality", new Schema({}, loose));

interface IndexSpec { coll: string; name: string }

const LEGACY_INDEXES: IndexSpec[] = [
  { coll: "vehicles",  name: "municipalityId_1_plate_1" },
  { coll: "companies", name: "municipalityId_1_ruc_1"   },
  { coll: "drivers",   name: "municipalityId_1_dni_1"   },
];

async function dropIndexIfExists({ coll, name }: IndexSpec): Promise<void> {
  const db = mongoose.connection.db;
  if (!db) return;
  try {
    const indexes = await db.collection(coll).indexes();
    if (indexes.some((i) => i.name === name)) {
      await db.collection(coll).dropIndex(name);
      console.log(`  dropped legacy index ${coll}.${name}`);
    } else {
      console.log(`  index ${coll}.${name} no existía (ok)`);
    }
  } catch (err) {
    console.warn(`  no se pudo eliminar ${coll}.${name}:`, err instanceof Error ? err.message : err);
  }
}

async function main() {
  await mongoose.connect(process.env.MONGODB_URI!);
  console.log("Conectado a MongoDB\n");

  // ── 1. Drop índices legacy ────────────────────────────────────────────────
  console.log("Eliminando índices compuestos legacy:");
  for (const spec of LEGACY_INDEXES) await dropIndexIfExists(spec);

  // ── 2. Migrar companies sin serviceScope ─────────────────────────────────
  console.log("\nPoblando serviceScope + coverage en companies existentes:");
  const pendingCompanies = await CompanyModel.find({
    $or: [
      { serviceScope: { $exists: false } },
      { serviceScope: null },
      { "coverage.districtCodes": { $size: 0 } },
    ],
  }).lean() as Array<{
    _id: Types.ObjectId;
    municipalityId: Types.ObjectId;
    serviceScope?: string;
    coverage?: { districtCodes?: string[] };
    authorizations?: unknown[];
  }>;

  console.log(`  ${pendingCompanies.length} companies pendientes`);

  let migrated = 0;
  let skipped = 0;
  for (const c of pendingCompanies) {
    const muni = await MunicipalityModel.findById(c.municipalityId).lean() as {
      _id: Types.ObjectId;
      ubigeoCode?: string;
      provinceCode?: string;
      departmentCode?: string;
      name?: string;
    } | null;
    if (!muni?.ubigeoCode) {
      console.warn(`  - skip company ${c._id} (muni sin ubigeoCode)`);
      skipped++;
      continue;
    }

    await CompanyModel.updateOne(
      { _id: c._id },
      {
        $set: {
          serviceScope: c.serviceScope ?? "urbano_distrital",
          coverage: {
            districtCodes:   [muni.ubigeoCode],
            provinceCodes:   muni.provinceCode   ? [muni.provinceCode]   : [],
            departmentCodes: muni.departmentCode ? [muni.departmentCode] : [],
          },
          authorizations:
            (c.authorizations && c.authorizations.length > 0)
              ? c.authorizations
              : [
                  {
                    level: "municipal_distrital",
                    scope: "urbano_distrital",
                    issuedBy: `Municipalidad de ${muni.name ?? "—"}`,
                  },
                ],
        },
      },
    );
    migrated++;
  }
  console.log(`  ${migrated} migradas, ${skipped} saltadas (sin ubigeoCode en muni)`);

  // ── 3. Recrear índices nuevos ─────────────────────────────────────────────
  console.log("\nSincronizando índices con los modelos actuales:");
  await VehicleModel.syncIndexes();
  console.log("  vehicles.syncIndexes() OK");
  await CompanyModel.syncIndexes();
  console.log("  companies.syncIndexes() OK");
  await DriverModel.syncIndexes();
  console.log("  drivers.syncIndexes() OK");

  // ── 4. Resumen ────────────────────────────────────────────────────────────
  const totalCompanies   = await CompanyModel.countDocuments({});
  const withScope        = await CompanyModel.countDocuments({ serviceScope: { $exists: true, $ne: null } });
  const urbanoDistrital  = await CompanyModel.countDocuments({ serviceScope: "urbano_distrital" });
  const interprovincial  = await CompanyModel.countDocuments({ serviceScope: "interprovincial_regional" });

  console.log("\n=== RESUMEN POST-MIGRACIÓN ===");
  console.log(`Companies total                : ${totalCompanies}`);
  console.log(`Con serviceScope               : ${withScope}`);
  console.log(`  urbano_distrital             : ${urbanoDistrital}`);
  console.log(`  interprovincial_regional     : ${interprovincial}`);
  console.log("\nMigración completada.");

  await mongoose.disconnect();
}

main().catch((err: unknown) => {
  console.error("Error en migración:", err instanceof Error ? err.message : err);
  process.exit(1);
});
