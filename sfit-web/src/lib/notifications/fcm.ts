/**
 * FCM — Firebase Cloud Messaging via Firebase Admin SDK (RF-18)
 *
 * Variables de entorno requeridas:
 *   FIREBASE_PROJECT_ID     — ID del proyecto Firebase (ej. sfit-xxx)
 *   FIREBASE_CLIENT_EMAIL   — Email de la cuenta de servicio firebase-adminsdk
 *   FIREBASE_PRIVATE_KEY    — Clave privada PEM (con \n literales en .env)
 *
 * DEPENDENCIA OPCIONAL: npm install firebase-admin
 * Si FIREBASE_PROJECT_ID no está configurado, todas las funciones se resuelven
 * sin error (modo degradado tolerante).
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _app: any = null;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getAdminApp(): Promise<any> {
  if (!process.env.FIREBASE_PROJECT_ID) return null;
  if (_app) return _app;

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
    const adminModule = require("firebase-admin") as any;
    const { cert } = adminModule.credential;

    if (adminModule.apps.length > 0) {
      _app = adminModule.apps[0];
      return _app;
    }

    const privateKey = (process.env.FIREBASE_PRIVATE_KEY ?? "").replace(/\\n/g, "\n");

    _app = adminModule.initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey,
      }),
    });

    return _app;
  } catch (err) {
    console.error("[FCM] Error inicializando Firebase Admin:", err);
    return null;
  }
}

export async function sendPushToUser(
  userId: string,
  title: string,
  body: string,
  data?: Record<string, string>,
): Promise<void> {
  try {
    const app = await getAdminApp();
    if (!app) return;

    const { connectDB } = await import("@/lib/db/mongoose");
    const { User } = await import("@/models/User");

    await connectDB();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const user = await User.findById(userId).select("fcmTokens").lean() as any;
    if (!user?.fcmTokens?.length) return;

    await sendPushToTokens(user.fcmTokens, title, body, data);
  } catch (err) {
    console.error(`[FCM] sendPushToUser(${userId}) falló:`, err);
  }
}

export async function sendPushToTokens(
  tokens: string[],
  title: string,
  body: string,
  data?: Record<string, string>,
): Promise<void> {
  if (tokens.length === 0) return;

  try {
    const app = await getAdminApp();
    if (!app) return;

    // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
    const adminModule = require("firebase-admin") as any;
    const messaging = adminModule.messaging(app);

    const message = {
      tokens,
      notification: { title, body },
      android: { priority: "high", notification: { sound: "default" } },
      apns: { payload: { aps: { sound: "default" } } },
      ...(data ? { data } : {}),
    };

    const response = await messaging.sendEachForMulticast(message);

    if (response.failureCount > 0) {
      console.warn(`[FCM] ${response.failureCount}/${tokens.length} tokens fallaron`);
    }
  } catch (err) {
    console.error("[FCM] sendPushToTokens falló:", err);
  }
}
