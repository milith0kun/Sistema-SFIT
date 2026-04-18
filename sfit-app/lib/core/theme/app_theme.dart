import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'app_colors.dart';

class AppTheme {
  AppTheme._();

  static const _radius = 10.0;

  // ── ColorScheme explícito con contraste garantizado ────────────
  static final ColorScheme _lightScheme = ColorScheme(
    brightness: Brightness.light,
    primary:          AppColors.ink9,
    onPrimary:        Colors.white,
    primaryContainer: AppColors.goldBg,
    onPrimaryContainer: AppColors.goldDark,
    secondary:        AppColors.gold,
    onSecondary:      Colors.white,
    secondaryContainer: AppColors.goldBg,
    onSecondaryContainer: AppColors.goldDark,
    tertiary:         AppColors.gold,
    onTertiary:       Colors.white,
    error:            AppColors.danger,
    onError:          Colors.white,
    surface:          Colors.white,
    onSurface:        AppColors.ink9,
    onSurfaceVariant: AppColors.ink6,
    outline:          AppColors.ink3,
    outlineVariant:   AppColors.ink2,
    shadow:           Colors.black,
    scrim:            Colors.black,
    inverseSurface:   AppColors.ink9,
    onInverseSurface: Colors.white,
    inversePrimary:   AppColors.gold,
  );

