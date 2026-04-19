import 'package:flutter/material.dart';
import '../theme/app_colors.dart';
import '../theme/app_theme.dart';

/// Widget de carga con branding SFIT.
/// La letra "S" del logotipo pulsa suavemente con Curves.easeInOut.
/// Reemplaza el CircularProgressIndicator genérico en pantallas clave.
class SfitLoading extends StatefulWidget {
  /// Mensaje opcional bajo el logo.
  final String? message;

  /// Tamaño del círculo con la "S". Por defecto 64.
  final double size;

  const SfitLoading({super.key, this.message, this.size = 64});

  @override
  State<SfitLoading> createState() => _SfitLoadingState();
}

class _SfitLoadingState extends State<SfitLoading>
    with SingleTickerProviderStateMixin {
  late final AnimationController _ctrl;
  late final Animation<double> _scale;
  late final Animation<double> _opacity;

  @override
  void initState() {
    super.initState();
    _ctrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1200),
    )..repeat(reverse: true);

    _scale = Tween<double>(begin: 0.88, end: 1.08).animate(
      CurvedAnimation(parent: _ctrl, curve: Curves.easeInOut),
    );

    _opacity = Tween<double>(begin: 0.65, end: 1.0).animate(
      CurvedAnimation(parent: _ctrl, curve: Curves.easeInOut),
    );
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          AnimatedBuilder(
            animation: _ctrl,
            builder: (context, child) {
              return Transform.scale(
                scale: _scale.value,
                child: Opacity(
                  opacity: _opacity.value,
                  child: child,
                ),
              );
            },
            child: Container(
              width: widget.size,
              height: widget.size,
              decoration: BoxDecoration(
                color: AppColors.goldBg,
                shape: BoxShape.circle,
                border: Border.all(
                  color: AppColors.goldBorder,
                  width: 2,
                ),
              ),
              alignment: Alignment.center,
              child: Text(
                'S',
                style: AppTheme.syne(
                  fontSize: widget.size * 0.42,
                  fontWeight: FontWeight.w700,
                  color: AppColors.goldDark,
                ),
              ),
            ),
          ),
          if (widget.message != null) ...[
            const SizedBox(height: 16),
            Text(
              widget.message!,
              style: AppTheme.inter(fontSize: 13, color: AppColors.ink5),
              textAlign: TextAlign.center,
            ),
          ],
        ],
      ),
    );
  }
}
