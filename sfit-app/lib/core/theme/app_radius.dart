import 'package:flutter/widgets.dart';

/// SFIT — Escala de border-radius canónica.
///
/// Espejo de `--radius-*` (web) y `radius` en `tokens.ts`.
/// Provee constantes en `double` y `BorderRadius` listos para usar.
///
/// Ejemplo:
/// ```dart
/// Container(
///   decoration: BoxDecoration(
///     borderRadius: AppRadius.lgAll,
///     color: Colors.white,
///   ),
/// );
/// ```
class AppRadius {
  AppRadius._();

  // ── Valores en double ──────────────────────────────────────────
  static const double xs   = 6;
  static const double sm   = 8;
  static const double md   = 10;
  static const double lg   = 12;
  static const double xl   = 16;
  static const double xxl  = 24;
  static const double full = 9999;

  // ── BorderRadius.all() pre-construidos ─────────────────────────
  static const BorderRadius xsAll  = BorderRadius.all(Radius.circular(xs));
  static const BorderRadius smAll  = BorderRadius.all(Radius.circular(sm));
  static const BorderRadius mdAll  = BorderRadius.all(Radius.circular(md));
  static const BorderRadius lgAll  = BorderRadius.all(Radius.circular(lg));
  static const BorderRadius xlAll  = BorderRadius.all(Radius.circular(xl));
  static const BorderRadius xxlAll = BorderRadius.all(Radius.circular(xxl));
  static const BorderRadius fullAll = BorderRadius.all(Radius.circular(full));
}
