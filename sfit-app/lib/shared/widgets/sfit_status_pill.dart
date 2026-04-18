import 'package:flutter/material.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_theme.dart';

/// Estados canónicos SFIT. Espejo de `StatusVariant` web.
enum SfitStatus {
  apto,
  disponible,
  activo,
  enRuta,
  pendiente,
  riesgo,
  mantenimiento,
  suspendido,
  noApto,
  rechazado,
  fueraServicio,
  inactivo,
}

class _StatusDef {
  final String label;
  final Color color;
  final Color bg;
  final Color dot;
  const _StatusDef(this.label, this.color, this.bg, this.dot);
}

// Mapeo exacto del sistema web. Verde apto / Gold enRuta / Naranja
// riesgo-pendiente-mant / Rojo no-rechazado-suspendido / Neutro inactivo.
const _variants = <SfitStatus, _StatusDef>{
  SfitStatus.apto:
      _StatusDef('Apto', AppColors.apto, AppColors.aptoBg, AppColors.apto),
  SfitStatus.disponible:
      _StatusDef('Disponible', AppColors.apto, AppColors.aptoBg, AppColors.apto),
  SfitStatus.activo:
      _StatusDef('Activo', AppColors.apto, AppColors.aptoBg, AppColors.apto),
  SfitStatus.enRuta:
      _StatusDef('En ruta', AppColors.gold, AppColors.goldBg, AppColors.goldLight),
  SfitStatus.pendiente:
      _StatusDef('Pendiente', AppColors.riesgo, AppColors.riesgoBg, AppColors.riesgo),
  SfitStatus.riesgo:
      _StatusDef('Riesgo', AppColors.riesgo, AppColors.riesgoBg, AppColors.riesgo),
  SfitStatus.mantenimiento: _StatusDef(
      'Mantenimiento', AppColors.riesgo, AppColors.riesgoBg, AppColors.riesgo),
  SfitStatus.suspendido:
      _StatusDef('Suspendido', AppColors.noApto, AppColors.noAptoBg, AppColors.noApto),
  SfitStatus.noApto:
      _StatusDef('No apto', AppColors.noApto, AppColors.noAptoBg, AppColors.noApto),
  SfitStatus.rechazado:
      _StatusDef('Rechazado', AppColors.noApto, AppColors.noAptoBg, AppColors.noApto),
  SfitStatus.fueraServicio: _StatusDef(
      'Fuera servicio', AppColors.noApto, AppColors.noAptoBg, AppColors.noApto),
  SfitStatus.inactivo:
      _StatusDef('Inactivo', AppColors.ink6, AppColors.ink1, AppColors.ink5),
};

/// Pill canónica de estado: dot + texto uppercase. Réplica de `StatusPill` web.
class SfitStatusPill extends StatelessWidget {
  final SfitStatus status;

  /// Si se pasa, sobrescribe el label por defecto del status.
  final String? label;

  const SfitStatusPill({super.key, required this.status, this.label});

  @override
  Widget build(BuildContext context) {
    final v = _variants[status]!;
    final text = (label ?? v.label).toUpperCase();

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 3),
      decoration: BoxDecoration(
        color: v.bg,
        borderRadius: BorderRadius.circular(999),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 6,
            height: 6,
            decoration: BoxDecoration(color: v.dot, shape: BoxShape.circle),
          ),
          const SizedBox(width: 6),
          Text(
            text,
            style: AppTheme.inter(
              fontSize: 10.5,
              fontWeight: FontWeight.w700,
              color: v.color,
              letterSpacing: 0.3,
            ),
          ),
        ],
      ),
    );
  }
}
