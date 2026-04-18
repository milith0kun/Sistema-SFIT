import 'package:flutter/material.dart';
import 'sfit_kpi_card.dart';

/// Strip horizontal (o grid responsive) de `SfitKpiCard`s.
///
/// En móvil, si hay pocos items (≤3) los muestra en fila con Expanded.
/// Si hay más, usa un grid 2-col; y permite forzar `cols` si se desea.
class SfitKpiStrip extends StatelessWidget {
  final List<SfitKpiCardData> items;

  /// Fuerza un número de columnas. Si es null, auto:
  ///  - 1-3 items → fila con Expanded
  ///  - 4+ items  → grid 2-col
  final int? cols;

  /// Separación entre cards.
  final double spacing;

  const SfitKpiStrip({
    super.key,
    required this.items,
    this.cols,
    this.spacing = 8,
  });

  @override
  Widget build(BuildContext context) {
    if (items.isEmpty) return const SizedBox.shrink();

    final effectiveCols = cols ?? (items.length <= 3 ? items.length : 2);

    return LayoutBuilder(
      builder: (context, constraints) {
        final totalSpacing = spacing * (effectiveCols - 1);
        final itemWidth = (constraints.maxWidth - totalSpacing) / effectiveCols;

        return Wrap(
          spacing: spacing,
          runSpacing: spacing,
          children: items
              .map(
                (it) => SizedBox(
                  width: itemWidth,
                  child: SfitKpiCard.fromData(it),
                ),
              )
              .toList(),
        );
      },
    );
  }
}
