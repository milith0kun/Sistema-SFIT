import { NextResponse } from "next/server";

/**
 * GET /api/version — Versión mínima y última disponible de la app móvil.
 * Público: no requiere autenticación.
 *
 * Para forzar actualización cuando se suba una nueva versión a Play Store:
 *   1. Incrementar `latestVersion` con la nueva versión.
 *   2. Si es obligatoria (breaking), incrementar también `minimumVersion`.
 *   3. Cambiar `forceUpdate` a true si quieres que no haya opción "Más tarde".
 *   4. Actualizar `releaseNotes` con las novedades visibles al usuario.
 */
export async function GET() {
  return NextResponse.json({
    success: true,
    data: {
      // ── Versiones ────────────────────────────────────────────
      minimumVersion: "1.2.0",   // Versión mínima soportada — debajo → dialog FORZADO
      latestVersion:  "1.3.0",   // Última versión en Play Store → dialog opcional si hay diferencia

      // ── Play Store ───────────────────────────────────────────
      playStoreUrl: "https://play.google.com/store/apps/details?id=com.sfit.sfit_app",

      // ── Control de actualización forzada ────────────────────
      // true  → oculta "Más tarde", el usuario DEBE actualizar antes de continuar
      // false → muestra "Más tarde", la actualización es voluntaria
      forceUpdate: false,

      // ── Novedades mostradas en el diálogo ────────────────────
      // Dejar vacío ("") para no mostrar la sección de novedades
      releaseNotes:
          "• Buses en vivo: ve dónde está cada bus de tu ciudad en tiempo real.\n"
          "• Conductor: al iniciar tu turno se abre el mapa con la ruta y paraderos.\n"
          "• Detalle de ruta con mini-mapa interactivo y lista de paradas.\n"
          "• Operadores pueden editar rutas desde el app.\n"
          "• Imágenes de evidencia ahora cargan correctamente.\n"
          "• Mejoras en el inicio con Google y carga más rápida.",
    },
  });
}
