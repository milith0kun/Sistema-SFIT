import 'package:flutter/material.dart';

/// Paleta oficial SFIT — espejo del canon web (`sfit-web`).
///
/// Tokens organizados por familia:
///   - primary*    : acento institucional (rojo #6C0606)
///   - panel*      : superficies oscuras (navy)
///   - ink*/paper  : escala neutra zinc
///   - apto/riesgo/noApto + bg/border : estados vehiculares
///   - info        : azul informativo (eventos, "en ruta" alt)
///
/// Regla: NO hardcodees colores fuera de esta clase.
class AppColors {
  AppColors._();

  // ── Acento institucional (rojo) ──────────────────────────────
  static const Color primary       = Color(0xFF6C0606);
  static const Color primaryLight  = Color(0xFF8B1414);
  static const Color primaryDark   = Color(0xFF4A0303);
  static const Color primaryBg     = Color(0xFFFBEAEA);
  static const Color primaryBorder = Color(0xFFD9B0B0);

  /// Rojo institucional adaptado para superficies oscuras.
  /// Contraste ≥ 4.5:1 sobre `ink` (#09090B). Espejo de
  /// `oklch(0.55 0.18 27)` definido en `globals.css .dark`.
  static const Color primaryOnDark = Color(0xFFBA2C2C);

  // ── Legacy gold aliases (DEPRECATED — usar primary*) ─────────
  static const Color gold        = primary;
  static const Color goldLight   = primaryLight;
  static const Color goldDark    = primaryDark;
  static const Color goldBg      = primaryBg;
  static const Color goldBorder  = primaryBorder;

  // ── Panel oscuro (sidebar / auth / hero) ────────────────────
  static const Color panel       = Color(0xFF0A1628);
  static const Color panelMid    = Color(0xFF111F38);
  static const Color panelLight  = Color(0xFF1A2D4A);

  // ── Zinc monochrome (ink) ────────────────────────────────────
  static const Color ink         = Color(0xFF09090B); // zinc-950
  static const Color ink9        = Color(0xFF18181B); // zinc-900
  static const Color ink8        = Color(0xFF27272A); // zinc-800
  static const Color ink7        = Color(0xFF3F3F46); // zinc-700
  static const Color ink6        = Color(0xFF52525B); // zinc-600
  static const Color ink5        = Color(0xFF71717A); // zinc-500
  static const Color ink4        = Color(0xFFA1A1AA); // zinc-400
  static const Color ink3        = Color(0xFFD4D4D8); // zinc-300
  static const Color ink2        = Color(0xFFE4E4E7); // zinc-200
  static const Color ink1        = Color(0xFFF4F4F5); // zinc-100
  static const Color paper       = Color(0xFFFAFAFA); // zinc-50

  // ── Estado: apto (verde) ─────────────────────────────────────
  static const Color apto        = Color(0xFF15803D);
  static const Color aptoBg      = Color(0xFFECFDF5);
  static const Color aptoBorder  = Color(0xFF86EFAC);

  // ── Estado: riesgo / pendiente / mantenimiento (naranja) ─────
  static const Color riesgo      = Color(0xFFB45309);
  static const Color riesgoBg    = Color(0xFFFFF7ED);
  static const Color riesgoBorder= Color(0xFFFED7AA);

  // ── Estado: no apto / rechazado / suspendido (rojo brillante) ──────────
  // Tono más vivo para diferenciarse del primary institucional (rojo oscuro).
  static const Color noApto      = Color(0xFFDC2626);
  static const Color noAptoBg    = Color(0xFFFEF2F2);
  static const Color noAptoBorder= Color(0xFFFCA5A5);

  // ── Info (azul) ──────────────────────────────────────────────
  static const Color info        = Color(0xFF1D4ED8);
  static const Color infoBg      = Color(0xFFEFF6FF);
  static const Color infoBorder  = Color(0xFFBFDBFE);

  // ── Purple (interprovincial badges) ──────────────────────────
  static const Color purple       = Color(0xFF7C3AED);
  static const Color purpleBg     = Color(0xFFF5F3FF);
  static const Color purpleBorder = Color(0xFFDDD6FE);

  // ── Riesgo variants (naranja/ámbar) ──────────────────────────
  static const Color riesgoDark   = Color(0xFF92400E);
  static const Color riesgoDarker = Color(0xFF78350F);
  static const Color riesgoAmber  = Color(0xFFD97706);
  static const Color riesgoAltBg  = Color(0xFFFFF4E5);
  static const Color riesgoAltBg2 = Color(0xFFFFFBEB);
  static const Color riesgoAltBg3 = Color(0xFFFFF5F5);
  static const Color riesgoAltBg4 = Color(0xFFFFF8E1);

  // ── Medal colors (ranking) ───────────────────────────────────
  static const Color goldMedal    = Color(0xFFFFD700);
  static const Color silverMedal  = Color(0xFFB0B0B0);
  static const Color bronzeMedal  = Color(0xFFCD7F32);

  // ── Misc ─────────────────────────────────────────────────────
  static const Color blueLink     = Color(0xFF2563EB);
  static const Color blueBus      = Color(0xFF3B82F6);
  static const Color warmBg       = Color(0xFFFFF4E5);
  static const Color warningBg    = Color(0xFFFFF8E1);
  static const Color noAptoBgAlt  = Color(0xFFFFF5F5);
  static const Color aptoAltBg    = Color(0xFFF0FDF4);
  static const Color aptoMid      = Color(0xFF16A34A);
  static const Color score60Green = Color(0xFF16A34A);

  /// Light primary bg for pressed state (rgba(108,6,6,0.03) ≈ #FDF8F8)
  static const Color primaryBgLight = Color(0xFFFDF8F8);

  /// Gradient end for quick action card (matches primaryBg tinted lighter)
  static const Color gradientEnd    = Color(0xFFF4D5D5);

  /// Warn state colors (hero card, alerts)
  static const Color warnBg         = Color(0x1FEF4444); // rgba(239,68,68,0.12)
  static const Color warnBorder     = Color(0x66EF4444); // rgba(239,68,68,0.4)
  static const Color warnLabel      = Color(0xFFFCA5A5);

  /// Medal colors for ranking/podium
  static const Color medalGold      = Color(0xFFFFD700);
  static const Color medalSilver    = Color(0xFFB0B0B0);
  static const Color medalBronze    = Color(0xFFCD7F32);

  /// Riesgo text variants for critical points banners
  static const Color riesgoText     = Color(0xFF92400E);
  static const Color riesgoTextDark = Color(0xFF78350F);

  // ── Legacy aliases (compatibilidad con código existente) ─────
  static const Color success          = apto;
  static const Color warning          = riesgo;
  static const Color danger           = noApto;
  static const Color background       = paper;
  static const Color surface          = Colors.white;
  static const Color textPrimary      = ink9;
  static const Color textSecondary    = ink5;
  static const Color border           = ink2;
  static const Color darkBackground   = ink;
  static const Color darkSurface      = ink9;
  static const Color darkTextPrimary  = paper;
  static const Color darkTextSecondary = ink4;
  static const Color darkBorder       = ink8;
}
