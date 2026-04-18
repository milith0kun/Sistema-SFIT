import 'package:flutter/material.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_theme.dart';

/// Tipo de evento — determina el color del dot.
enum SfitEventType { salida, alerta, retorno, sistema, info }

class SfitEvent {
  final String id;
  final String hora; // p.ej. "08:42"
  final SfitEventType tipo;
  final String texto;

  const SfitEvent({
    required this.id,
    required this.hora,
    required this.tipo,
    required this.texto,
  });
}

/// Lista canónica de eventos con dot de color por tipo + texto + hora tabular.
/// Equivalente del `EventsLog` web.
///
/// Se envuelve en una card blanca con header. Si se pasa `maxHeight`, la
/// lista interna hace scroll; en caso contrario crece con el contenido.
class SfitEventsList extends StatelessWidget {
  final List<SfitEvent> events;
  final String title;
  final double? maxHeight;

  const SfitEventsList({
    super.key,
    required this.events,
    this.title = 'Actividad del día',
    this.maxHeight,
  });

  static Color _colorFor(SfitEventType t) => switch (t) {
        SfitEventType.salida => AppColors.apto,
        SfitEventType.alerta => AppColors.noApto,
        SfitEventType.retorno => AppColors.gold,
        SfitEventType.info => AppColors.info,
        SfitEventType.sistema => AppColors.ink5,
      };

  @override
  Widget build(BuildContext context) {
    final list = ListView.separated(
      shrinkWrap: maxHeight == null,
      physics: maxHeight == null
          ? const NeverScrollableScrollPhysics()
          : const ClampingScrollPhysics(),
      padding: EdgeInsets.zero,
      itemCount: events.isEmpty ? 1 : events.length,
      separatorBuilder: (_, __) =>
          const Divider(height: 1, thickness: 1, color: AppColors.ink1),
      itemBuilder: (context, i) {
        if (events.isEmpty) return _emptyRow();
        return _row(events[i]);
      },
    );

    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        border: Border.all(color: AppColors.ink2, width: 1),
        borderRadius: BorderRadius.circular(12),
      ),
      clipBehavior: Clip.antiAlias,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          _header(events.length),
          if (maxHeight != null)
            ConstrainedBox(
              constraints: BoxConstraints(maxHeight: maxHeight!),
              child: list,
            )
          else
            list,
        ],
      ),
    );
  }

  Widget _header(int count) => Container(
        padding: const EdgeInsets.fromLTRB(14, 12, 14, 12),
        decoration: const BoxDecoration(
          border: Border(bottom: BorderSide(color: AppColors.ink1, width: 1)),
        ),
        child: Row(
          children: [
            const Icon(Icons.schedule_outlined, size: 14, color: AppColors.ink9),
            const SizedBox(width: 8),
            Expanded(
              child: Text(
                title,
                style: AppTheme.inter(
                  fontSize: 13,
                  fontWeight: FontWeight.w700,
                  color: AppColors.ink9,
                ),
              ),
            ),
            Text(
              '$count eventos',
              style: AppTheme.inter(
                fontSize: 10.5,
                fontWeight: FontWeight.w600,
                color: AppColors.ink5,
              ),
            ),
          ],
        ),
      );

  Widget _emptyRow() => Padding(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 24),
        child: Center(
          child: Text(
            'Sin eventos registrados',
            style: AppTheme.inter(
              fontSize: 12,
              color: AppColors.ink4,
            ),
          ),
        ),
      );

  Widget _row(SfitEvent e) {
    final color = _colorFor(e.tipo);
    return Padding(
      padding: const EdgeInsets.fromLTRB(14, 10, 14, 10),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            margin: const EdgeInsets.only(top: 5),
            width: 6,
            height: 6,
            decoration: BoxDecoration(color: color, shape: BoxShape.circle),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              e.texto,
              style: AppTheme.inter(
                fontSize: 12,
                color: AppColors.ink8,
                height: 1.45,
              ),
            ),
          ),
          const SizedBox(width: 10),
          Text(
            e.hora,
            style: AppTheme.inter(
              fontSize: 10.5,
              fontWeight: FontWeight.w600,
              color: AppColors.ink4,
              tabular: true,
            ),
          ),
        ],
      ),
    );
  }
}
