import 'package:flutter/material.dart';

class AppColors {
  AppColors._();

  // ── Acento institucional (oro) ────────────────────────────────
  static const Color gold       = Color(0xFFB8860B);
  static const Color goldLight  = Color(0xFFD4A827);
  static const Color goldDark   = Color(0xFF926A09);
  static const Color goldBg     = Color(0xFFFDF8EC);

  // ── Zinc monochrome ──────────────────────────────────────────
  static const Color ink        = Color(0xFF09090B); // zinc-950
  static const Color ink9       = Color(0xFF18181B); // zinc-900
  static const Color ink8       = Color(0xFF27272A); // zinc-800
  static const Color ink7       = Color(0xFF3F3F46); // zinc-700
  static const Color ink6       = Color(0xFF52525B); // zinc-600
  static const Color ink5       = Color(0xFF71717A); // zinc-500
  static const Color ink4       = Color(0xFFA1A1AA); // zinc-400
  static const Color ink3       = Color(0xFFD4D4D8); // zinc-300
  static const Color ink2       = Color(0xFFE4E4E7); // zinc-200
  static const Color ink1       = Color(0xFFF4F4F5); // zinc-100
  static const Color paper      = Color(0xFFFAFAFA); // zinc-50

  // ── Panel oscuro (sidebar / auth) ───────────────────────────
  static const Color panel      = Color(0xFF0A1628);
  static const Color panelMid   = Color(0xFF111F38);
  static const Color panelLight = Color(0xFF1A2D4A);

  // ── Estado vehicular / conductor ────────────────────────────
  static const Color apto       = Color(0xFF15803D);
  static const Color riesgo     = Color(0xFFB45309);
  static const Color noApto     = Color(0xFFB91C1C);

  // ── Legacy (mantenidos para compatibilidad) ──────────────────
  static const Color primary          = gold;
  static const Color primaryLight     = goldLight;
  static const Color primaryDark      = goldDark;
  static const Color success          = apto;
  static const Color warning          = riesgo;
  static const Color danger           = noApto;
  static const Color info             = Color(0xFF0369A1);
  static const Color background       = paper;
  static const Color surface          = Color(0xFFFFFFFF);
  static const Color textPrimary      = ink9;
  static const Color textSecondary    = ink5;
  static const Color border           = ink2;
  static const Color darkBackground   = ink;
  static const Color darkSurface      = ink9;
  static const Color darkTextPrimary  = paper;
  static const Color darkTextSecondary = ink4;
  static const Color darkBorder       = ink8;
}
