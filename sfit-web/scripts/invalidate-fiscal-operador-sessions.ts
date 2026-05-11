/**
 * Invalida las sesiones activas de fiscal y operador tras la migración
 * que los mueve 100% a la app móvil.
 *
 * Qué hace:
 *   - Incrementa `sessionVersion` para que cualquier access token vigente
 *     (TTL 2h) sea rechazado por el server en la próxima petición.
 *   - Borra `refreshToken` y `refreshTokenExpiry` para forzar re-login.
 *
 * Tras correrlo, los fiscales y operadores que abran la web verán
 * `MobileOnlyScreen` (porque `MOBILE_ONLY_ROLES` los incluye), y los que
 * abran la app móvil deberán autenticarse nuevamente.
 *
 * Uso: npx tsx scripts/invalidate-fiscal-operador-sessions.ts
 */

import mongoose from "mongoose";
import { config } from "dotenv";
import dns from "node:dns";

// Bypass DNS del ISP para SRV de MongoDB+srv (patrón de create-admin.ts)
dns.setServers(["8.8.8.8", "1.1.1.1", "8.8.4.4"]);

config({ path: ".env.local" });

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error("Falta MONGODB_URI en .env.local");
    process.exit(1);
  }

  await mongoose.connect(uri);
  console.log("Conectado a MongoDB");

  const UserSchema = new mongoose.Schema(
    {},
    { strict: false, collection: "users" },
  );
  const User = mongoose.models.User ?? mongoose.model("User", UserSchema);

  const target = await User.countDocuments({
    role: { $in: ["fiscal", "operador"] },
  });
  console.log(`Encontrados ${target} usuarios con rol fiscal/operador.`);
  if (target === 0) {
    console.log("Nada que invalidar. Listo.");
    await mongoose.disconnect();
    return;
  }

  const result = await User.updateMany(
    { role: { $in: ["fiscal", "operador"] } },
    {
      $inc: { sessionVersion: 1 },
      $unset: { refreshToken: "", refreshTokenExpiry: "" },
    },
  );

  console.log(
    `✓ sessionVersion incrementado en ${result.modifiedCount} usuarios. ` +
    `Forzados a re-login en su próxima petición.`,
  );

  await mongoose.disconnect();
  console.log("Listo. Desconectado de MongoDB.");
}

main().catch((err) => {
  console.error("Error en script:", err);
  process.exit(1);
});
