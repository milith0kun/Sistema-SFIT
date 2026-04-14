import 'package:flutter/material.dart';

/// Paleta de colores de SFIT
class AppColors {
  AppColors._();

  // Colores primarios
  static const Color primary = Color(0xFF1A56DB);
  static const Color primaryLight = Color(0xFF3F83F8);
  static const Color primaryDark = Color(0xFF1E40AF);

  // Colores de estado
  static const Color success = Color(0xFF059669);
  static const Color warning = Color(0xFFD97706);
  static const Color danger = Color(0xFFDC2626);
  static const Color info = Color(0xFF0284C7);

  // Estados de conductor/vehículo
  static const Color statusApto = Color(0xFF059669);     // Verde
  static const Color statusRiesgo = Color(0xFFD97706);   // Amarillo
  static const Color statusNoApto = Color(0xFFDC2626);   // Rojo

  // Neutros
  static const Color background = Color(0xFFF8FAFC);
  static const Color surface = Color(0xFFFFFFFF);
  static const Color textPrimary = Color(0xFF0F172A);
  static const Color textSecondary = Color(0xFF64748B);
  static const Color border = Color(0xFFE2E8F0);
  static const Color divider = Color(0xFFF1F5F9);

  // Dark mode
  static const Color darkBackground = Color(0xFF0F172A);
  static const Color darkSurface = Color(0xFF1E293B);
  static const Color darkTextPrimary = Color(0xFFF8FAFC);
  static const Color darkTextSecondary = Color(0xFF94A3B8);
  static const Color darkBorder = Color(0xFF334155);
}
