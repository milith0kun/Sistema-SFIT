/**
 * Envía una push de prueba a un usuario.
 *
 * Uso:
 *   npx tsx scripts/test-fcm-push.ts <email>
 *   npx tsx scripts/test-fcm-push.ts conductor@sfit.test
 *
 * Verifica:
 *   1. Que las 3 vars FIREBASE_* están en .env.local.
 *   2. Que el usuario existe y tiene fcmTokens registrados.
 *   3. Que el envío via Firebase Admin no falla.
 */
import { config } from "dotenv";
config({ path: ".env.local" });
import mongoose from "mongoose";
import dns from "dns";

dns.setServers(["8.8.8.8", "1.1.1.1"]);

const email = process.argv[2];
if (!email) {
  console.error("Uso: npx tsx scripts/test-fcm-push.ts <email>");
  process.exit(1);
}

for (const v of ["FIREBASE_PROJECT_ID", "FIREBASE_CLIENT_EMAIL", "FIREBASE_PRIVATE_KEY"]) {
  if (!process.env[v]) {
    console.error(`Falta ${v} en .env.local. Corre: npx tsx scripts/extract-firebase-env.ts`);
    process.exit(1);
  }
}

(async () => {
  await mongoose.connect(process.env.MONGODB_URI!);
  const db = mongoose.connection.db!;

  const user = (await db
    .collection("users")
    .findOne({ email: email.toLowerCase() }, { projection: { _id: 1, name: 1, fcmTokens: 1 } })) as
    | { _id: unknown; name?: string; fcmTokens?: string[] }
    | null;

  if (!user) {
    console.error(`No encontré usuario con email "${email}".`);
    await mongoose.disconnect();
    process.exit(1);
  }
  const tokens = user.fcmTokens ?? [];
  console.log(`Usuario: ${user.name ?? "?"} (${String(user._id)})`);
  console.log(`Tokens FCM registrados: ${tokens.length}`);

  if (tokens.length === 0) {
    console.warn(
      "Sin tokens. El conductor debe abrir el app móvil ya logueado al " +
        "menos una vez para que se registre su token vía POST /api/notificaciones/token.",
    );
    await mongoose.disconnect();
    return;
  }

  // Enviamos directo con firebase-admin para poder inspeccionar la respuesta
  // detallada por cada token (success/failure + error code).
  // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
  const adminModule = require("firebase-admin") as any;
  const privateKey = (process.env.FIREBASE_PRIVATE_KEY ?? "").replace(/\\n/g, "\n");
  const app =
    adminModule.apps.length > 0
      ? adminModule.apps[0]
      : adminModule.initializeApp({
          credential: adminModule.credential.cert({
            projectId: process.env.FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey,
          }),
        });

  const messaging = adminModule.messaging(app);
  const message = {
    tokens,
    notification: {
      title: "SFIT — Prueba de push",
      body: `Hola ${user.name ?? ""}, esta es una prueba. ${new Date().toLocaleTimeString("es-PE")}`,
    },
    android: {
      priority: "high",
      notification: {
        sound: "default",
        channelId: "sfit_alerts",
      },
    },
    data: { kind: "test", source: "cli" },
  };

  console.log("Enviando...");
  const response = await messaging.sendEachForMulticast(message);
  console.log(`\nResultado: ${response.successCount} OK · ${response.failureCount} fallidos`);
  response.responses.forEach((r: { success: boolean; messageId?: string; error?: { code?: string; message?: string } }, i: number) => {
    if (r.success) {
      console.log(`  [${i}] ✓ messageId=${r.messageId}`);
    } else {
      console.log(`  [${i}] ✗ code=${r.error?.code} message=${r.error?.message}`);
    }
  });

  await mongoose.disconnect();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
