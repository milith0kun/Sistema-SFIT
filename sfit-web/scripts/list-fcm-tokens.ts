/**
 * Lista todos los usuarios que tienen al menos 1 token FCM registrado.
 * Útil para saber a quién se le puede mandar push de prueba.
 */
import { config } from "dotenv";
config({ path: ".env.local" });
import mongoose from "mongoose";
import dns from "dns";

dns.setServers(["8.8.8.8", "1.1.1.1"]);

(async () => {
  await mongoose.connect(process.env.MONGODB_URI!);
  const db = mongoose.connection.db!;

  const users = await db
    .collection("users")
    .find(
      { fcmTokens: { $exists: true, $not: { $size: 0 } } },
      { projection: { _id: 1, name: 1, email: 1, role: 1, fcmTokens: 1 } },
    )
    .toArray();

  if (users.length === 0) {
    console.log("Ningún usuario tiene tokens FCM registrados.");
    console.log("");
    console.log("Pasos para registrar uno:");
    console.log("  1. flutter clean && flutter run (en sfit-app)");
    console.log("  2. Inicia sesión en el dispositivo.");
    console.log("  3. El log mostrará '[FCM] Token registrado en backend correctamente'.");
    console.log("  4. Volver a correr este script.");
    await mongoose.disconnect();
    return;
  }

  console.log(`Usuarios con tokens FCM: ${users.length}\n`);
  for (const u of users) {
    const user = u as unknown as {
      _id: unknown;
      name?: string;
      email?: string;
      role?: string;
      fcmTokens?: string[];
    };
    const n = user.fcmTokens?.length ?? 0;
    console.log(
      `  ${(user.email ?? "?").padEnd(35)} ${(user.role ?? "?").padEnd(18)} tokens=${n}`,
    );
  }

  await mongoose.disconnect();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
