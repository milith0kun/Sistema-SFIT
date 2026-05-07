import 'package:flutter/material.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_theme.dart';

/// Datos para una KPI individual (usado por `SfitKpiStrip`).
class SfitKpiCardData {
  final IconData icon;
  final String label;
  final String value;
  final String? subtitle;
  final Color accent;

  const SfitKpiCardData({
    required this.icon,
    required this.label,
    required this.value,
    required this.accent,
    this.subtitle,
  });
}

/// Card KPI canónica: ícono watermark bottom-right con opacity muy baja,
/// kicker uppercase con dot de color accent, número grande Inter 700
/// tabular y subtítulo gris opcional.
class SfitKpiCard extends StatelessWidget {
  final IconData icon;
  final String label;
  final String value;
  final String? subtitle;
  final Color accent;

  const SfitKpiCard({
    super.key,
    required this.icon,
    required this.label,
    required this.value,
    required this.accent,
    this.subtitle,
  });

  SfitKpiCard.fromData(SfitKpiCardData d, {super.key})
      : icon = d.icon,
        label = d.label,
        value = d.value,
        subtitle = d.subtitle,
        accent = d.accent;

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(10),
      child: Container(
        decoration: BoxDecoration(
          color: Colors.white,
          border: Border.all(color: AppColors.ink2, width: 1),
          borderRadius: BorderRadius.circular(10),
          boxShadow: [
            BoxShadow(
              color: AppColors.ink9.withValues(alpha: 0.04),
              blurRadius: 6,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        padding: const EdgeInsets.fromLTRB(12, 12, 12, 10),
        child: Stack(
          clipBehavior: Clip.none,
          children: [
            // Ícono watermark decorativo
            Positioned(
              right: -8,
              bottom: -8,
              child: Icon(
                icon,
                size: 64,
                color: accent.withValues(alpha: 0.06),
              ),
            ),
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                // Kicker: dot + label uppercase
                Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Container(
                      width: 4,
                      height: 4,
                      decoration: BoxDecoration(
                        color: accent,
                        shape: BoxShape.circle,
                      ),
                    ),
                    const SizedBox(width: 6),
                    Flexible(
                      child: Text(
                        label.toUpperCase(),
                        style: AppTheme.inter(
                          fontSize: 10,
                          fontWeight: FontWeight.w700,
                          color: AppColors.ink5,
                          letterSpacing: 1.6,
                        ),
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 4),
                Text(
                  value,
                  style: AppTheme.inter(
                    fontSize: 22,
                    fontWeight: FontWeight.w800,
                    color: AppColors.ink9,
                    letterSpacing: -0.6,
                    height: 1.05,
                    tabular: true,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                if (subtitle != null) ...[
                  const SizedBox(height: 2),
                  Text(
                    subtitle!,
                    style: AppTheme.inter(
                      fontSize: 11,
                      fontWeight: FontWeight.w500,
                      color: AppColors.ink5,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ],
              ],
            ),
          ],
        ),
      ),
    );
  }
}
