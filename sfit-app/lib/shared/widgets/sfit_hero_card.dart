import 'package:flutter/material.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_theme.dart';

/// Pill de stat rápida usado dentro de `SfitHeroCard`.
/// Contiene un label uppercase + valor numérico grande.
class SfitHeroPill extends StatelessWidget {
  final String label;
  final String value;
  final bool warn;

  const SfitHeroPill({
    super.key,
    required this.label,
    required this.value,
    this.warn = false,
  });

  @override
  Widget build(BuildContext context) {
    final bg = warn
        ? const Color(0x1FEF4444) // rgba(239,68,68,0.12)
        : Colors.white.withValues(alpha: 0.08);
    final border = warn
        ? const Color(0x66EF4444) // rgba(239,68,68,0.4)
        : Colors.white.withValues(alpha: 0.12);
    final labelColor = warn
        ? const Color(0xFFFCA5A5)
        : Colors.white.withValues(alpha: 0.55);

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      constraints: const BoxConstraints(minWidth: 110),
      decoration: BoxDecoration(
        color: bg,
        border: Border.all(color: border, width: 1),
        borderRadius: BorderRadius.circular(10),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label.toUpperCase(),
            style: AppTheme.inter(
              fontSize: 10,
              fontWeight: FontWeight.w700,
              color: labelColor,
              letterSpacing: 1.4,
            ),
          ),
          const SizedBox(height: 2),
          Text(
            value,
            style: AppTheme.inter(
              fontSize: 22,
              fontWeight: FontWeight.w700,
              color: Colors.white,
              letterSpacing: -0.5,
              tabular: true,
            ),
          ),
        ],
      ),
    );
  }
}

/// Card navy gradient con radial gold glow + dot pattern. Patrón canónico
/// del `DashboardHero` web (navegación, saludo, contexto RF).
///
/// El kicker se renderiza uppercase con dot pulse gold; el título usa
/// Syne 700. Opcionalmente se pueden pasar `pills` para stats rápidas.
class SfitHeroCard extends StatefulWidget {
  final String kicker;
  final String title;
  final String? subtitle;
  final String? rfCode;
  final List<SfitHeroPill>? pills;
  final bool animatePulse;

  const SfitHeroCard({
    super.key,
    required this.kicker,
    required this.title,
    this.subtitle,
    this.rfCode,
    this.pills,
    this.animatePulse = true,
  });

  @override
  State<SfitHeroCard> createState() => _SfitHeroCardState();
}

class _SfitHeroCardState extends State<SfitHeroCard>
    with SingleTickerProviderStateMixin {
  late final AnimationController _pulseCtrl;

  @override
  void initState() {
    super.initState();
    _pulseCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 2000),
    );
    if (widget.animatePulse) _pulseCtrl.repeat(reverse: true);
  }

  @override
  void dispose() {
    _pulseCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(14),
      child: DecoratedBox(
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [AppColors.panel, AppColors.panelMid, AppColors.panelLight],
            stops: [0.0, 0.55, 1.0],
          ),
        ),
        child: Stack(
          children: [
            // Dot pattern sutil
            const Positioned.fill(
              child: CustomPaint(painter: _DotPatternPainter()),
            ),
            // Radial gold glow top-right
            Positioned(
              top: -60,
              right: -60,
              child: Container(
                width: 240,
                height: 240,
                decoration: const BoxDecoration(
                  shape: BoxShape.circle,
                  gradient: RadialGradient(
                    colors: [Color(0x40B8860B), Color(0x00B8860B)],
                    stops: [0.0, 0.65],
                  ),
                ),
              ),
            ),
            // Contenido
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 18, 20, 18),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  _buildKicker(),
                  const SizedBox(height: 8),
                  Text(
                    widget.title,
                    style: AppTheme.syne(
                      fontSize: 24,
                      fontWeight: FontWeight.w700,
                      color: Colors.white,
                      letterSpacing: -0.6,
                      height: 1.08,
                    ),
                  ),
                  if (widget.subtitle != null) ...[
                    const SizedBox(height: 6),
                    Text(
                      widget.subtitle!,
                      style: AppTheme.inter(
                        fontSize: 13,
                        color: Colors.white.withValues(alpha: 0.75),
                        height: 1.45,
                      ),
                    ),
                  ],
                  if (widget.pills != null && widget.pills!.isNotEmpty) ...[
                    const SizedBox(height: 16),
                    Wrap(
                      spacing: 8,
                      runSpacing: 8,
                      children: widget.pills!,
                    ),
                  ],
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildKicker() {
    final dot = AnimatedBuilder(
      animation: _pulseCtrl,
      builder: (_, __) => Opacity(
        opacity: widget.animatePulse
            ? (1 - _pulseCtrl.value * 0.65).clamp(0.35, 1.0)
            : 1.0,
        child: Container(
          width: 5,
          height: 5,
          decoration: const BoxDecoration(
            color: AppColors.goldLight,
            shape: BoxShape.circle,
          ),
        ),
      ),
    );

    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        dot,
        const SizedBox(width: 7),
        Text(
          widget.kicker.toUpperCase(),
          style: AppTheme.inter(
            fontSize: 10.5,
            fontWeight: FontWeight.w700,
            color: AppColors.goldLight,
            letterSpacing: 2.1,
          ),
        ),
        if (widget.rfCode != null) ...[
          const SizedBox(width: 6),
          Text(
            '· ${widget.rfCode!}',
            style: AppTheme.inter(
              fontSize: 10.5,
              fontWeight: FontWeight.w700,
              color: AppColors.goldLight.withValues(alpha: 0.55),
              letterSpacing: 2.1,
            ),
          ),
        ],
      ],
    );
  }
}

/// Pinta un patrón sutil de puntos blancos con opacity 0.04,
/// espaciados cada 22px (equivalente CSS del hero web).
class _DotPatternPainter extends CustomPainter {
  const _DotPatternPainter();

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()..color = Colors.white.withValues(alpha: 0.04);
    const spacing = 22.0;
    const radius = 1.0;
    for (double y = 1; y < size.height; y += spacing) {
      for (double x = 1; x < size.width; x += spacing) {
        canvas.drawCircle(Offset(x, y), radius, paint);
      }
    }
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
