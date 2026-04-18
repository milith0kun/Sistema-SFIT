import 'package:flutter/material.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_theme.dart';

/// Header de sección agrupada: barra vertical de color + título uppercase
/// + count pill + Expanded divider + contenido child. Espejo de
/// `GroupedSection` web.
class SfitGroupedSection extends StatelessWidget {
  final Color color;
  final String title;
  final int count;
  final Widget child;

  /// Margen inferior entre header y contenido.
  final double gap;

  const SfitGroupedSection({
    super.key,
    required this.color,
    required this.title,
    required this.count,
    required this.child,
    this.gap = 10,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        Row(
          children: [
            // Barra vertical de color
            Container(
              width: 3,
              height: 14,
              decoration: BoxDecoration(
                color: color,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
            const SizedBox(width: 10),
            // Título uppercase
            Text(
              title.toUpperCase(),
              style: AppTheme.inter(
                fontSize: 13,
                fontWeight: FontWeight.w700,
                color: AppColors.ink9,
                letterSpacing: 1.0,
              ),
            ),
            const SizedBox(width: 8),
            // Count pill
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 1),
              decoration: BoxDecoration(
                color: AppColors.ink1,
                borderRadius: BorderRadius.circular(999),
              ),
              child: Text(
                count.toString(),
                style: AppTheme.inter(
                  fontSize: 11,
                  fontWeight: FontWeight.w600,
                  color: AppColors.ink5,
                  tabular: true,
                ),
              ),
            ),
            const SizedBox(width: 10),
            // Divisor horizontal
            const Expanded(
              child: DecoratedBox(
                decoration: BoxDecoration(
                  border: Border(
                    bottom: BorderSide(color: AppColors.ink2, width: 1),
                  ),
                ),
                child: SizedBox(height: 1),
              ),
            ),
          ],
        ),
        SizedBox(height: gap),
        child,
      ],
    );
  }
}
