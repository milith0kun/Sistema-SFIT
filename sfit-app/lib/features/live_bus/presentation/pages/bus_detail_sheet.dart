import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_theme.dart';
import 'live_bus_data.dart';

/// BottomSheet con el detalle de un bus en vivo: ruta completa + lista
/// de paraderos con ETA progresivo. Se abre al tocar un bus en el mapa
/// o en la lista de la pantalla "Buses en vivo".
class BusDetailSheet extends StatelessWidget {
  final BusData bus;
  final ScrollController? scrollController;
  const BusDetailSheet({super.key, required this.bus, this.scrollController});

  static Future<void> show(BuildContext context, BusData bus) {
    return showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => DraggableScrollableSheet(
        initialChildSize: 0.7,
        minChildSize: 0.4,
        maxChildSize: 0.95,
        expand: false,
        builder: (_, scrollController) => BusDetailSheet(
          bus: bus,
          scrollController: scrollController,
        ),
      ),
    );
  }

  Color _statusColor(String s) => switch (s) {
        'apto' => AppColors.apto,
        'riesgo' => AppColors.riesgo,
        _ => AppColors.noApto,
      };

  String _formatEta(int s) {
    if (s < 60) return '< 1 min';
    final m = (s / 60).round();
    if (m < 60) return '~$m min';
    final h = m ~/ 60;
    final rem = m % 60;
    return rem == 0 ? '~${h}h' : '~${h}h ${rem}m';
  }

  String _formatDistance(int m) {
    if (m < 1000) return '$m m';
    return '${(m / 1000).toStringAsFixed(1)} km';
  }

  @override
  Widget build(BuildContext context) {
    final color = _statusColor(bus.vehicleStatus);
    final waypointsLatLng = bus.waypoints
        .map((w) => LatLng(w.lat, w.lng))
        .toList();

    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
        border: Border.all(color: AppColors.ink2),
      ),
      child: ListView(
        controller: scrollController,
        padding: EdgeInsets.zero,
        children: [
          // Drag handle
          Center(
            child: Container(
              margin: const EdgeInsets.only(top: 8, bottom: 8),
              width: 40, height: 4,
              decoration: BoxDecoration(
                color: AppColors.ink2,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
          ),
          // Header
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 4, 16, 12),
            child: Row(
              children: [
                Container(
                  width: 40, height: 40,
                  decoration: BoxDecoration(
                    color: color.withValues(alpha: 0.12),
                    shape: BoxShape.circle,
                    border: Border.all(color: color.withValues(alpha: 0.3)),
                  ),
                  child: Icon(Icons.directions_bus_rounded, color: color, size: 22),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        bus.plate,
                        style: AppTheme.inter(fontSize: 18, fontWeight: FontWeight.w800, color: AppColors.ink9, tabular: true),
                      ),
                      if (bus.routeName != null)
                        Text(
                          bus.routeName!,
                          style: AppTheme.inter(fontSize: 13, color: AppColors.ink6),
                        ),
                    ],
                  ),
                ),
                IconButton(
                  onPressed: () => Navigator.of(context).pop(),
                  icon: const Icon(Icons.close, size: 20),
                  color: AppColors.ink5,
                ),
              ],
            ),
          ),
          // Distancia al usuario
          if (bus.distanceFromUserMeters != null)
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                decoration: BoxDecoration(
                  color: AppColors.goldBg,
                  border: Border.all(color: AppColors.goldBorder),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Row(children: [
                  const Icon(Icons.my_location, size: 14, color: AppColors.goldDark),
                  const SizedBox(width: 8),
                  Text(
                    'A ${_formatDistance(bus.distanceFromUserMeters!)} de tu ubicación',
                    style: AppTheme.inter(fontSize: 12, fontWeight: FontWeight.w600, color: AppColors.goldDark),
                  ),
                ]),
              ),
            ),
          const SizedBox(height: 12),
          // Mini mapa
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: ClipRRect(
              borderRadius: BorderRadius.circular(12),
              child: SizedBox(
                height: 180,
                child: FlutterMap(
                  options: MapOptions(
                    initialCenter: LatLng(bus.lat, bus.lng),
                    initialZoom: 14,
                    interactionOptions: const InteractionOptions(flags: InteractiveFlag.none),
                  ),
                  children: [
                    TileLayer(
                      urlTemplate:
                          'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png',
                      subdomains: const ['a', 'b', 'c', 'd'],
                      userAgentPackageName: 'com.sfit.sfit_app',
                    ),
                    if (waypointsLatLng.length >= 2)
                      PolylineLayer(polylines: [
                        Polyline(
                          points: waypointsLatLng,
                          color: AppColors.ink3,
                          strokeWidth: 3,
                        ),
                      ]),
                    MarkerLayer(markers: [
                      // Bus actual
                      Marker(
                        point: LatLng(bus.lat, bus.lng),
                        width: 36, height: 36,
                        child: Container(
                          decoration: BoxDecoration(
                            color: color, shape: BoxShape.circle,
                            border: Border.all(color: Colors.white, width: 2),
                            boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.2), blurRadius: 4)],
                          ),
                          child: const Icon(Icons.directions_bus_rounded, color: Colors.white, size: 18),
                        ),
                      ),
                    ]),
                  ],
                ),
              ),
            ),
          ),
          const SizedBox(height: 16),
          // Lista de paraderos con ETA
          if (bus.etaByStop.isNotEmpty) ...[
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
              child: Text(
                'PARADEROS',
                style: AppTheme.inter(fontSize: 11, fontWeight: FontWeight.w700, color: AppColors.ink5, letterSpacing: 1.2),
              ),
            ),
            ...bus.etaByStop.asMap().entries.map((entry) {
              final i = entry.key;
              final s = entry.value;
              final isFirst = i == 0;
              return Container(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                decoration: const BoxDecoration(
                  border: Border(top: BorderSide(color: AppColors.ink1)),
                ),
                child: Row(children: [
                  // Marcador con número
                  Container(
                    width: 28, height: 28,
                    decoration: BoxDecoration(
                      color: isFirst ? AppColors.gold : Colors.white,
                      shape: BoxShape.circle,
                      border: Border.all(color: isFirst ? AppColors.gold : AppColors.ink3, width: 2),
                    ),
                    alignment: Alignment.center,
                    child: Text(
                      '${s.stopIndex + 1}',
                      style: AppTheme.inter(
                        fontSize: 11,
                        fontWeight: FontWeight.w800,
                        color: isFirst ? Colors.white : AppColors.ink6,
                        tabular: true,
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          s.label,
                          style: AppTheme.inter(
                            fontSize: 14,
                            fontWeight: isFirst ? FontWeight.w700 : FontWeight.w500,
                            color: AppColors.ink9,
                          ),
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                        ),
                        const SizedBox(height: 2),
                        Text(
                          'a ${_formatDistance(s.distanceFromBusMeters)} del bus',
                          style: AppTheme.inter(fontSize: 11, color: AppColors.ink5),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: 8),
                  // ETA
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                    decoration: BoxDecoration(
                      color: isFirst ? AppColors.goldBg : AppColors.ink1,
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(color: isFirst ? AppColors.goldBorder : AppColors.ink2),
                    ),
                    child: Text(
                      _formatEta(s.etaSeconds),
                      style: AppTheme.inter(
                        fontSize: 12,
                        fontWeight: FontWeight.w700,
                        color: isFirst ? AppColors.goldDark : AppColors.ink7,
                      ),
                    ),
                  ),
                ]),
              );
            }),
          ] else
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
              child: Text(
                'Sin paraderos pendientes en esta ruta.',
                style: AppTheme.inter(fontSize: 13, color: AppColors.ink5),
              ),
            ),
          const SizedBox(height: 16),
        ],
      ),
    );
  }
}
