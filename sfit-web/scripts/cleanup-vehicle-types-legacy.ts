/**
 * Limpia el catálogo de tipos de vehículo de keys legacy y migra las
 * referencias en `Company.vehicleTypeKeys` a las 2 keys vigentes.
 *
 * En el modelo actual (mono-muni administrativo Cotabambas) solo existen
 * 2 tipos predefinidos:
 *   - `transporte_urbano`
 *   - `transporte_interprovincial`
 *
 * Cualquier otro tipo (minibus, omnibus, taxi, microbus, transporte_publico,
 * limpieza_residuos, maquinaria, municipal_general, registros sin key) son
 * sobras de seeds antiguos y producen UI confusa (chips duplicados, dropdowns
 * llenos de opciones que no se usan).
 *
 * Mapeo de migración para `Company.vehicleTypeKeys`:
 *   minibus, omnibus, microbus, taxi, transporte_publico → transporte_urbano
 *   limpieza_residuos, maquinaria, municipal_general, (otros)             → eliminar
 *
 * Idempotente: re-ejecutar es seguro.
 */
import { config } from "dotenv";
config({ path: ".env.local" });
import mongoose from "mongoose";
import dns from "dns";

dns.setServers(["8.8.8.8", "1.1.1.1"]);

const VALID_KEYS = new Set([
  "transporte_urbano",
  "transporte_interprovincial",
]);

/** Keys legacy que conceptualmente eran "transporte de pasajeros urbano". */
const URBAN_LEGACY = new Set([
  "minibus",
  "omnibus",
  "microbus",
  "taxi",
  "transporte_publico",
]);

(async () => {
  await mongoose.connect(process.env.MONGODB_URI!);
  const db = mongoose.connection.db!;

  // 1) Borrar VehicleType con keys legacy o sin key.
  const legacyVTRes = await db.collection("vehicletypes").deleteMany({
    $or: [
      { key: { $exists: false } },
      { key: null },
      { key: "" },
      { key: { $nin: ["transporte_urbano", "transporte_interprovincial"] } },
    ],
  });
  console.log(`VehicleType legacy eliminados: ${legacyVTRes.deletedCount}`);

  // 2) Migrar Company.vehicleTypeKeys: mapear legacy → transporte_urbano,
  //    eliminar inválidas, dedupe.
  const companies = await db
    .collection("companies")
    .find(
      {},
      { projection: { _id: 1, razonSocial: 1, vehicleTypeKeys: 1 } },
    )
    .toArray();

  let migrated = 0;
  for (const c of companies) {
    const original: string[] = (c as { vehicleTypeKeys?: string[] }).vehicleTypeKeys ?? [];
    if (original.length === 0) continue;
    const next: string[] = [];
    for (const k of original) {
      if (VALID_KEYS.has(k)) {
        if (!next.includes(k)) next.push(k);
      } else if (URBAN_LEGACY.has(k)) {
        if (!next.includes("transporte_urbano")) next.push("transporte_urbano");
      }
      // resto: descartar silenciosamente
    }
    const sameLength = next.length === original.length;
    const sameContent =
      sameLength &&
      original.every((k, i) => k === next[i]);
    if (sameContent) continue;
    await db
      .collection("companies")
      .updateOne(
        { _id: (c as { _id: unknown })._id as never },
        { $set: { vehicleTypeKeys: next } },
      );
    migrated += 1;
    console.log(
      `  ↻ ${(c as unknown as { razonSocial: string }).razonSocial}: [${original.join(",")}] → [${next.join(",")}]`,
    );
  }
  console.log(`Empresas migradas: ${migrated}`);

  // 3) Re-asegurar predefinidos en todas las munis activas (idempotente
  //    por unique {municipalityId, key}).
  const munis = await db
    .collection("municipalities")
    .find({ active: true }, { projection: { _id: 1, name: 1 } })
    .toArray();
  const PREDEFINED_TYPES_SEED = [
    {
      key: "transporte_urbano",
      name: "Transporte urbano",
      description:
        "Combis y colectivos que operan dentro de los 6 distritos de Cotabambas. Rutas con paraderos definidos.",
    },
    {
      key: "transporte_interprovincial",
      name: "Transporte interprovincial",
      description:
        "Buses que salen de Cotabambas hacia Cusco, Abancay o Arequipa. Rutas origen-destino sin paraderos intermedios.",
    },
  ] as const;
  let reseeded = 0;
  for (const muni of munis) {
    for (const t of PREDEFINED_TYPES_SEED) {
      const existing = await db
        .collection("vehicletypes")
        .findOne({ municipalityId: (muni as { _id: unknown })._id as never, key: t.key });
      if (existing) continue;
      await db.collection("vehicletypes").insertOne({
        municipalityId: (muni as { _id: unknown })._id as never,
        key: t.key,
        name: t.name,
        description: t.description,
        checklistItems: [],
        inspectionFields: [],
        reportCategories: [],
        isCustom: false,
        active: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      reseeded += 1;
    }
  }
  console.log(`VehicleType re-sembrados: ${reseeded}`);

  // 4) Resumen final.
  const finalTypes = await db
    .collection("vehicletypes")
    .find({}, { projection: { key: 1 } })
    .toArray();
  const finalKeys = new Map<string, number>();
  for (const v of finalTypes) {
    const k = (v as unknown as { key: string }).key;
    finalKeys.set(k, (finalKeys.get(k) ?? 0) + 1);
  }
  console.log("\nEstado final por key:");
  for (const [k, n] of [...finalKeys.entries()].sort()) {
    console.log(`  ${k}: ${n}`);
  }

  await mongoose.disconnect();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
