import 'package:flutter/material.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_theme.dart';
import 'sfit_feature_grid.dart';

/// Una categoría de módulos para `SfitCategorizedFeatures`.
class SfitFeatureCategory {
  final String label;
  final IconData icon;
  final List<Widget> modules;

  const SfitFeatureCategory({
    required this.label,
    required this.icon,
    required this.modules,
  });
}

/// Tabs horizontales tipo segmented control + grid responsivo de módulos.
///
/// Reemplaza al patrón "varias secciones apiladas con sus headers" para
/// evitar scroll innecesario: el usuario tap-ea una pill y solo se muestra
/// el grid de esa categoría. Con 3 categorías de ~3 módulos cada una el
/// dashboard cabe sin scrollear en pantallas estándar.
///
/// Las pills se renderizan en un `SingleChildScrollView` horizontal por si
/// hay muchas categorías. La activa lleva ink9 (negro) sólido + texto blanco
/// para máxima legibilidad; las inactivas usan fondo blanco + border ink2.
class SfitCategorizedFeatures extends StatefulWidget {
  final List<SfitFeatureCategory> categories;
  final int initialIndex;

  const SfitCategorizedFeatures({
    super.key,
    required this.categories,
    this.initialIndex = 0,
  });

  @override
  State<SfitCategorizedFeatures> createState() =>
      _SfitCategorizedFeaturesState();
}

class _SfitCategorizedFeaturesState extends State<SfitCategorizedFeatures> {
  late int _index = widget.initialIndex.clamp(0, widget.categories.length - 1);

  @override
  Widget build(BuildContext context) {
    if (widget.categories.isEmpty) return const SizedBox.shrink();
    final active = widget.categories[_index];

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        // Pills de categoría
        SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          padding: const EdgeInsets.symmetric(vertical: 2),
          child: Row(
            children: List.generate(widget.categories.length, (i) {
              final cat = widget.categories[i];
              final selected = i == _index;
              return Padding(
                padding: EdgeInsets.only(right: i == widget.categories.length - 1 ? 0 : 8),
                child: _CategoryPill(
                  label: cat.label,
                  icon: cat.icon,
                  selected: selected,
                  onTap: () => setState(() => _index = i),
                ),
              );
            }),
          ),
        ),
        const SizedBox(height: 12),
        // Grid de la categoría activa con cross-fade entre tabs
        AnimatedSwitcher(
          duration: const Duration(milliseconds: 180),
          switchInCurve: Curves.easeOut,
          switchOutCurve: Curves.easeIn,
          transitionBuilder: (child, anim) => FadeTransition(opacity: anim, child: child),
          child: KeyedSubtree(
            key: ValueKey(_index),
            child: SfitFeatureGrid(children: active.modules),
          ),
        ),
      ],
    );
  }
}

class _CategoryPill extends StatelessWidget {
  final String label;
  final IconData icon;
  final bool selected;
  final VoidCallback onTap;

  const _CategoryPill({
    required this.label,
    required this.icon,
    required this.selected,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(999),
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 180),
          curve: Curves.easeOut,
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 9),
          decoration: BoxDecoration(
            color: selected ? AppColors.ink9 : Colors.white,
            border: Border.all(
              color: selected ? AppColors.ink9 : AppColors.ink2,
              width: 1.2,
            ),
            borderRadius: BorderRadius.circular(999),
            boxShadow: selected
                ? [
                    BoxShadow(
                      color: AppColors.ink9.withValues(alpha: 0.15),
                      blurRadius: 6,
                      offset: const Offset(0, 2),
                    ),
                  ]
                : const [],
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(
                icon,
                size: 14,
                color: selected ? Colors.white : AppColors.ink6,
              ),
              const SizedBox(width: 6),
              Text(
                label,
                style: AppTheme.inter(
                  fontSize: 12,
                  fontWeight: FontWeight.w700,
                  color: selected ? Colors.white : AppColors.ink7,
                  letterSpacing: 0.6,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
