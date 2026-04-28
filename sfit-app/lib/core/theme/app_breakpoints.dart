import 'package:flutter/widgets.dart';

/// SFIT — Breakpoints unificados con la web.
///
/// Espejo de `--bp-*` (CSS) y `breakpoints` en `tokens.ts`.
/// Permite tomar decisiones de layout consistentes entre móvil, tablet
/// y los distintos tamaños de escritorio cuando la app corre en web.
///
/// Ejemplo:
/// ```dart
/// final w = MediaQuery.sizeOf(context).width;
/// if (AppBreakpoints.isTablet(w)) {
///   return TabletLayout();
/// }
/// return MobileLayout();
/// ```
class AppBreakpoints {
  AppBreakpoints._();

  /// 375 px — iPhone SE / pantallas mobile pequeñas.
  static const double mobileSm = 375;

  /// 425 px — Pixel / Android estándar.
  static const double mobileLg = 425;

  /// 768 px — iPad portrait, tablets.
  static const double tablet = 768;

  /// 1024 px — laptops pequeños / iPad landscape.
  static const double desktop = 1024;

  /// 1280 px — escritorio estándar.
  static const double wide = 1280;

  /// 1440 px — pantallas grandes.
  static const double xl = 1440;

  // ── Helpers ────────────────────────────────────────────────────

  static bool isMobile(double width)  => width <  tablet;
  static bool isTablet(double width)  => width >= tablet  && width <  desktop;
  static bool isDesktop(double width) => width >= desktop && width <  wide;
  static bool isWide(double width)    => width >= wide    && width <  xl;
  static bool isXl(double width)      => width >= xl;

  /// `true` si el ancho actual es ≥ tablet (768 px).
  static bool isTabletUp(BuildContext ctx) =>
      MediaQuery.sizeOf(ctx).width >= tablet;

  /// `true` si el ancho actual es ≥ desktop (1024 px).
  static bool isDesktopUp(BuildContext ctx) =>
      MediaQuery.sizeOf(ctx).width >= desktop;
}
