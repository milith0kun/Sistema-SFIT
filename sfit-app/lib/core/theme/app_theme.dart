import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'app_colors.dart';

class AppTheme {
  AppTheme._();

  static const _radius = 10.0;

  static ThemeData get lightTheme {
    final base = ThemeData(
      useMaterial3: true,
      brightness: Brightness.light,
      colorSchemeSeed: AppColors.gold,
    );

    final body = GoogleFonts.plusJakartaSans();

    return base.copyWith(
      scaffoldBackgroundColor: AppColors.paper,

      textTheme: base.textTheme.copyWith(
        displayLarge:  GoogleFonts.syne(fontSize: 40, fontWeight: FontWeight.w800, color: AppColors.ink9, letterSpacing: -0.02),
        displayMedium: GoogleFonts.syne(fontSize: 32, fontWeight: FontWeight.w800, color: AppColors.ink9, letterSpacing: -0.02),
        displaySmall:  GoogleFonts.syne(fontSize: 26, fontWeight: FontWeight.w800, color: AppColors.ink9),
        headlineLarge: GoogleFonts.syne(fontSize: 24, fontWeight: FontWeight.w800, color: AppColors.ink9),
        headlineMedium: GoogleFonts.syne(fontSize: 22, fontWeight: FontWeight.w700, color: AppColors.ink9),
        headlineSmall: GoogleFonts.syne(fontSize: 19, fontWeight: FontWeight.w700, color: AppColors.ink9),
        titleLarge:    GoogleFonts.syne(fontSize: 17, fontWeight: FontWeight.w700, color: AppColors.ink9),
        titleMedium:   body.copyWith(fontSize: 16, fontWeight: FontWeight.w600, color: AppColors.ink9),
        titleSmall:    body.copyWith(fontSize: 15, fontWeight: FontWeight.w600, color: AppColors.ink9),
        bodyLarge:     body.copyWith(fontSize: 16, fontWeight: FontWeight.w400, color: AppColors.ink8, height: 1.6),
        bodyMedium:    body.copyWith(fontSize: 15, fontWeight: FontWeight.w400, color: AppColors.ink7, height: 1.5),
        bodySmall:     body.copyWith(fontSize: 13, fontWeight: FontWeight.w400, color: AppColors.ink5, height: 1.5),
        labelLarge:    body.copyWith(fontSize: 15, fontWeight: FontWeight.w600, color: AppColors.ink9),
        labelMedium:   body.copyWith(fontSize: 12, fontWeight: FontWeight.w500, color: AppColors.ink6, letterSpacing: 0.5),
        labelSmall:    body.copyWith(fontSize: 11, fontWeight: FontWeight.w600, color: AppColors.ink4, letterSpacing: 1.5),
      ),

      appBarTheme: AppBarTheme(
        centerTitle: false,
        elevation: 0,
        scrolledUnderElevation: 0.5,
        backgroundColor: AppColors.paper,
        foregroundColor: AppColors.ink9,
        titleTextStyle: GoogleFonts.syne(
          fontSize: 17,
          fontWeight: FontWeight.w700,
          color: AppColors.ink9,
        ),
      ),

      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: AppColors.surface,
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
        labelStyle: GoogleFonts.plusJakartaSans(
          fontSize: 15,
          fontWeight: FontWeight.w400,
          color: AppColors.ink5,
        ),
        floatingLabelStyle: GoogleFonts.plusJakartaSans(
          fontSize: 13,
          fontWeight: FontWeight.w500,
          color: AppColors.ink9,
        ),
        hintStyle: GoogleFonts.plusJakartaSans(
          fontSize: 15,
          color: AppColors.ink4,
        ),
        errorStyle: GoogleFonts.plusJakartaSans(
          fontSize: 12,
          color: AppColors.danger,
        ),
      ),

      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          backgroundColor: AppColors.ink9,
          foregroundColor: Colors.white,
          disabledBackgroundColor: AppColors.ink3,
          disabledForegroundColor: AppColors.ink5,
          minimumSize: const Size(double.infinity, 52),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(_radius),
          ),
          textStyle: GoogleFonts.plusJakartaSans(
            fontSize: 15,
            fontWeight: FontWeight.w600,
            letterSpacing: 0.2,
          ),
        ),
      ),

      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          foregroundColor: AppColors.ink7,
          side: const BorderSide(color: AppColors.ink2, width: 1.5),
          minimumSize: const Size(double.infinity, 52),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(_radius),
          ),
          textStyle: GoogleFonts.plusJakartaSans(
            fontSize: 15,
            fontWeight: FontWeight.w500,
          ),
        ),
      ),

      textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(
          foregroundColor: AppColors.gold,
          padding: const EdgeInsets.symmetric(horizontal: 4),
          textStyle: GoogleFonts.plusJakartaSans(
            fontSize: 14,
            fontWeight: FontWeight.w600,
          ),
        ),
      ),

      cardTheme: CardThemeData(
        elevation: 0,
        color: AppColors.surface,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(14),
          side: const BorderSide(color: AppColors.ink2, width: 1.5),
        ),
      ),

      dividerTheme: const DividerThemeData(color: AppColors.ink2, space: 1),

      snackBarTheme: SnackBarThemeData(
        behavior: SnackBarBehavior.floating,
        contentTextStyle: GoogleFonts.plusJakartaSans(fontSize: 14, fontWeight: FontWeight.w500),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
      ),
    );
  }

  static ThemeData get darkTheme {
    final base = ThemeData(
      useMaterial3: true,
      brightness: Brightness.dark,
      colorSchemeSeed: AppColors.gold,
    );
    return base.copyWith(
      scaffoldBackgroundColor: AppColors.ink,
      textTheme: GoogleFonts.plusJakartaSansTextTheme(base.textTheme),
    );
  }
}
