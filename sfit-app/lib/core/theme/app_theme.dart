import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'app_colors.dart';

/// Tema canónico SFIT — espejo del sistema de diseño web.
///
/// Reglas tipográficas:
///   - **Inter** → body, UI, números. `FontFeature.tabularFigures()` en labels
///     numéricos (ver helpers `tabularFigures`).
///   - **Syne** → SOLO `displayLarge`/`displayMedium` para hero titles.
///   - Weights: 400 / 500 / 600 / 700. No usar 800/900.
///
/// Letter spacing canónico:
///   - `-0.015em` headers
///   - `-0.005em` body
///   - `0.12em`  kickers uppercase
class AppTheme {
  AppTheme._();

  static const _radius = 10.0;

  // ── Helpers tipográficos ─────────────────────────────────────
  /// Feature OpenType para figuras tabulares (números alineados verticalmente).
  /// Úsalo en placas, horas, métricas KPI.
  static const tabularFigures = <FontFeature>[FontFeature.tabularFigures()];

  /// Estilo Inter con tabular figures pre-aplicadas.
  static TextStyle inter({
    double fontSize = 14,
    FontWeight fontWeight = FontWeight.w400,
    Color? color,
    double? letterSpacing,
    double? height,
    bool tabular = false,
  }) =>
      GoogleFonts.inter(
        fontSize: fontSize,
        fontWeight: fontWeight,
        color: color,
        letterSpacing: letterSpacing,
        height: height,
        fontFeatures: tabular ? tabularFigures : null,
      );

  /// Estilo Syne — solo para hero titles.
  static TextStyle syne({
    double fontSize = 28,
    FontWeight fontWeight = FontWeight.w700,
    Color? color,
    double? letterSpacing,
    double? height,
  }) =>
      GoogleFonts.syne(
        fontSize: fontSize,
        fontWeight: fontWeight,
        color: color,
        letterSpacing: letterSpacing,
        height: height,
      );

  // ── ColorScheme ───────────────────────────────────────────────
  // primary = gold (acento institucional), surface = paper, onSurface = ink9.
  static const ColorScheme _lightScheme = ColorScheme(
    brightness: Brightness.light,
    primary:          AppColors.gold,
    onPrimary:        Colors.white,
    primaryContainer: AppColors.goldBg,
    onPrimaryContainer: AppColors.goldDark,
    secondary:        AppColors.ink9,
    onSecondary:      Colors.white,
    secondaryContainer: AppColors.ink1,
    onSecondaryContainer: AppColors.ink9,
    tertiary:         AppColors.panel,
    onTertiary:       Colors.white,
    error:            AppColors.noApto,
    onError:          Colors.white,
    errorContainer:   AppColors.noAptoBg,
    onErrorContainer: AppColors.noApto,
    surface:          AppColors.paper,
    onSurface:        AppColors.ink9,
    surfaceContainerHighest: AppColors.ink1,
    onSurfaceVariant: AppColors.ink6,
    outline:          AppColors.ink3,
    outlineVariant:   AppColors.ink2,
    shadow:           Colors.black,
    scrim:            Colors.black,
    inverseSurface:   AppColors.ink9,
    onInverseSurface: Colors.white,
    inversePrimary:   AppColors.goldLight,
  );

