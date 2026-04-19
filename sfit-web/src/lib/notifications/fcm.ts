/**
 * FCM — Firebase Cloud Messaging via Firebase Admin SDK (RF-18)
 *
 * Variables de entorno requeridas:
 *   FIREBASE_PROJECT_ID     — ID del proyecto Firebase (ej. sfit-xxx)
 *   FIREBASE_CLIENT_EMAIL   — Email de la cuenta de servicio firebase-adminsdk
 *   FIREBASE_PRIVATE_KEY    — Clave privada PEM (con \n literales en .env)
 *
 * DEPENDENCIA: npm install firebase-admin
 * Si la variable FIREBASE_PROJECT_ID no está configurada, todas las funciones
 * se resuelven sin error (modo degradado tolerante).
 */

import type admin from "firebase-admin";

// Importación dinámica para que el módulo sea opcional en tiempo de ejecución
let _app: admin.app.App | null = null;

async function getAdminApp(): Promise<admin.app.App | null> {
  if (!process.env.FIREBASE_PROJECT_ID) {
    // Firebase no configurado: modo degradado
    return null;
  }

  if (_app) return _app;

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const adminModule = require("firebase-admin") as typeof admin;
    const { cert } = adminModule.credential;

    // Verificar si ya existe una app inicializada (Next.js hot-reload)
    if (adminModule.apps.length > 0) {
      _app = adminModule.apps[0]!;
      return _app;
    }

    const privateKey = (process.env.FIREBASE_PRIVATE_KEY ?? "").replace(
      /\\n/g,
      "\n",
    );

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

/**
 * Envía una notificación push a todos los tokens FCM de un usuario.
 * Obtiene los tokens desde MongoDB (el modelo User debe estar ya hidratado).
 *
 * No lanza excepción — falla silenciosamente para no bloquear el flujo principal.
 */
export async function sendPushToUser(
  userId: string,
  title: string,
  body: string,
  data?: Record<string, string>,
): Promise<void> {
  try {
    const app = await getAdminApp();
    if (!app) return;

    // Importar User aquí para evitar ciclos si fcm.ts se importa desde modelos
    const { connectDB } = await import("@/lib/db/mongoose");
    const { User } = await import("@/models/User");

    await connectDB();
    const user = await User.findById(userId).select("fcmTokens").lean();
    if (!user || !user.fcmTokens || user.fcmTokens.length === 0) return;

    await sendPushToTokens(user.fcmTokens, title, body, data);
  } catch (err) {
    console.error(`[FCM] sendPushToUser(${userId}) falló:`, err);
  }
}

/**
 * Envía una notificación push a una lista de tokens FCM.
 * Tokens inválidos/expirados se ignoran automáticamente.
 *
 * No lanza excepción — falla silenciosamente.
 */
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

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const adminModule = require("firebase-admin") as typeof admin;
    const messaging = adminModule.messaging(app);

    const message: admin.messaging.MulticastMessage = {
      tokens,
      notification: { title, body },
      android: {
        priority: "high",
        notification: { sound: "default" },
      },
      apns: {
        payload: { aps: { sound: "default" } },
      },
      ...(data ? { data } : {}),
    };

    const response = await messaging.sendEachForMulticast(message);

    if (response.failureCount > 0) {
      console.warn(
        `[FCM] ${response.failureCount}/${tokens.length} tokens fallaron`,
      );
    }
  } catch (err) {
    console.error("[FCM] sendPushToTokens falló:", err);
  }
}
