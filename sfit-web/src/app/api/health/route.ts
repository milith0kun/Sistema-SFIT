import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db/mongoose";

const VERSION = "1.5.0";

/**
 * GET /api/health
 * Health check completo del sistema SFIT.
 * Sin autenticación. Siempre responde HTTP 200 aunque algún check falle
 * (status "degraded") — el servicio está up aunque un componente no.
 */
export async function GET() {
  const checks: Record<string, "ok" | "error" | "not_configured" | "not_installed"> = {
    database: "error",
    firebase: "not_configured",
    ocr: "not_installed",
  };

  // ── 1. MongoDB ──────────────────────────────────────────────────────────────
  try {
    const mongoose = await connectDB();
    checks.database = mongoose.connection.readyState === 1 ? "ok" : "error";
  } catch {
    checks.database = "error";
  }

  // ── 2. Firebase / FCM ───────────────────────────────────────────────────────
  // Firebase se considera configurado si están las variables críticas presentes
  const firebaseConfigured =
    !!process.env.FIREBASE_PROJECT_ID &&
    !!process.env.FIREBASE_CLIENT_EMAIL &&
    !!process.env.FIREBASE_PRIVATE_KEY;
  checks.firebase = firebaseConfigured ? "ok" : "not_configured";

  // ── 3. OCR (Tesseract / servicio externo) ───────────────────────────────────
  // Se considera instalado si la variable de entorno del servicio OCR está presente
  const ocrConfigured = !!process.env.OCR_SERVICE_URL || !!process.env.TESSERACT_PATH;
  checks.ocr = ocrConfigured ? "ok" : "not_installed";

  // ── Estado global ────────────────────────────────────────────────────────────
  const allOk = Object.values(checks).every((v) => v === "ok" || v === "not_configured" || v === "not_installed");
  const hasCriticalError = checks.database === "error";
  const status = hasCriticalError ? "degraded" : "ok";

  // HTTP 200 siempre — el servicio está respondiendo aunque esté degraded
  return NextResponse.json(
    {
      success: true,
      data: {
        status,
        version: VERSION,
        timestamp: new Date().toISOString(),
        checks,
        // Variables de entorno críticas presentes (sin exponer valores)
        env: {
          MONGODB_URI: !!process.env.MONGODB_URI,
          JWT_SECRET: !!process.env.JWT_SECRET,
          NEXTAUTH_SECRET: !!process.env.NEXTAUTH_SECRET,
          GOOGLE_CLIENT_ID: !!process.env.GOOGLE_CLIENT_ID,
          QR_HMAC_SECRET: !!process.env.QR_HMAC_SECRET,
        },
      },
    },
    { status: 200 },
  );
}
