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
/// Se activa cuando el tracking está corriendo; si no hay turno activo
/// muestra el estado de "sin turno" con acceso a iniciar uno.
class TripMapPage extends ConsumerStatefulWidget {
  const TripMapPage({super.key});

  @override
  ConsumerState<TripMapPage> createState() => _TripMapPageState();
}

class _TripMapPageState extends ConsumerState<TripMapPage> {
  final _mapController = MapController();
  bool _followMode = true;

  @override
  void initState() {
    super.initState();
    _resumeIfActive();
  }

  /// Si hay un turno en_ruta al abrir el tab, reanuda el tracking.
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
        // Extraer routeId del objeto route poblado (si existe)
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

    return SafeArea(
      child: tracking.isTracking
          ? _buildActiveMap(tracking)
          : _buildNoTrip(),
    );
  }

  Widget _buildActiveMap(TrackingState tracking) {
    final currentPos = tracking.currentPosition;
    // Si tenemos posición y followMode activo, centramos el mapa
    if (currentPos != null && _followMode && _mapController.camera.zoom > 0) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) _mapController.move(currentPos, _mapController.camera.zoom);
      });
    }

    // Centro inicial: posición actual o Cusco como fallback
    final center = currentPos ?? const LatLng(-13.5319, -71.9675);

    return Stack(
      children: [
        FlutterMap(
          mapController: _mapController,
          options: MapOptions(
            initialCenter: center,
            initialZoom: 15,
            onMapEvent: (event) {
              // Desactiva follow si el usuario mueve el mapa manualmente
              if (event is MapEventMoveStart && event.source == MapEventSource.onDrag) {
                if (_followMode) setState(() => _followMode = false);
              }
            },
          ),
          children: [
            TileLayer(
              urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
              userAgentPackageName: 'com.sfit.sfit_app',
            ),
            // Ruta predefinida (trazado oficial de la línea)
            if (tracking.routeWaypoints.length >= 2)
              PolylineLayer(
                polylines: [
                  Polyline(
                    points: tracking.routeWaypoints,
                    color: const Color(0x993B82F6), // blue-500 semitransparente
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

        // ── Header superior ──────────────────────────────────────────
        Positioned(
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
                if (tracking.routeWaypoints.isNotEmpty) ...[
                  Container(
                    width: 10,
                    height: 3,
                    decoration: BoxDecoration(
                      color: const Color(0xFF3B82F6),
                      borderRadius: BorderRadius.circular(2),
                    ),
                  ),
                  const SizedBox(width: 4),
                  Text(
                    'Ruta',
                    style: AppTheme.inter(fontSize: 10, color: Colors.white60),
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
                  style: AppTheme.inter(fontSize: 10, color: Colors.white60),
                ),
              ],
            ),
          ),
        ),

        // ── Botón re-centrar ─────────────────────────────────────────
        if (!_followMode && currentPos != null)
          Positioned(
            bottom: 90,
            right: 12,
            child: FloatingActionButton.small(
              onPressed: () {
                setState(() => _followMode = true);
                _mapController.move(currentPos, 15);
              },
              backgroundColor: AppColors.gold,
              child: const Icon(Icons.my_location, color: Colors.white, size: 20),
            ),
          ),

        // ── Botón cerrar turno ───────────────────────────────────────
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
