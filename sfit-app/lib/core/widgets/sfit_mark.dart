import 'package:flutter/material.dart';

/// Logo mark SFIT (cuadrado) — PNG de alta resolución.
/// Nota: se usa PNG en vez de SVG porque `flutter_svg` no soporta los
/// filtros SVG que trae el logo institucional (diseño en Canva).
class SfitMark extends StatelessWidget {
  final double size;
  final Color? color; // compat — ignorado por ser PNG institucional

  const SfitMark({super.key, this.size = 32, this.color});

  @override
  Widget build(BuildContext context) {
    return Image.asset(
      'assets/logos/sfit-mark.png',
      width: size,
      height: size,
      fit: BoxFit.contain,
      filterQuality: FilterQuality.high,
    );
  }
}

/// Logo horizontal SFIT (marca completa con texto) — PNG 1024x512.
/// Úsalo en splash, cabeceras de auth y branding donde hay espacio.
class SfitFullLogo extends StatelessWidget {
  final double width;
  const SfitFullLogo({super.key, this.width = 200});

  @override
  Widget build(BuildContext context) {
    return Image.asset(
      'assets/logos/sfit-full.png',
      width: width,
      fit: BoxFit.contain,
      filterQuality: FilterQuality.high,
    );
  }
}
