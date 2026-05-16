/**
 * Migración: usuarios con roles deprecados (admin_regional / admin_provincial)
 * → admin_municipal de Cotabambas (Tambobamba, UBIGEO 080701).
 *
 * Contexto:
 *   - Desde Fase 2 (mayo 2026) la web solo acepta super_admin y
 *     admin_municipal. Los usuarios legacy con admin_regional o
 *     admin_provincial dejarían de poder ingresar.
 *   - Los promovemos a admin_municipal y los apuntamos a la muni activa
 *     (Cotabambas, Tambobamba) si no tienen muni asignada.
 *   - Incrementamos sessionVersion para invalidar JWT en clientes (forzar
 *     re-login con el rol nuevo).
 *
 * Uso:
 *   npx tsx scripts/migrate-deprecated-admin-roles.ts             # dry-run por defecto
 *   npx tsx scripts/migrate-deprecated-admin-roles.ts --apply     # aplicar cambios
 *
 * Idempotente: solo afecta usuarios con role en {admin_regional, admin_provincial}.
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

// UBIGEO de Tambobamba (sede de la Muni Provincial de Cotabambas, Apurímac).
// Verificado en BD: provincia 0305 (Cotabambas), distrito 030501 (Tambobamba).
const TARGET_MUNICIPALITY_UBIGEO = "030501";

const APPLY = process.argv.includes("--apply");

async function main() {
  console.log(`🔌 Conectando a MongoDB Atlas... ${APPLY ? "(APLICANDO)" : "(DRY RUN)"}`);
  await mongoose.connect(MONGODB_URI!);
  console.log(`✅ Conectado a la base: ${mongoose.connection.name}`);

  const usersCol = mongoose.connection.db!.collection("users");
  const munisCol = mongoose.connection.db!.collection("municipalities");

  // 1. Resolver la municipalidad destino
  const targetMuni = await munisCol.findOne(
    { ubigeoCode: TARGET_MUNICIPALITY_UBIGEO },
    { projection: { _id: 1, name: 1, provinceId: 1 } },
  );
  if (!targetMuni) {
    console.error(`❌ No se encontró la municipalidad con UBIGEO ${TARGET_MUNICIPALITY_UBIGEO}. Ejecuta seed-ubigeo primero.`);
    process.exit(1);
  }
  console.log(`📍 Municipalidad destino: ${targetMuni.name} (${targetMuni._id})`);

  // 2. Buscar usuarios deprecados
  const deprecated = await usersCol
    .find({ role: { $in: ["admin_regional", "admin_provincial"] } })
    .project({ _id: 1, name: 1, email: 1, role: 1, municipalityId: 1 })
    .toArray();

  console.log(`\n📦 Encontrados ${deprecated.length} usuarios con roles deprecados:`);
  for (const u of deprecated) {
    console.log(`   - ${u.email} (${u.role}) → admin_municipal · muni ${u.municipalityId ? "ya asignada" : "asignar Cotabambas"}`);
  }

  if (deprecated.length === 0) {
    console.log("\n✅ Nada que migrar.");
    await mongoose.disconnect();
    return;
  }

  if (!APPLY) {
    console.log(`\n⚠️  DRY RUN: no se aplicó ningún cambio. Vuelve a correr con --apply para ejecutar.`);
    await mongoose.disconnect();
    return;
  }

  // 3. Aplicar migración: cambiar role + asignar muni si falta + invalidar sesión
  let updated = 0;
  for (const u of deprecated) {
    const set: Record<string, unknown> = {
      role: "admin_municipal",
    };
    if (!u.municipalityId) {
      set.municipalityId = targetMuni._id;
      // provinceId/regionId se derivarán en el próximo save vía hooks de User.
    }
    await usersCol.updateOne(
      { _id: u._id },
      {
        $set: set,
        $inc: { sessionVersion: 1 },
      },
    );
    updated += 1;
  }

  console.log(`\n✅ Migración aplicada: ${updated} usuarios promovidos a admin_municipal.`);
  console.log(`   sessionVersion incrementado → los JWT vivos serán rechazados con SESSION_INVALIDATED en la próxima request.`);

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error("❌ Migración falló:", err);
  process.exit(1);
});
