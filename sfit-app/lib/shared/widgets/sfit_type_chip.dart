import 'package:flutter/material.dart';
import '../../core/theme/app_theme.dart';

/// Chip institucional con color custom. Réplica de `TypeChip` web:
/// bg = `color.withValues(alpha:0.08)`, border = `color.withValues(alpha:0.3)`,
/// texto en `color` uppercase 10.5 weight 700 letter-spacing 0.08em.
class SfitTypeChip extends StatelessWidget {
  final String label;
  final Color color;

  const SfitTypeChip({super.key, required this.label, required this.color});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.08),
        border: Border.all(color: color.withValues(alpha: 0.3), width: 1),
        borderRadius: BorderRadius.circular(4),
      ),
      child: Text(
        label.toUpperCase(),
        style: AppTheme.inter(
          fontSize: 10.5,
          fontWeight: FontWeight.w700,
          color: color,
          letterSpacing: 0.85,
        ),
      ),
    );
  }
}
