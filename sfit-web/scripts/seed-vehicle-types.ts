/**
 * Siembra los 2 tipos de vehículo predefinidos del sistema en todas las
 * municipalidades activas (Cotabambas Provincial + 6 distritos).
 *
 * Idempotente: salta los que ya existen y solo inserta los faltantes.
 *
 * El auto-seed del endpoint `/api/tipos-vehiculo` también garantiza esto,
 * pero solo se dispara cuando el admin abre la página. Este script lo
 * resuelve para todas las munis de una sola pasada, evitando "0/2 tipos
 * activos" para munis que tienen tipos legacy con otras keys.
 */
import { config } from "dotenv";
config({ path: ".env.local" });
import mongoose from "mongoose";
import dns from "dns";

dns.setServers(["8.8.8.8", "1.1.1.1"]);

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

(async () => {
  await mongoose.connect(process.env.MONGODB_URI!);
  const db = mongoose.connection.db!;

  const munis = await db
    .collection("municipalities")
    .find({ active: true }, { projection: { _id: 1, name: 1, ubigeoCode: 1 } })
    .toArray();
  console.log(`Munis activas encontradas: ${munis.length}`);

  let inserted = 0;
  let skipped = 0;
  for (const muni of munis) {
    for (const t of PREDEFINED_TYPES_SEED) {
      const existing = await db
        .collection("vehicletypes")
        .findOne({ municipalityId: muni._id, key: t.key });
      if (existing) {
        skipped += 1;
        continue;
      }
      await db.collection("vehicletypes").insertOne({
        municipalityId: muni._id,
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
      inserted += 1;
      console.log(`  + ${muni.name} (${muni.ubigeoCode}): ${t.key}`);
    }
  }

  console.log(`\nInsertados: ${inserted} · Ya existían: ${skipped}`);
  await mongoose.disconnect();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
