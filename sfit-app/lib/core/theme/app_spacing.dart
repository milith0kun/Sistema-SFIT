/// SFIT — Escala de spacing canónica (grid de 4 px).
///
/// Espejo de `--space-N` (web) y `spacing` en `tokens.ts`.
/// Úsalo en `EdgeInsets`, `SizedBox`, `Padding`, `Gap`, etc. para
/// mantener proporciones consistentes con la web y entre vistas.
///
/// Ejemplo:
/// ```dart
/// Padding(
///   padding: EdgeInsets.all(AppSpacing.lg),
///   child: ...,
/// );
/// SizedBox(height: AppSpacing.xl);
/// ```
class AppSpacing {
  AppSpacing._();

  /// 0 px — sin separación.
  static const double none = 0;

  /// 4 px — espacio entre icono y label en pills, ajustes finos.
  static const double xs = 4;

  /// 8 px — gap entre elementos pequeños (chips, badges, ítems de lista densa).
  static const double sm = 8;

  /// 12 px — gap entre campos de formulario relacionados.
  static const double md = 12;

  /// 16 px — padding interno base de tarjetas, separación entre secciones cortas.
  static const double base = 16;

  /// 20 px — padding cómodo en superficies principales.
  static const double lg = 20;

  /// 24 px — padding interno de cards principales, separación de secciones.
  static const double xl = 24;

  /// 32 px — separación entre bloques mayores en pantallas anchas.
  static const double xxl = 32;

  /// 40 px — separación de secciones en landing y pantallas vacías.
  static const double xxxl = 40;

  /// 48 px — separación máxima recomendada en mobile.
  static const double huge = 48;

  /// 64 px — separación entre módulos completos.
  static const double mega = 64;

  /// 80 px — usado en hero sections de landing.
  static const double hero = 80;

  /// 96 px — separación entre bloques de la home.
  static const double sectionGap = 96;
}