  static ThemeData get lightTheme {
    final body = GoogleFonts.plusJakartaSans();
    final display = GoogleFonts.syneTextTheme();

    return ThemeData(
      useMaterial3: true,
      brightness: Brightness.light,
      colorScheme: _lightScheme,
      scaffoldBackgroundColor: AppColors.paper,

      textTheme: TextTheme(
        displayLarge:   GoogleFonts.syne(fontSize: 40, fontWeight: FontWeight.w800, color: AppColors.ink9, letterSpacing: -0.02),
        displayMedium:  GoogleFonts.syne(fontSize: 32, fontWeight: FontWeight.w800, color: AppColors.ink9, letterSpacing: -0.02),
        displaySmall:   GoogleFonts.syne(fontSize: 26, fontWeight: FontWeight.w800, color: AppColors.ink9),
        headlineLarge:  GoogleFonts.syne(fontSize: 28, fontWeight: FontWeight.w800, color: AppColors.ink9, letterSpacing: -0.02),
        headlineMedium: GoogleFonts.syne(fontSize: 24, fontWeight: FontWeight.w800, color: AppColors.ink9, letterSpacing: -0.015),
        headlineSmall:  GoogleFonts.syne(fontSize: 20, fontWeight: FontWeight.w700, color: AppColors.ink9),
        titleLarge:     GoogleFonts.syne(fontSize: 18, fontWeight: FontWeight.w700, color: AppColors.ink9),
        titleMedium:    body.copyWith(fontSize: 16, fontWeight: FontWeight.w600, color: AppColors.ink9),
        titleSmall:     body.copyWith(fontSize: 15, fontWeight: FontWeight.w600, color: AppColors.ink9),
        bodyLarge:      body.copyWith(fontSize: 16, fontWeight: FontWeight.w400, color: AppColors.ink8, height: 1.55),
        bodyMedium:     body.copyWith(fontSize: 15, fontWeight: FontWeight.w400, color: AppColors.ink7, height: 1.5),
        bodySmall:      body.copyWith(fontSize: 13, fontWeight: FontWeight.w400, color: AppColors.ink6, height: 1.45),
        labelLarge:     body.copyWith(fontSize: 15, fontWeight: FontWeight.w600, color: AppColors.ink9),
        labelMedium:    body.copyWith(fontSize: 13, fontWeight: FontWeight.w500, color: AppColors.ink7),
        labelSmall:     body.copyWith(fontSize: 11, fontWeight: FontWeight.w700, color: AppColors.gold, letterSpacing: 1.8),
      ),

      appBarTheme: AppBarTheme(
        centerTitle: false,
        elevation: 0,
        scrolledUnderElevation: 0.5,
        backgroundColor: AppColors.paper,
        foregroundColor: AppColors.ink9,
        titleTextStyle: GoogleFonts.syne(fontSize: 17, fontWeight: FontWeight.w700, color: AppColors.ink9),
      ),

      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: Colors.white,
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(_radius),
          borderSide: const BorderSide(color: AppColors.ink2, width: 1.5),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(_radius),
          borderSide: const BorderSide(color: AppColors.ink2, width: 1.5),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(_radius),
          borderSide: const BorderSide(color: AppColors.ink9, width: 1.5),
        ),
        errorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(_radius),
          borderSide: const BorderSide(color: AppColors.danger, width: 1.5),
        ),
        focusedErrorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(_radius),
          borderSide: const BorderSide(color: AppColors.danger, width: 1.5),
        ),
        labelStyle: body.copyWith(fontSize: 15, fontWeight: FontWeight.w500, color: AppColors.ink6),
        floatingLabelStyle: body.copyWith(fontSize: 13, fontWeight: FontWeight.w600, color: AppColors.ink9),
        hintStyle: body.copyWith(fontSize: 15, fontWeight: FontWeight.w400, color: AppColors.ink5),
        errorStyle: body.copyWith(fontSize: 12, color: AppColors.danger),
      ),

      filledButtonTheme: FilledButtonThemeData(
        style: ButtonStyle(
          backgroundColor: WidgetStateProperty.resolveWith((states) {
            if (states.contains(WidgetState.disabled)) return AppColors.ink3;
            if (states.contains(WidgetState.pressed))  return AppColors.ink;
            return AppColors.ink9;
          }),
          foregroundColor: WidgetStateProperty.all(Colors.white),
          minimumSize: WidgetStateProperty.all(const Size(double.infinity, 52)),
          shape: WidgetStateProperty.all(
            RoundedRectangleBorder(borderRadius: BorderRadius.circular(_radius)),
          ),
          textStyle: WidgetStateProperty.all(
            GoogleFonts.plusJakartaSans(fontSize: 15, fontWeight: FontWeight.w600, letterSpacing: 0.1),
          ),
        ),
      ),

      outlinedButtonTheme: OutlinedButtonThemeData(
        style: ButtonStyle(
          foregroundColor: WidgetStateProperty.all(AppColors.ink8),
          side: WidgetStateProperty.all(const BorderSide(color: AppColors.ink2, width: 1.5)),
          minimumSize: WidgetStateProperty.all(const Size(double.infinity, 52)),
          shape: WidgetStateProperty.all(
            RoundedRectangleBorder(borderRadius: BorderRadius.circular(_radius)),
          ),
          textStyle: WidgetStateProperty.all(
            GoogleFonts.plusJakartaSans(fontSize: 15, fontWeight: FontWeight.w500),
          ),
        ),
      ),

      textButtonTheme: TextButtonThemeData(
        style: ButtonStyle(
          foregroundColor: WidgetStateProperty.all(AppColors.goldDark),
          padding: WidgetStateProperty.all(const EdgeInsets.symmetric(horizontal: 4)),
          textStyle: WidgetStateProperty.all(
            GoogleFonts.plusJakartaSans(fontSize: 13, fontWeight: FontWeight.w600),
          ),
        ),
      ),

      cardTheme: CardThemeData(
        elevation: 0,
        color: Colors.white,
        surfaceTintColor: Colors.transparent,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(14),
          side: const BorderSide(color: AppColors.ink2, width: 1.5),
        ),
      ),

      dividerTheme: const DividerThemeData(color: AppColors.ink2, space: 1, thickness: 1),

      snackBarTheme: SnackBarThemeData(
        behavior: SnackBarBehavior.floating,
        contentTextStyle: GoogleFonts.plusJakartaSans(fontSize: 14, fontWeight: FontWeight.w500, color: Colors.white),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
      ),

      iconTheme: const IconThemeData(color: AppColors.ink7, size: 22),
    );
  }

  // Dark theme: por ahora usa el claro (app no tiene modo oscuro implementado)
  static ThemeData get darkTheme => lightTheme;
}
