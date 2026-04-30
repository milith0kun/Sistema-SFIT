import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:latlong2/latlong.dart';
import '../../../../core/services/location_tracking_service.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_theme.dart';
import '../../data/datasources/trips_api_service.dart';

/// Mapa en tiempo real del turno activo del conductor (RF-conductor).
/// Muestra ruta planeada (azul), trazado real (oro) y paraderos numerados
/// que se colorean en verde a medida que el conductor pasa por ellos.
class TripMapPage extends ConsumerStatefulWidget {
  const TripMapPage({super.key});

  @override
  ConsumerState<TripMapPage> createState() => _TripMapPageState();
}

class _TripMapPageState extends ConsumerState<TripMapPage> {
  final _mapController = MapController();
  bool _followMode = true;
  bool _mapReady = false;
  String? _lastSnackedLabel;

  @override
  void initState() {
    super.initState();
    _resumeIfActive();
  }

  Future<void> _resumeIfActive() async {
    final tracking = ref.read(locationTrackingProvider);
    if (tracking.isTracking) return;
    try {
      final svc = ref.read(tripsApiServiceProvider);
      final entries = await svc.getMyFleetEntries();
      final active = entries.where((e) => e['status'] == 'en_ruta').toList();
      if (active.isNotEmpty && mounted) {
        final entry = active.first;
        final entryId = entry['id'] as String? ?? entry['_id'] as String? ?? '';
        final routeObj = entry['route'] as Map<String, dynamic>?;
        final routeId = routeObj?['_id'] as String? ?? routeObj?['id'] as String?;
        await ref.read(locationTrackingProvider.notifier).resumeTracking(
              entryId,
              routeId: routeId,
            );
      }
    } catch (_) {}
  }

