import 'package:flutter/material.dart';
import '../theme/app_colors.dart';

/// Logo diamante de SFIT — reutilizable en cualquier pantalla.
class SfitMark extends StatelessWidget {
  final double size;
  final Color color;
  const SfitMark({super.key, this.size = 32, this.color = AppColors.gold});

  @override
  Widget build(BuildContext context) =>
      CustomPaint(size: Size(size, size), painter: _SfitMarkPainter(color));
}

class _SfitMarkPainter extends CustomPainter {
  final Color color;
  _SfitMarkPainter(this.color);

  @override
  void paint(Canvas canvas, Size s) {
    final stroke = Paint()
      ..color = color
      ..style = PaintingStyle.stroke
      ..strokeWidth = s.width * 0.055
      ..strokeJoin = StrokeJoin.miter;

    final fill = Paint()
      ..color = color
      ..style = PaintingStyle.fill;

    canvas.drawPath(
      Path()
        ..moveTo(s.width * 0.5, s.height * 0.094)
        ..lineTo(s.width * 0.906, s.height * 0.5)
        ..lineTo(s.width * 0.5, s.height * 0.906)
        ..lineTo(s.width * 0.094, s.height * 0.5)
        ..close(),
      stroke,
    );
    canvas.drawPath(
      Path()
        ..moveTo(s.width * 0.5, s.height * 0.297)
        ..lineTo(s.width * 0.703, s.height * 0.5)
        ..lineTo(s.width * 0.5, s.height * 0.703)
        ..lineTo(s.width * 0.297, s.height * 0.5)
        ..close(),
      fill,
    );
  }

  @override
  bool shouldRepaint(_SfitMarkPainter old) => old.color != color;
}
