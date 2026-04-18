import 'package:flutter/material.dart';
import '../../core/theme/app_colors.dart';

/// Card genérica estilo `VehiculoCard` de `/flota`. Fondo blanco, border
/// 1.5px `ink2`, border-top 3px de color accent (tipo de entidad).
///
/// El contenido es totalmente libre. Si `onTap` se provee, se envuelve
/// en un `InkWell` con ripple.
class SfitItemCard extends StatelessWidget {
  final Widget child;
  final Color? accentColor;
  final VoidCallback? onTap;
  final EdgeInsetsGeometry padding;

  const SfitItemCard({
    super.key,
    required this.child,
    this.accentColor,
    this.onTap,
    this.padding = const EdgeInsets.all(14),
  });

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(12),
      child: Material(
        color: Colors.white,
        child: InkWell(
          onTap: onTap,
          child: Container(
            decoration: BoxDecoration(
              border: Border(
                top: BorderSide(
                  color: accentColor ?? AppColors.ink2,
                  width: accentColor != null ? 3 : 1.5,
                ),
                left: const BorderSide(color: AppColors.ink2, width: 1.5),
                right: const BorderSide(color: AppColors.ink2, width: 1.5),
                bottom: const BorderSide(color: AppColors.ink2, width: 1.5),
              ),
              borderRadius: BorderRadius.circular(12),
            ),
            padding: padding,
            child: child,
          ),
        ),
      ),
    );
  }
}