  @override
  Widget build(BuildContext context) {
    final tracking = ref.watch(locationTrackingProvider);

    // Snackbar efímero cuando el backend reporta un paradero recién detectado.
    final lastLabel = tracking.lastVisitedLabel;
    if (lastLabel != null && lastLabel != _lastSnackedLabel) {
      _lastSnackedLabel = lastLabel;
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (!mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            duration: const Duration(seconds: 3),
            backgroundColor: AppColors.apto,
            content: Row(
              children: [
                const Icon(Icons.check_circle_rounded,
                    color: Colors.white, size: 18),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    'Pasaste por: $lastLabel',
                    style: AppTheme.inter(
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                      color: Colors.white,
                    ),
                  ),
                ),
              ],
            ),
          ),
        );
        ref.read(locationTrackingProvider.notifier).clearLastVisitedLabel();
      });
    }

    return SafeArea(
      child: tracking.isTracking ? _buildActiveMap(tracking) : _buildNoTrip(),
    );
  }

  Widget _buildActiveMap(TrackingState tracking) {
    final currentPos = tracking.currentPosition;

    if (currentPos != null && _followMode && _mapReady) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (!mounted || !_mapReady) return;
        try {
          _mapController.move(currentPos, _mapController.camera.zoom);
        } catch (_) {
          // Mapa aún no completamente inicializado.
        }
      });
    }

    final center = currentPos ?? const LatLng(-13.5319, -71.9675);
    final waypoints = tracking.routeWaypoints;
    final visited = tracking.visitedStopIndices;

    return Stack(
      children: [
        FlutterMap(
          mapController: _mapController,
          options: MapOptions(
            initialCenter: center,
            initialZoom: 15,
            onMapReady: () {
              if (mounted) setState(() => _mapReady = true);
            },
            onMapEvent: (event) {
              if (event is MapEventMoveStart &&
                  event.source == MapEventSource.onDrag) {
                if (_followMode) setState(() => _followMode = false);
              }
            },
          ),
          children: [
            TileLayer(
              urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
              userAgentPackageName: 'com.sfit.sfit_app',
            ),
            // Ruta planeada (línea azul punteada que une los paraderos)
            if (waypoints.length >= 2)
              PolylineLayer(
                polylines: [
                  Polyline(
                    points: waypoints.map((w) => w.latLng).toList(),
                    color: const Color(0x993B82F6),
                    strokeWidth: 3.5,
                  ),
                ],
              ),
            // Track GPS real del conductor
            if (tracking.localTrack.length >= 2)
              PolylineLayer(
                polylines: [
                  Polyline(
                    points: tracking.localTrack,
                    color: AppColors.gold,
                    strokeWidth: 4.5,
                  ),
                ],
              ),
            // Paraderos numerados (visited = verde, próximo = oro, resto = gris)
            if (waypoints.isNotEmpty)
              MarkerLayer(
                markers: _buildStopMarkers(waypoints, visited),
              ),
            if (currentPos != null)
              MarkerLayer(
                markers: [
                  Marker(
                    point: currentPos,
                    width: 44,
                    height: 44,
                    child: Container(
                      decoration: BoxDecoration(
                        color: AppColors.gold,
                        shape: BoxShape.circle,
                        border: Border.all(color: Colors.white, width: 2.5),
                        boxShadow: [
                          BoxShadow(
                            color: AppColors.gold.withValues(alpha: 0.4),
                            blurRadius: 8,
                            spreadRadius: 2,
                          ),
                        ],
                      ),
                      child: const Icon(
                        Icons.navigation_rounded,
                        color: Colors.white,
                        size: 22,
                      ),
                    ),
                  ),
                ],
              ),
          ],
        ),

        _Header(tracking: tracking),

        if (!_followMode && currentPos != null)
          Positioned(
            bottom: 90,
            right: 12,
            child: FloatingActionButton.small(
              onPressed: () {
                if (!_mapReady) return;
                setState(() => _followMode = true);
                try {
                  _mapController.move(currentPos, 15);
                } catch (_) {}
              },
              backgroundColor: AppColors.gold,
              child: const Icon(Icons.my_location,
                  color: Colors.white, size: 20),
            ),
          ),

        // Indicador de baja precisión (si descartó muchos puntos)
        if (tracking.discardedLowAccuracy > 0 && tracking.currentAccuracy != null)
          Positioned(
            bottom: 76,
            left: 16,
            right: 16,
            child: _AccuracyBadge(
              accuracy: tracking.currentAccuracy!,
              discarded: tracking.discardedLowAccuracy,
            ),
          ),

        Positioned(
          bottom: 16,
          left: 16,
          right: 16,
          child: FilledButton.icon(
            onPressed: () {
              final entryId = tracking.entryId ?? '';
              context.push(
                '/viaje-checkout/$entryId',
                extra: {
                  'vehiclePlate': '—',
                  'departureTime': '',
                  'estimatedKm': null,
                },
              );
            },
            icon: const Icon(Icons.stop_circle_outlined, size: 18),
            label: Text(
              'Cerrar turno',
              style: AppTheme.inter(
                fontSize: 14,
                fontWeight: FontWeight.w700,
                color: Colors.white,
              ),
            ),
            style: FilledButton.styleFrom(
              backgroundColor: AppColors.noApto,
              minimumSize: const Size(double.infinity, 48),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(10),
              ),
            ),
          ),
        ),
      ],
    );
  }

  List<Marker> _buildStopMarkers(
    List<RouteWaypoint> waypoints,
    Set<int> visitedIndices,
  ) {
    // Determinar el "próximo paradero" como el primero pendiente en orden.
    final ordered = [...waypoints]..sort((a, b) => a.order.compareTo(b.order));
    int? nextIdx;
    for (final wp in ordered) {
      if (!visitedIndices.contains(wp.order)) {
        nextIdx = wp.order;
        break;
      }
    }

    return waypoints.map((wp) {
      final isVisited = visitedIndices.contains(wp.order);
      final isNext = nextIdx != null && wp.order == nextIdx;

      final (bg, fg, ring) = isVisited
          ? (AppColors.apto, Colors.white, AppColors.aptoBorder)
          : isNext
              ? (AppColors.gold, Colors.white, AppColors.goldBorder)
              : (Colors.white, AppColors.ink7, AppColors.ink3);

      return Marker(
        point: wp.latLng,
        width: 56,
        height: 56,
        alignment: Alignment.topCenter,
        child: _StopMarker(
          number: wp.order + 1,
          label: wp.label,
          bg: bg,
          fg: fg,
          ring: ring,
          showCheck: isVisited,
        ),
      );
    }).toList();
  }

  Widget _buildNoTrip() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 72,
              height: 72,
              decoration: BoxDecoration(
                color: AppColors.goldBg,
                shape: BoxShape.circle,
                border: Border.all(color: AppColors.goldBorder, width: 1.5),
              ),
              child: const Icon(
                Icons.map_outlined,
                size: 34,
                color: AppColors.goldDark,
              ),
            ),
            const SizedBox(height: 16),
            Text(
              'Sin turno activo',
              style: AppTheme.inter(
                fontSize: 16,
                fontWeight: FontWeight.w700,
                color: AppColors.ink9,
              ),
            ),
            const SizedBox(height: 6),
            Text(
              'Inicia un turno para ver tu recorrido en el mapa en tiempo real.',
              textAlign: TextAlign.center,
              style: AppTheme.inter(fontSize: 13, color: AppColors.ink5),
            ),
            const SizedBox(height: 20),
            FilledButton.icon(
              onPressed: () => context.push('/viaje-checkin'),
              icon: const Icon(Icons.play_circle_outline, size: 18),
              label: Text(
                'Iniciar turno',
                style: AppTheme.inter(
                  fontSize: 14,
                  fontWeight: FontWeight.w700,
                  color: Colors.white,
                ),
              ),
              style: FilledButton.styleFrom(
                backgroundColor: AppColors.gold,
                minimumSize: const Size(200, 46),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(10),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _StopMarker extends StatelessWidget {
  final int number;
  final String? label;
  final Color bg;
  final Color fg;
  final Color ring;
  final bool showCheck;

  const _StopMarker({
    required this.number,
    required this.bg,
    required this.fg,
    required this.ring,
    required this.showCheck,
    this.label,
  });

  @override
  Widget build(BuildContext context) {
    return Tooltip(
      message: label ?? 'Paradero $number',
      preferBelow: false,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Stack(
            clipBehavior: Clip.none,
            children: [
              Container(
                width: 28,
                height: 28,
                decoration: BoxDecoration(
                  color: bg,
                  shape: BoxShape.circle,
                  border: Border.all(color: ring, width: 2),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withValues(alpha: 0.2),
                      blurRadius: 4,
                      offset: const Offset(0, 1),
                    ),
                  ],
                ),
                alignment: Alignment.center,
                child: Text(
                  '$number',
                  style: AppTheme.inter(
                    fontSize: 11.5,
                    fontWeight: FontWeight.w800,
                    color: fg,
                  ),
                ),
              ),
              if (showCheck)
                Positioned(
                  right: -4,
                  bottom: -4,
                  child: Container(
                    width: 14,
                    height: 14,
                    decoration: BoxDecoration(
                      color: Colors.white,
                      shape: BoxShape.circle,
                      border: Border.all(color: AppColors.apto, width: 1.5),
                    ),
                    alignment: Alignment.center,
                    child: const Icon(Icons.check,
                        size: 9, color: AppColors.apto),
                  ),
                ),
            ],
          ),
        ],
      ),
    );
  }
}