  static ThemeData get lightTheme {
    // Base Inter para body/UI. TextTheme Inter + solo Syne en display*.
    final textTheme = TextTheme(
      // Hero titles — Syne
      displayLarge: GoogleFonts.syne(
        fontSize: 34, fontWeight: FontWeight.w700,
        color: AppColors.ink9, letterSpacing: -0.03, height: 1.05,
      ),
      displayMedium: GoogleFonts.syne(
        fontSize: 28, fontWeight: FontWeight.w700,
        color: AppColors.ink9, letterSpacing: -0.025, height: 1.1,
      ),
      // Resto en Inter
      displaySmall: GoogleFonts.inter(
        fontSize: 24, fontWeight: FontWeight.w700,
        color: AppColors.ink9, letterSpacing: -0.02, height: 1.15,
      ),
      headlineLarge: GoogleFonts.inter(
        fontSize: 22, fontWeight: FontWeight.w700,
        color: AppColors.ink9, letterSpacing: -0.015, height: 1.2,
      ),
      headlineMedium: GoogleFonts.inter(
        fontSize: 20, fontWeight: FontWeight.w700,
        color: AppColors.ink9, letterSpacing: -0.015, height: 1.25,
      ),
      headlineSmall: GoogleFonts.inter(
        fontSize: 18, fontWeight: FontWeight.w700,
        color: AppColors.ink9, letterSpacing: -0.01, height: 1.3,
      ),
      titleLarge: GoogleFonts.inter(
        fontSize: 16, fontWeight: FontWeight.w600,
        color: AppColors.ink9, letterSpacing: -0.005,
      ),
      titleMedium: GoogleFonts.inter(
        fontSize: 15, fontWeight: FontWeight.w600,
        color: AppColors.ink9, letterSpacing: -0.005,
      ),
      titleSmall: GoogleFonts.inter(
        fontSize: 13, fontWeight: FontWeight.w600,
        color: AppColors.ink9,
      ),
      bodyLarge: GoogleFonts.inter(
        fontSize: 15, fontWeight: FontWeight.w400,
        color: AppColors.ink8, letterSpacing: -0.005, height: 1.5,
      ),
      bodyMedium: GoogleFonts.inter(
        fontSize: 14, fontWeight: FontWeight.w400,
        color: AppColors.ink7, letterSpacing: -0.005, height: 1.5,
      ),
      bodySmall: GoogleFonts.inter(
        fontSize: 12.5, fontWeight: FontWeight.w400,
        color: AppColors.ink6, height: 1.45,
      ),
      labelLarge: GoogleFonts.inter(
        fontSize: 14, fontWeight: FontWeight.w600,
        color: AppColors.ink9,
      ),
      labelMedium: GoogleFonts.inter(
        fontSize: 12, fontWeight: FontWeight.w500,
        color: AppColors.ink7,
      ),
      // Kicker uppercase — 10/11 letterSpacing 0.12em
      labelSmall: GoogleFonts.inter(
        fontSize: 10.5, fontWeight: FontWeight.w700,
        color: AppColors.ink5, letterSpacing: 1.6,
      ),
    );

    return ThemeData(
      useMaterial3: true,
      brightness: Brightness.light,
      colorScheme: _lightScheme,
      scaffoldBackgroundColor: AppColors.paper,
      canvasColor: AppColors.paper,
      textTheme: textTheme,

      appBarTheme: AppBarTheme(
        centerTitle: false,
        elevation: 0,
        scrolledUnderElevation: 0.5,
        backgroundColor: AppColors.paper,
        surfaceTintColor: Colors.transparent,
        foregroundColor: AppColors.ink9,
        titleTextStyle: GoogleFonts.inter(
          fontSize: 16, fontWeight: FontWeight.w700,
          color: AppColors.ink9, letterSpacing: -0.005,
        ),
      ),

      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: Colors.white,
        contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(8),
          borderSide: const BorderSide(color: AppColors.ink2, width: 1.5),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(8),
          borderSide: const BorderSide(color: AppColors.ink2, width: 1.5),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(8),
          borderSide: const BorderSide(color: AppColors.ink9, width: 1.5),
        ),
        errorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(8),
          borderSide: const BorderSide(color: AppColors.noApto, width: 1.5),
        ),
        focusedErrorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(8),
          borderSide: const BorderSide(color: AppColors.noApto, width: 1.5),
        ),
        labelStyle: GoogleFonts.inter(
          fontSize: 14, fontWeight: FontWeight.w500, color: AppColors.ink6,
        ),
        floatingLabelStyle: GoogleFonts.inter(
          fontSize: 12.5, fontWeight: FontWeight.w600, color: AppColors.ink9,
        ),
        hintStyle: GoogleFonts.inter(
          fontSize: 14, fontWeight: FontWeight.w400, color: AppColors.ink5,
        ),
        errorStyle: GoogleFonts.inter(
          fontSize: 12, color: AppColors.noApto,
        ),
      ),

      // FilledButton canónico: fondo ink (casi negro), sin hover gold aquí
      // (el hover gold está en el widget `SfitPrimaryButton`).
      filledButtonTheme: FilledButtonThemeData(
        style: ButtonStyle(
          backgroundColor: WidgetStateProperty.resolveWith((states) {
            if (states.contains(WidgetState.disabled)) return AppColors.ink3;
            if (states.contains(WidgetState.pressed))  return AppColors.ink;
            return AppColors.ink9;
          }),
          foregroundColor: WidgetStateProperty.all(Colors.white),
          minimumSize: WidgetStateProperty.all(const Size(64, 48)),
          shape: WidgetStateProperty.all(
            RoundedRectangleBorder(borderRadius: BorderRadius.circular(_radius)),
          ),
          textStyle: WidgetStateProperty.all(
            GoogleFonts.inter(fontSize: 14.5, fontWeight: FontWeight.w600, letterSpacing: 0.1),
          ),
        ),
      ),

      outlinedButtonTheme: OutlinedButtonThemeData(
        style: ButtonStyle(
          foregroundColor: WidgetStateProperty.all(AppColors.ink8),
          side: WidgetStateProperty.all(const BorderSide(color: AppColors.ink2, width: 1.5)),
          minimumSize: WidgetStateProperty.all(const Size(64, 48)),
          shape: WidgetStateProperty.all(
            RoundedRectangleBorder(borderRadius: BorderRadius.circular(_radius)),
          ),
          textStyle: WidgetStateProperty.all(
            GoogleFonts.inter(fontSize: 14.5, fontWeight: FontWeight.w500),
          ),
        ),
      ),

      textButtonTheme: TextButtonThemeData(
        style: ButtonStyle(
          foregroundColor: WidgetStateProperty.all(AppColors.goldDark),
          padding: WidgetStateProperty.all(const EdgeInsets.symmetric(horizontal: 4)),
          textStyle: WidgetStateProperty.all(
            GoogleFonts.inter(fontSize: 13, fontWeight: FontWeight.w600),
          ),
        ),
      ),

      cardTheme: CardThemeData(
        elevation: 0,
        color: Colors.white,
        surfaceTintColor: Colors.transparent,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(12),
          side: const BorderSide(color: AppColors.ink2, width: 1.5),
        ),
      ),

      dividerTheme: const DividerThemeData(
        color: AppColors.ink2, space: 1, thickness: 1,
      ),

      snackBarTheme: SnackBarThemeData(
        behavior: SnackBarBehavior.floating,
        backgroundColor: AppColors.ink9,
        contentTextStyle: GoogleFonts.inter(
          fontSize: 13.5, fontWeight: FontWeight.w500, color: Colors.white,
        ),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
      ),

      iconTheme: const IconThemeData(color: AppColors.ink7, size: 22),

      navigationBarTheme: NavigationBarThemeData(
        height: 66,
        backgroundColor: Colors.white,
        surfaceTintColor: Colors.transparent,
        indicatorColor: AppColors.goldBg,
        labelTextStyle: WidgetStateProperty.resolveWith(
          (states) => GoogleFonts.inter(
            fontSize: 11.5,
            fontWeight: states.contains(WidgetState.selected)
                ? FontWeight.w700
                : FontWeight.w500,
            color: states.contains(WidgetState.selected)
                ? AppColors.ink9
                : AppColors.ink5,
          ),
        ),
        iconTheme: WidgetStateProperty.resolveWith(
          (states) => IconThemeData(
            size: 22,
            color: states.contains(WidgetState.selected)
                ? AppColors.goldDark
                : AppColors.ink5,
          ),
        ),
      ),

      chipTheme: ChipThemeData(
        backgroundColor: Colors.white,
        side: const BorderSide(color: AppColors.ink2, width: 1),
        labelStyle: GoogleFonts.inter(
          fontSize: 12.5, fontWeight: FontWeight.w600, color: AppColors.ink8,
        ),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
      ),
    );
  }

  // ═════════════════════════════════════════════════════════════
  //  DARK MODE
  // ═════════════════════════════════════════════════════════════

  /// ColorScheme oscuro institucional.
  /// Espejo del bloque `.dark` en `globals.css`. Primary se aclara a
  /// `primaryOnDark` (#BA2C2C) para mantener contraste sobre superficies
  /// `ink` / `ink9`.
  static const ColorScheme _darkScheme = ColorScheme(
    brightness: Brightness.dark,
    primary:              AppColors.primaryOnDark,
    onPrimary:            Colors.white,
    primaryContainer:     AppColors.primaryDark,
    onPrimaryContainer:   AppColors.primaryBg,
    secondary:            AppColors.ink3,
    onSecondary:          AppColors.ink9,
    secondaryContainer:   AppColors.ink8,
    onSecondaryContainer: AppColors.ink2,
    tertiary:             AppColors.panelLight,
    onTertiary:           Colors.white,
    error:                Color(0xFFF87171),
    onError:              AppColors.ink9,
    errorContainer:       AppColors.primaryDark,
    onErrorContainer:     Color(0xFFFCA5A5),
    surface:              AppColors.ink9,
    onSurface:            AppColors.paper,
    surfaceContainerHighest: AppColors.ink8,
    onSurfaceVariant:     AppColors.ink4,
    outline:              AppColors.ink7,
    outlineVariant:       AppColors.ink8,
    shadow:               Colors.black,
    scrim:                Colors.black,
    inverseSurface:       AppColors.paper,
    onInverseSurface:     AppColors.ink9,
    inversePrimary:       AppColors.primary,
  );

  /// Tema oscuro canónico SFIT.
  ///
  /// Reglas:
  ///   - Background = `ink` (#09090B), surface = `ink9` (#18181B).
  ///   - Texto principal = `paper`; texto secundario = `ink3`/`ink4`.
  ///   - Bordes = `ink7`/`ink8`. Outline focus = `primaryOnDark`.
  ///   - Tipografía Inter (sin Syne en dark — coherente con la decisión
  ///     institucional aplicada en la web).
  static ThemeData get darkTheme {
    final textTheme = TextTheme(
      displayLarge: GoogleFonts.inter(
        fontSize: 34, fontWeight: FontWeight.w700,
        color: AppColors.paper, letterSpacing: -0.03, height: 1.05,
      ),
      displayMedium: GoogleFonts.inter(
        fontSize: 28, fontWeight: FontWeight.w700,
        color: AppColors.paper, letterSpacing: -0.025, height: 1.1,
      ),
      displaySmall: GoogleFonts.inter(
        fontSize: 24, fontWeight: FontWeight.w700,
        color: AppColors.paper, letterSpacing: -0.02, height: 1.15,
      ),
      headlineLarge: GoogleFonts.inter(
        fontSize: 22, fontWeight: FontWeight.w700,
        color: AppColors.paper, letterSpacing: -0.015, height: 1.2,
      ),
      headlineMedium: GoogleFonts.inter(
        fontSize: 20, fontWeight: FontWeight.w700,
        color: AppColors.paper, letterSpacing: -0.015, height: 1.25,
      ),
      headlineSmall: GoogleFonts.inter(
        fontSize: 18, fontWeight: FontWeight.w700,
        color: AppColors.paper, letterSpacing: -0.01, height: 1.3,
      ),
      titleLarge: GoogleFonts.inter(
        fontSize: 16, fontWeight: FontWeight.w600,
        color: AppColors.paper, letterSpacing: -0.005,
      ),
      titleMedium: GoogleFonts.inter(
        fontSize: 15, fontWeight: FontWeight.w600,
        color: AppColors.paper, letterSpacing: -0.005,
      ),
      titleSmall: GoogleFonts.inter(
        fontSize: 13, fontWeight: FontWeight.w600,
        color: AppColors.ink2,
      ),
      bodyLarge: GoogleFonts.inter(
        fontSize: 15, fontWeight: FontWeight.w400,
        color: AppColors.ink2, letterSpacing: -0.005, height: 1.5,
      ),
      bodyMedium: GoogleFonts.inter(
        fontSize: 14, fontWeight: FontWeight.w400,
        color: AppColors.ink3, letterSpacing: -0.005, height: 1.5,
      ),
      bodySmall: GoogleFonts.inter(
        fontSize: 12.5, fontWeight: FontWeight.w400,
        color: AppColors.ink4, height: 1.45,
      ),
      labelLarge: GoogleFonts.inter(
        fontSize: 14, fontWeight: FontWeight.w600,
        color: AppColors.paper,
      ),
      labelMedium: GoogleFonts.inter(
        fontSize: 12, fontWeight: FontWeight.w500,
        color: AppColors.ink3,
      ),
      labelSmall: GoogleFonts.inter(
        fontSize: 10.5, fontWeight: FontWeight.w700,
        color: AppColors.ink4, letterSpacing: 1.6,
      ),
    );

    return ThemeData(
      useMaterial3: true,
      brightness: Brightness.dark,
      colorScheme: _darkScheme,
      scaffoldBackgroundColor: AppColors.ink,
      canvasColor: AppColors.ink,
      textTheme: textTheme,

      appBarTheme: AppBarTheme(
        centerTitle: false,
        elevation: 0,
        scrolledUnderElevation: 0.5,
        backgroundColor: AppColors.ink9,
        surfaceTintColor: Colors.transparent,
        foregroundColor: AppColors.paper,
        titleTextStyle: GoogleFonts.inter(
          fontSize: 16, fontWeight: FontWeight.w700,
          color: AppColors.paper, letterSpacing: -0.005,
        ),
      ),

      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: AppColors.ink9,
        contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(8),
          borderSide: const BorderSide(color: AppColors.ink7, width: 1.5),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(8),
          borderSide: const BorderSide(color: AppColors.ink7, width: 1.5),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(8),
          borderSide: const BorderSide(color: AppColors.primaryOnDark, width: 1.5),
        ),
        errorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(8),
          borderSide: const BorderSide(color: Color(0xFFF87171), width: 1.5),
        ),
        focusedErrorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(8),
          borderSide: const BorderSide(color: Color(0xFFF87171), width: 1.5),
        ),
        labelStyle: GoogleFonts.inter(
          fontSize: 14, fontWeight: FontWeight.w500, color: AppColors.ink4,
        ),
        floatingLabelStyle: GoogleFonts.inter(
          fontSize: 12.5, fontWeight: FontWeight.w600, color: AppColors.paper,
        ),
        hintStyle: GoogleFonts.inter(
          fontSize: 14, fontWeight: FontWeight.w400, color: AppColors.ink5,
        ),
        errorStyle: GoogleFonts.inter(
          fontSize: 12, color: const Color(0xFFF87171),
        ),
      ),

      filledButtonTheme: FilledButtonThemeData(
        style: ButtonStyle(
          backgroundColor: WidgetStateProperty.resolveWith((states) {
            if (states.contains(WidgetState.disabled)) return AppColors.ink8;
            if (states.contains(WidgetState.pressed))  return AppColors.ink7;
            return AppColors.ink8;
          }),
          foregroundColor: WidgetStateProperty.all(AppColors.paper),
          minimumSize: WidgetStateProperty.all(const Size(64, 48)),
          shape: WidgetStateProperty.all(
            RoundedRectangleBorder(borderRadius: BorderRadius.circular(_radius)),
          ),
          textStyle: WidgetStateProperty.all(
            GoogleFonts.inter(fontSize: 14.5, fontWeight: FontWeight.w600, letterSpacing: 0.1),
          ),
        ),
      ),

      outlinedButtonTheme: OutlinedButtonThemeData(
        style: ButtonStyle(
          foregroundColor: WidgetStateProperty.all(AppColors.paper),
          side: WidgetStateProperty.all(const BorderSide(color: AppColors.ink7, width: 1.5)),
          minimumSize: WidgetStateProperty.all(const Size(64, 48)),
          shape: WidgetStateProperty.all(
            RoundedRectangleBorder(borderRadius: BorderRadius.circular(_radius)),
          ),
          textStyle: WidgetStateProperty.all(
            GoogleFonts.inter(fontSize: 14.5, fontWeight: FontWeight.w500),
          ),
        ),
      ),

      textButtonTheme: TextButtonThemeData(
        style: ButtonStyle(
          foregroundColor: WidgetStateProperty.all(AppColors.primaryOnDark),
          padding: WidgetStateProperty.all(const EdgeInsets.symmetric(horizontal: 4)),
          textStyle: WidgetStateProperty.all(
            GoogleFonts.inter(fontSize: 13, fontWeight: FontWeight.w600),
          ),
        ),
      ),

      cardTheme: CardThemeData(
        elevation: 0,
        color: AppColors.ink9,
        surfaceTintColor: Colors.transparent,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(12),
          side: const BorderSide(color: AppColors.ink8, width: 1.5),
        ),
      ),

      dividerTheme: const DividerThemeData(
        color: AppColors.ink8, space: 1, thickness: 1,
      ),

      snackBarTheme: SnackBarThemeData(
        behavior: SnackBarBehavior.floating,
        backgroundColor: AppColors.paper,
        contentTextStyle: GoogleFonts.inter(
          fontSize: 13.5, fontWeight: FontWeight.w500, color: AppColors.ink9,
        ),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
      ),

      iconTheme: const IconThemeData(color: AppColors.ink4, size: 22),

      navigationBarTheme: NavigationBarThemeData(
        height: 66,
        backgroundColor: AppColors.ink9,
        surfaceTintColor: Colors.transparent,
        indicatorColor: AppColors.primaryDark,
        labelTextStyle: WidgetStateProperty.resolveWith(
          (states) => GoogleFonts.inter(
            fontSize: 11.5,
            fontWeight: states.contains(WidgetState.selected)
                ? FontWeight.w700
                : FontWeight.w500,
            color: states.contains(WidgetState.selected)
                ? AppColors.paper
                : AppColors.ink4,
          ),
        ),
        iconTheme: WidgetStateProperty.resolveWith(
          (states) => IconThemeData(
            size: 22,
            color: states.contains(WidgetState.selected)
                ? AppColors.primaryOnDark
                : AppColors.ink4,
          ),
        ),
      ),

      chipTheme: ChipThemeData(
        backgroundColor: AppColors.ink8,
        side: const BorderSide(color: AppColors.ink7, width: 1),
        labelStyle: GoogleFonts.inter(
          fontSize: 12.5, fontWeight: FontWeight.w600, color: AppColors.ink2,
        ),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
      ),
    );
  }
}
