import { NextResponse } from "next/server";

/**
 * GET /api/version — Versión mínima requerida de la app móvil.
 * Público: no requiere autenticación.
 * Para forzar actualización, incrementar minimumVersion.
 */
export async function GET() {
  return NextResponse.json({
    success: true,
    data: {
      minimumVersion: "1.1.0",
      latestVersion:  "1.1.0",
      playStoreUrl:   "https://play.google.com/store/apps/details?id=com.sfit.sfit_app",
      releaseNotes:   "Nueva gestión de usuarios, notificaciones de actualización y correcciones.",
    },
  });
}