class _Header extends StatelessWidget {
  final TrackingState tracking;
  const _Header({required this.tracking});

  @override
  Widget build(BuildContext context) {
    final total = tracking.routeWaypoints.length;
    final visited = tracking.visitedStopIndices.length;

    return Positioned(
      top: 8,
      left: 8,
      right: 8,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
        decoration: BoxDecoration(
          color: AppColors.panel,
          borderRadius: BorderRadius.circular(12),
        ),
        child: Row(
          children: [
            Container(
              width: 8,
              height: 8,
              decoration: const BoxDecoration(
                color: AppColors.apto,
                shape: BoxShape.circle,
              ),
            ),
            const SizedBox(width: 8),
            Text(
              'TURNO ACTIVO',
              style: AppTheme.inter(
                fontSize: 11,
                fontWeight: FontWeight.w700,
                color: AppColors.goldLight,
                letterSpacing: 1.4,
              ),
            ),
            const Spacer(),
            if (total > 0) ...[
              const Icon(Icons.location_on_rounded,
                  size: 13, color: Colors.white70),
              const SizedBox(width: 3),
              Text(
                '$visited / $total',
                style: AppTheme.inter(
                  fontSize: 11.5,
                  fontWeight: FontWeight.w700,
                  color: Colors.white,
                  tabular: true,
                ),
              ),
              const SizedBox(width: 8),
            ],
            Container(
              width: 10,
              height: 3,
              decoration: BoxDecoration(
                color: AppColors.gold,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
            const SizedBox(width: 4),
            Text(
              '${tracking.localTrack.length} pts',
              style: AppTheme.inter(
                fontSize: 10,
                color: Colors.white60,
                tabular: true,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _AccuracyBadge extends StatelessWidget {
  final double accuracy;
  final int discarded;
  const _AccuracyBadge({required this.accuracy, required this.discarded});

  @override
  Widget build(BuildContext context) {
    final low = accuracy > 50;
    if (!low && discarded == 0) return const SizedBox.shrink();
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: AppColors.riesgoBg,
        border: Border.all(color: AppColors.riesgoBorder),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(Icons.gps_not_fixed_rounded,
              size: 14, color: AppColors.riesgo),
          const SizedBox(width: 6),
          Flexible(
            child: Text(
              'Señal GPS débil (±${accuracy.toStringAsFixed(0)} m) — $discarded puntos descartados',
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: AppTheme.inter(
                fontSize: 11,
                fontWeight: FontWeight.w600,
                color: AppColors.riesgo,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
