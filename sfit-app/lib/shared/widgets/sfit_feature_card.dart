import 'package:flutter/material.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_theme.dart';

/// Card compacta para módulos disponibles en el dashboard.
///
/// Espejo 1:1 del `FeatureCard` web (`sfit-web/src/components/dashboard/FeatureCard.tsx`):
/// fondo blanco, border ink2, **ícono watermark grande en esquina inferior-derecha**
/// (no chip lateral), título + subtítulo apilados verticalmente.
///
/// Estado normal: sin sombra. Al presionar: bg primaryBg suave, border
/// primaryBorder, sombra rojiza (`0 6px 18px rgba(108,6,6,0.08)`) y
/// translateY(-1px) — exacto al `:hover` web.
class SfitFeatureCard extends StatefulWidget {
  final IconData icon;
  final String title;
  final String subtitle;
  final VoidCallback onTap;
  final String? badge;

  const SfitFeatureCard({
    super.key,
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.onTap,
    this.badge,
  });

  @override
  State<SfitFeatureCard> createState() => _SfitFeatureCardState();
}

class _SfitFeatureCardState extends State<SfitFeatureCard> {
  bool _pressed = false;

  void _setPressed(bool v) {
    if (_pressed != v) setState(() => _pressed = v);
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedContainer(
      duration: const Duration(milliseconds: 180),
      curve: Curves.easeOut,
      transform: Matrix4.translationValues(0, _pressed ? -1 : 0, 0),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(12),
        boxShadow: _pressed
            ? [
                // Espejo del :hover web: 0 6px 18px rgba(108,6,6,0.08)
                BoxShadow(
                  color: AppColors.primary.withValues(alpha: 0.08),
                  blurRadius: 18,
                  offset: const Offset(0, 6),
                ),
              ]
            : const [],
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(12),
        child: Material(
          color: _pressed ? const Color(0xFFFDF8F8) : Colors.white,
          child: InkWell(
            onTap: widget.onTap,
            onTapDown: (_) => _setPressed(true),
            onTapUp: (_) => _setPressed(false),
            onTapCancel: () => _setPressed(false),
            onHighlightChanged: _setPressed,
            splashColor: AppColors.primaryBg.withValues(alpha: 0.4),
            highlightColor: Colors.transparent,
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 180),
              curve: Curves.easeOut,
              decoration: BoxDecoration(
                border: Border.all(
                  color: _pressed ? AppColors.primaryBorder : AppColors.ink2,
                  width: 1.5,
                ),
                borderRadius: BorderRadius.circular(12),
              ),
              padding: const EdgeInsets.fromLTRB(13, 10, 13, 10),
              constraints: const BoxConstraints(minHeight: 70),
              child: Stack(
                clipBehavior: Clip.none,
                children: [
                  // Ícono watermark — esquina inferior-derecha,
                  // grande y rojizo. Igual al web (opacity 0.09 → 0.16).
                  Positioned(
                    right: -8,
                    bottom: -12,
                    child: AnimatedOpacity(
                      duration: const Duration(milliseconds: 180),
                      opacity: _pressed ? 0.16 : 0.09,
                      child: Icon(
                        widget.icon,
                        size: 72,
                        color: AppColors.primary,
                      ),
                    ),
                  ),

                  // Texto: título + subtítulo apilados
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisAlignment: MainAxisAlignment.center,
                    mainAxisSize: MainAxisSize.max,
                    children: [
                      Text(
                        widget.title,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: AppTheme.inter(
                          fontSize: 13.5,
                          fontWeight: FontWeight.w600,
                          color: AppColors.ink9,
                          letterSpacing: -0.07,
                          height: 1.25,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        widget.subtitle,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: AppTheme.inter(
                          fontSize: 11.5,
                          fontWeight: FontWeight.w500,
                          color: AppColors.ink5,
                          height: 1.35,
                        ),
                      ),
                    ],
                  ),

                  // Badge opcional — esquina superior-derecha
                  if (widget.badge != null)
                    Positioned(
                      top: 0,
                      right: 0,
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                        decoration: BoxDecoration(
                          color: AppColors.primaryBg,
                          border: Border.all(color: AppColors.primaryBorder),
                          borderRadius: BorderRadius.circular(999),
                        ),
                        constraints: const BoxConstraints(minWidth: 22, minHeight: 22),
                        alignment: Alignment.center,
                        child: Text(
                          widget.badge!,
                          style: AppTheme.inter(
                            fontSize: 11,
                            fontWeight: FontWeight.w700,
                            color: AppColors.primaryDark,
                            letterSpacing: 0.2,
                          ),
                        ),
                      ),
                    ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
