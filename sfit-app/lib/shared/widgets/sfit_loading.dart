import 'package:flutter/material.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_theme.dart';

/// Indicador de carga canónico SFIT. Centraliza colores, tamaños y
/// comportamientos de loading para toda la app.
///
/// Modos:
/// - `page`: Centered spinner a pantalla completa (reemplaza loading states).
/// - `inline`: Spinner compacto para botones, listas o cards.
/// - `overlay`: Spinner semi-transparente sobre contenido existente.
class SfitLoading extends StatelessWidget {
  final SfitLoadingMode mode;
  final Color? color;
  final double strokeWidth;
  final String? label;

  const SfitLoading({
    super.key,
    this.mode = SfitLoadingMode.page,
    this.color,
    this.strokeWidth = 2.5,
    this.label,
  });

  /// Loading a pantalla completa centrado.
  const SfitLoading.page({Key? key, Color? color, double strokeWidth = 2.5, String? label})
      : this(key: key, mode: SfitLoadingMode.page, color: color, strokeWidth: strokeWidth, label: label);

  /// Loading inline compacto (para botones, filas, cards).
  const SfitLoading.inline({Key? key, Color? color, double strokeWidth = 2})
      : this(key: key, mode: SfitLoadingMode.inline, color: color, strokeWidth: strokeWidth, label: null);

  /// Loading overlay sobre contenido existente.
  const SfitLoading.overlay({Key? key, Color? color, double strokeWidth = 2.5, String? label})
      : this(key: key, mode: SfitLoadingMode.overlay, color: color, strokeWidth: strokeWidth, label: label);

  @override
  Widget build(BuildContext context) {
    final spinnerColor = color ?? AppColors.gold;
    final spinner = CircularProgressIndicator(
      strokeWidth: strokeWidth,
      color: spinnerColor,
    );

    switch (mode) {
      case SfitLoadingMode.page:
        return Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              SizedBox(width: 28, height: 28, child: spinner),
              if (label != null) ...[
                const SizedBox(height: 12),
                Text(
                  label!,
                  style: AppTheme.inter(fontSize: 13, color: AppColors.ink5, fontWeight: FontWeight.w500),
                ),
              ],
            ],
          ),
        );
      case SfitLoadingMode.inline:
        return SizedBox(width: 18, height: 18, child: spinner);
      case SfitLoadingMode.overlay:
        return Stack(
          children: [
            const Opacity(opacity: 0.3, child: ModalBarrier(dismissible: false)),
            Center(
              child: Container(
                padding: const EdgeInsets.all(20),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(12),
                  boxShadow: [
                    BoxShadow(color: Colors.black.withValues(alpha: 0.1), blurRadius: 12),
                  ],
                ),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    SizedBox(width: 28, height: 28, child: spinner),
                    if (label != null) ...[
                      const SizedBox(height: 10),
                      Text(
                        label!,
                        style: AppTheme.inter(fontSize: 12, color: AppColors.ink5, fontWeight: FontWeight.w600),
                      ),
                    ],
                  ],
                ),
              ),
            ),
          ],
        );
    }
  }
}

enum SfitLoadingMode { page, inline, overlay }
