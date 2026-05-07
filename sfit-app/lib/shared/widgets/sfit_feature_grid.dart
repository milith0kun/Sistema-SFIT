import 'package:flutter/material.dart';

/// Grid responsivo para mostrar `SfitFeatureCard`s.
///
/// Adapta automáticamente columnas y proporción al ancho disponible:
/// - `< 380` → 2 cols, ratio 2.05  (móviles compactos)
/// - `< 600` → 2 cols, ratio 2.25  (móvil estándar)
/// - `< 900` → 3 cols, ratio 2.0   (foldable abierto / phablet)
/// - `>= 900`→ 4 cols, ratio 1.85  (tablet)
///
/// Reemplaza al `GridView.count(crossAxisCount: 2, ...)` repetido en cada
/// dashboard para garantizar consistencia visual y aprovechamiento del
/// espacio en cualquier tamaño de pantalla.
class SfitFeatureGrid extends StatelessWidget {
  final List<Widget> children;
  final double spacing;

  const SfitFeatureGrid({
    super.key,
    required this.children,
    this.spacing = 10,
  });

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final w = constraints.maxWidth;
        final (cols, ratio) = _layoutFor(w);

        return GridView.count(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          crossAxisCount: cols,
          mainAxisSpacing: spacing,
          crossAxisSpacing: spacing,
          childAspectRatio: ratio,
          children: children,
        );
      },
    );
  }

  /// Devuelve (columnas, aspect ratio) según el ancho disponible.
  /// Calibrado para SfitFeatureCard compacto (minHeight ~70px, watermark 72px).
  (int, double) _layoutFor(double width) {
    if (width >= 900) return (4, 1.95);
    if (width >= 600) return (3, 2.15);
    if (width < 380) return (2, 2.25);
    return (2, 2.45);
  }
}
