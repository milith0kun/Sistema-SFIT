/**
 * Migración: rol "admin_regional" → "admin_provincial".
 *
 * Contexto: el rol `admin_regional` quedó identificado en
 * `graphify-out/role_drift_report.md` como "fantasma": existía en la UI
 * (VIEW_ROLES de varias páginas) pero la API lo rechazaba con 403 en buena
 * parte de los endpoints. Aprobamos en el plan eliminarlo del sistema. Como
 * paso final de la limpieza, este script promueve a los usuarios con
 * `role=admin_regional` a `role=admin_provincial` y, opcionalmente, también
 * incrementa su `sessionVersion` para invalidar las sesiones vivas con el
 * rol viejo (igual que cuando un admin cambia el rol manualmente).
 *
 * Idempotente: re-ejecutar es seguro (matches caen a 0 tras la primera
 * corrida).
 *
 * Uso: cd sfit-web && npx tsx scripts/migrate-admin-regional.ts
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import mongoose, { Schema, model } from "mongoose";
import dns from "dns";
dns.setServers(["8.8.8.8", "1.1.1.1", "8.8.4.4"]);

const loose = { strict: false, timestamps: true } as const;
const UserModel = mongoose.models.User ?? model("User", new Schema({}, loose));

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error("✖ Falta MONGODB_URI en .env.local");
    process.exit(1);
  }

  console.log("→ Conectando a Mongo…");
  await mongoose.connect(uri);

  console.log("→ Contando usuarios con role='admin_regional'…");
  const before = await UserModel.countDocuments({ role: "admin_regional" });
  console.log(`  ${before} encontrados`);

  if (before === 0) {
    console.log("✓ Nada que migrar.");
    await mongoose.disconnect();
    return;
  }

  console.log("→ Migrando admin_regional → admin_provincial…");
  const result = await UserModel.updateMany(
    { role: "admin_regional" },
    {
      $set: { role: "admin_provincial" },
      $inc: { sessionVersion: 1 },
      $unset: { refreshToken: "", refreshTokenExpiry: "" },
    },
  );
  console.log(`  modificados: ${result.modifiedCount}`);

  const after = await UserModel.countDocuments({ role: "admin_regional" });
  console.log(`✓ Restantes con admin_regional: ${after}`);

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error("✖", err);
  process.exit(1);
});
