import 'package:flutter/material.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_theme.dart';

/// Indicador visual del `serviceScope` de una empresa de transporte.
///
/// Las empresas urbanas operan rutas con paraderos fijos (los conductores
/// hacen check-in en cada paradero); las interprovinciales/interregionales
/// solo manejan origen + destino con horarios.
///
/// Se usa en cualquier listado/detalle de empresas: onboarding del conductor,
/// "Mi empresa", buscador de empresas del operador, etc.
///
/// Si el `scope` viene `null` o vacío (datos viejos), se muestra "Sin
/// clasificar" para que el usuario sepa que la empresa todavía no decidió
/// modalidad — útil mientras los operadores legacy completan su perfil.
class ScopeBadge extends StatelessWidget {
  final String? scope;
  final bool compact;

  const ScopeBadge({
    super.key,
    required this.scope,
    this.compact = false,
  });

  /// Color púrpura para empresas interprovinciales/interregionales. No está
  /// en `AppColors` porque es exclusivo de este badge y no se reutiliza.
  static const _interprovColor = Color(0xFF7C3AED);
  static const _interprovBg = Color(0xFFF5F3FF);
  static const _interprovBorder = Color(0xFFDDD6FE);

  ({IconData icon, Color color, Color bg, Color border, String text}) _resolve() {
    final s = scope ?? '';
    if (s == 'urbano' || s.startsWith('urbano_')) {
      return (
        icon: Icons.directions_bus_filled_rounded,
        color: AppColors.info,
        bg: AppColors.infoBg,
        border: AppColors.infoBorder,
        text: 'Urbano · con paraderos',
      );
    }
    if (s == 'interprovincial' ||
        s == 'interprovincial_regional' ||
        s == 'interregional_nacional') {
      return (
        icon: Icons.alt_route_rounded,
        color: _interprovColor,
        bg: _interprovBg,
        border: _interprovBorder,
        text: 'Interprovincial · sin paraderos',
      );
    }
    return (
      icon: Icons.help_outline_rounded,
      color: AppColors.ink6,
      bg: AppColors.ink1,
      border: AppColors.ink2,
      text: 'Sin clasificar',
    );
  }

  @override
  Widget build(BuildContext context) {
    final r = _resolve();
    final paddingH = compact ? 7.0 : 9.0;
    final paddingV = compact ? 3.0 : 4.0;
    final iconSize = compact ? 11.0 : 13.0;
    final fontSize = compact ? 10.5 : 11.5;
    return Container(
      padding: EdgeInsets.symmetric(horizontal: paddingH, vertical: paddingV),
      decoration: BoxDecoration(
        color: r.bg,
        border: Border.all(color: r.border, width: 1),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(r.icon, size: iconSize, color: r.color),
          const SizedBox(width: 4),
          Text(
            r.text,
            style: AppTheme.inter(
              fontSize: fontSize,
              fontWeight: FontWeight.w700,
              color: r.color,
              letterSpacing: 0.2,
            ),
          ),
        ],
      ),
    );
  }
}

/// Texto explicativo para el conductor sobre lo que implica el scope de su
/// empresa. Se muestra debajo del badge en `mi_empresa_page`.
String scopeExplanation(String? scope) {
  final s = scope ?? '';
  if (s == 'urbano' || s.startsWith('urbano_')) {
    return 'Esta empresa opera rutas urbanas con paraderos fijos. Verás '
        'los paraderos en tu mapa al iniciar el turno.';
  }
  if (s == 'interprovincial' ||
      s == 'interprovincial_regional' ||
      s == 'interregional_nacional') {
    return 'Esta empresa opera viajes interprovinciales por horarios. '
        'Confirmarás origen y destino al iniciar el turno (sin paraderos '
        'intermedios obligatorios).';
  }
  return 'Esta empresa todavía no tiene un tipo de servicio definido. '
      'Pide al administrador que lo configure.';
}
