import 'package:flutter/material.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_theme.dart';

/// Header de sección simple: barra vertical de color + título uppercase +
/// subtítulo opcional + (opcional) trailing action.
///
/// Más ligero que `SfitGroupedSection`: no lleva count pill ni divisor inline.
class SfitSectionHeader extends StatelessWidget {
  final Color color;
  final String title;
  final String? subtitle;
  final Widget? trailing;

  const SfitSectionHeader({
    super.key,
    required this.title,
    this.color = AppColors.gold,
    this.subtitle,
    this.trailing,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            Container(
              width: 3,
              height: subtitle != null ? 32 : 18,
              decoration: BoxDecoration(
                color: color,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    title.toUpperCase(),
                    style: AppTheme.inter(
                      fontSize: 13,
                      fontWeight: FontWeight.w700,
                      color: AppColors.ink9,
                      letterSpacing: 1.2,
                    ),
                  ),
                  if (subtitle != null) ...[
                    const SizedBox(height: 2),
                    Text(
                      subtitle!,
                      style: AppTheme.inter(
                        fontSize: 12,
                        color: AppColors.ink5,
                      ),
                    ),
                  ],
                ],
              ),
            ),
            if (trailing != null) trailing!,
          ],
        ),
        const SizedBox(height: 10),
        const Divider(height: 1, thickness: 1, color: AppColors.ink2),
      ],
    );
  }
}
