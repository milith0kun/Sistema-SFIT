import 'package:flutter/material.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_theme.dart';

/// Botón primario canónico SFIT. Fondo `ink` casi negro, borde gold en
/// pressed (inset shadow equivalente). Spinner inline cuando `loading=true`.
///
/// Inspirado en `btnInk` de `/flota` con el toque gold del hover web.
class SfitPrimaryButton extends StatefulWidget {
  final String label;
  final VoidCallback? onPressed;
  final IconData? icon;
  final bool loading;
  final bool enabled;

  /// Si true, el botón ocupa todo el ancho disponible.
  final bool expand;

  const SfitPrimaryButton({
    super.key,
    required this.label,
    this.onPressed,
    this.icon,
    this.loading = false,
    this.enabled = true,
    this.expand = true,
  });

  @override
  State<SfitPrimaryButton> createState() => _SfitPrimaryButtonState();
}

class _SfitPrimaryButtonState extends State<SfitPrimaryButton> {
  bool _pressed = false;

  @override
  Widget build(BuildContext context) {
    final canTap = widget.enabled && !widget.loading && widget.onPressed != null;
    final bg = canTap
        ? (_pressed ? AppColors.ink : AppColors.ink9)
        : AppColors.ink3;
    final goldEdge = _pressed && canTap;

    final content = Row(
      mainAxisSize: widget.expand ? MainAxisSize.max : MainAxisSize.min,
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        if (widget.loading)
          const SizedBox(
            width: 18,
            height: 18,
            child: CircularProgressIndicator(
              strokeWidth: 2,
              color: Colors.white,
            ),
          )
        else ...[
          if (widget.icon != null) ...[
            Icon(widget.icon, size: 18, color: Colors.white),
            const SizedBox(width: 8),
          ],
          Text(
            widget.label,
            style: AppTheme.inter(
              fontSize: 14.5,
              fontWeight: FontWeight.w600,
              color: Colors.white,
              letterSpacing: 0.1,
            ),
          ),
        ],
      ],
    );

    return GestureDetector(
      onTapDown: canTap ? (_) => setState(() => _pressed = true) : null,
      onTapCancel: canTap ? () => setState(() => _pressed = false) : null,
      onTapUp: canTap ? (_) => setState(() => _pressed = false) : null,
      onTap: canTap ? widget.onPressed : null,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 120),
        height: 48,
        width: widget.expand ? double.infinity : null,
        padding: EdgeInsets.symmetric(horizontal: widget.expand ? 16 : 20),
        decoration: BoxDecoration(
          color: bg,
          borderRadius: BorderRadius.circular(10),
          border: Border.all(
            color: goldEdge ? AppColors.goldLight : Colors.transparent,
            width: goldEdge ? 1.5 : 0,
          ),
          boxShadow: goldEdge
              ? [
                  BoxShadow(
                    color: AppColors.gold.withValues(alpha: 0.35),
                    blurRadius: 10,
                    spreadRadius: 0.5,
                  ),
                ]
              : null,
        ),
        child: Center(child: content),
      ),
    );
  }
}
