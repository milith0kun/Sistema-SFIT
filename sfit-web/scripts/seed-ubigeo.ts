/**
 * Seed UBIGEO INEI — pobla el catálogo nacional de provincias y distritos.
 *
 * Descarga el dataset oficial INEI 2016 desde el repositorio público
 * `ernestorivero/Ubigeo-Peru` (la división política del Perú es estable;
 * cambios se manejan con re-ejecución del seed).
 *
 * Política de activación:
 *   - Todo entra como `active: false` por defecto.
 *   - Re-ejecutar el seed NO desactiva los que ya están activos
 *     (el flag `active` solo se setea en $setOnInsert).
 *
 * Idempotente: upsert por `ubigeoCode`.
 *
 * Uso:
 *   cd sfit-web
 *   npx tsx scripts/seed-ubigeo.ts                # todo el país
 *   npx tsx scripts/seed-ubigeo.ts --depto=08     # solo Cusco
 *   npx tsx scripts/seed-ubigeo.ts --depto=08,15  # Cusco + Lima
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import mongoose, { Schema, model, Types } from "mongoose";
import dns from "dns";

dns.setServers(["8.8.8.8", "1.1.1.1", "8.8.4.4"]);

const SOURCE_BASE =
  "https://raw.githubusercontent.com/ernestorivero/Ubigeo-Peru/master/json";
const URL_DEPARTAMENTOS = `${SOURCE_BASE}/ubigeo_peru_2016_departamentos.json`;
const URL_PROVINCIAS    = `${SOURCE_BASE}/ubigeo_peru_2016_provincias.json`;
const URL_DISTRITOS     = `${SOURCE_BASE}/ubigeo_peru_2016_distritos.json`;

interface Departamento { id: string; name: string }
interface Provincia    { id: string; name: string; department_id: string }
interface Distrito     { id: string; name: string; province_id: string; department_id: string }

const loose = { strict: false, timestamps: true } as const;
const ProvinceModel     = mongoose.models.Province     ?? model("Province",     new Schema({}, loose));
const MunicipalityModel = mongoose.models.Municipality ?? model("Municipality", new Schema({}, loose));

function parseDeptoFilter(): Set<string> | null {
  const arg = process.argv.find((a) => a.startsWith("--depto="));
  if (!arg) return null;
  const value = arg.split("=")[1] ?? "";
  const set = new Set(value.split(",").map((s) => s.trim()).filter(Boolean));
  return set.size > 0 ? set : null;
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} al descargar ${url}`);
  return (await res.json()) as T;
}

async function dropLegacyIndex(coll: string, indexName: string): Promise<void> {
  try {
    const db = mongoose.connection.db;
    if (!db) return;
    const indexes = await db.collection(coll).indexes();
    if (indexes.some((i) => i.name === indexName)) {
      await db.collection(coll).dropIndex(indexName);
      console.log(`  dropped legacy index ${coll}.${indexName}`);
    }
  } catch (err) {
    console.warn(`  no se pudo eliminar índice ${coll}.${indexName}:`, err instanceof Error ? err.message : err);
  }
}

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI no definida en .env.local");

  const filter = parseDeptoFilter();
  console.log(filter
    ? `Filtro de departamentos: ${[...filter].join(", ")}`
    : "Sin filtro: se sembrará el país completo");

  // ── 1. Descargar dataset oficial ──────────────────────────────────────────
  console.log("\nDescargando dataset INEI desde GitHub…");
  const [departamentos, provincias, distritos] = await Promise.all([
    fetchJson<Departamento[]>(URL_DEPARTAMENTOS),
    fetchJson<Provincia[]>(URL_PROVINCIAS),
    fetchJson<Distrito[]>(URL_DISTRITOS),
  ]);
  console.log(`  ${departamentos.length} departamentos`);
  console.log(`  ${provincias.length} provincias`);
  console.log(`  ${distritos.length} distritos`);

  // Index para lookup rápido
  const deptByCode = new Map(departamentos.map((d) => [d.id, d]));

  // ── 2. Conectar a Mongo ───────────────────────────────────────────────────
  await mongoose.connect(uri);
  console.log("\nConectado a MongoDB");

  // El modelo antiguo tenía `name: { unique: true }` en Province; ahora hay
  // nombres repetidos (p.ej. depto "Cusco" tiene provincia "Cusco").
  await dropLegacyIndex("provinces", "name_1");
  await ProvinceModel.syncIndexes();
  await MunicipalityModel.syncIndexes();

  // ── 3. Upsert provincias (filtrando por depto si se pidió) ────────────────
  const provFiltered = filter
    ? provincias.filter((p) => filter.has(p.department_id))
    : provincias;

  let provincesCreated = 0;
  let provincesUpdated = 0;
  // Mapa ubigeoCode (4d) → ObjectId Mongo, para enlazar distritos
  const provinceIdByCode = new Map<string, Types.ObjectId>();

  for (const p of provFiltered) {
    const depto = deptByCode.get(p.department_id);
    if (!depto) {
      console.warn(`  provincia ${p.id} ${p.name} sin departamento conocido, saltando`);
      continue;
    }

    const existed = await ProvinceModel.findOne({ ubigeoCode: p.id }).select("_id").lean();
    const doc = await ProvinceModel.findOneAndUpdate(
      { ubigeoCode: p.id },
      {
        $set: {
          name: p.name,
          region: depto.name,
          ubigeoCode: p.id,
          departmentCode: p.department_id,
          departmentName: depto.name,
        },
        $setOnInsert: { active: false },
      },
      { upsert: true, returnDocument: "after" },
    );
    if (existed) provincesUpdated++; else provincesCreated++;
    provinceIdByCode.set(p.id, (doc as { _id: Types.ObjectId })._id);
  }
  console.log(`\nProvincias: ${provincesCreated} creadas, ${provincesUpdated} actualizadas`);

  // ── 4. Upsert distritos (en bulk para velocidad) ─────────────────────────
  const distFiltered = filter
    ? distritos.filter((d) => filter.has(d.department_id))
    : distritos;

  // Detectamos cuáles ya existen en una sola query, para reportar created vs updated.
  const existingCodes = new Set<string>(
    (await MunicipalityModel.find({ ubigeoCode: { $in: distFiltered.map((d) => d.id) } })
      .select("ubigeoCode").lean() as Array<{ ubigeoCode: string }>)
      .map((d) => d.ubigeoCode),
  );

  const ops = distFiltered
    .map((d) => {
      const provinceId = provinceIdByCode.get(d.province_id);
      if (!provinceId) return null;
      return {
        updateOne: {
          filter: { ubigeoCode: d.id },
          update: {
            $set: {
              name: d.name,
              provinceId,
              ubigeoCode: d.id,
              departmentCode: d.department_id,
              provinceCode: d.province_id,
            },
            $setOnInsert: { active: false },
          },
          upsert: true,
        },
      };
    })
    .filter((op): op is NonNullable<typeof op> => op !== null);

  const BATCH = 500;
  for (let i = 0; i < ops.length; i += BATCH) {
    const slice = ops.slice(i, i + BATCH);
    await MunicipalityModel.bulkWrite(slice, { ordered: false });
    process.stdout.write(`  bulk ${Math.min(i + BATCH, ops.length)}/${ops.length}\r`);
  }
  console.log("");
  const districtsCreated = distFiltered.filter((d) => !existingCodes.has(d.id)).length;
  const districtsUpdated = distFiltered.length - districtsCreated;
  console.log(`Distritos:  ${districtsCreated} creados, ${districtsUpdated} actualizados`);

  // ── 5. Resumen final ──────────────────────────────────────────────────────
  const totalProv = await ProvinceModel.countDocuments({ ubigeoCode: { $exists: true, $ne: null } });
  const totalDist = await MunicipalityModel.countDocuments({ ubigeoCode: { $exists: true, $ne: null } });
  const activeDist = await MunicipalityModel.countDocuments({
    ubigeoCode: { $exists: true, $ne: null }, active: true,
  });

  console.log("\n=== RESUMEN UBIGEO EN BD ===");
  console.log(`Provincias UBIGEO : ${totalProv}`);
  console.log(`Distritos  UBIGEO : ${totalDist}`);
  console.log(`Distritos activos : ${activeDist}`);
  console.log("\nLos distritos están INACTIVOS por defecto.");
  console.log("Activa los que se incorporen al sistema desde /municipalidades.");

  await mongoose.disconnect();
  console.log("\nSeed UBIGEO completado.");
}

main().catch((err: unknown) => {
  console.error("Error en seed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
