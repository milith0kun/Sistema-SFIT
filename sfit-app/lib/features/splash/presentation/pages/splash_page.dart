import 'package:flutter/material.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/widgets/sfit_mark.dart';

/// Pantalla splash. Fondo panel navy con gold glow sutil y logo institucional.
/// Tagline en Inter (no Syne) para mantener jerarquía: la marca es la estrella.
class SplashPage extends StatelessWidget {
  const SplashPage({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.panel,
      body: Stack(
        children: [
          // Glow gold radial sutil top-right
          Positioned(
            top: -120,
            right: -120,
            child: Container(
              width: 360,
              height: 360,
              decoration: const BoxDecoration(
                shape: BoxShape.circle,
                gradient: RadialGradient(
                  colors: [Color(0x33B8860B), Color(0x00B8860B)],
                  stops: [0.0, 0.7],
                ),
              ),
            ),
          ),
          // Dot pattern
          const Positioned.fill(
            child: CustomPaint(painter: _SplashDotPainter()),
          ),
          Center(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const SfitFullLogo(width: 240),
                const SizedBox(height: 20),
                Text(
                  'Fiscalización Inteligente de Transporte',
                  style: AppTheme.inter(
                    fontSize: 12,
                    fontWeight: FontWeight.w500,
                    color: Colors.white.withValues(alpha: 0.55),
                    letterSpacing: 0.4,
                  ),
                ),
                const SizedBox(height: 72),
                const SizedBox(
                  width: 22,
                  height: 22,
                  child: CircularProgressIndicator(
                    strokeWidth: 2,
                    color: AppColors.goldLight,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _SplashDotPainter extends CustomPainter {
  const _SplashDotPainter();

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()..color = Colors.white.withValues(alpha: 0.03);
    const spacing = 28.0;
    for (double y = 1; y < size.height; y += spacing) {
      for (double x = 1; x < size.width; x += spacing) {
        canvas.drawCircle(Offset(x, y), 1, paint);
      }
    }
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
