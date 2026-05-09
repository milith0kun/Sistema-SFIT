import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:latlong2/latlong.dart';
import '../../../../core/services/location_tracking_service.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/widgets/connectivity_banner.dart';
import '../../data/datasources/trips_api_service.dart';

/// Calculadora de distancia haversine de `latlong2`. La usamos para estimar
/// ETA al próximo paradero cuando el backend no provee uno.
const Distance _haversine = Distance();

/// Mapa en tiempo real del turno activo del conductor (RF-conductor).
/// Muestra ruta planeada (azul), trazado real (oro) y paraderos numerados
/// que se colorean en verde a medida que el conductor pasa por ellos.
class TripMapPage extends ConsumerStatefulWidget {
  const TripMapPage({super.key});

  @override
  ConsumerState<TripMapPage> createState() => _TripMapPageState();
}

class _TripMapPageState extends ConsumerState<TripMapPage>
    with SingleTickerProviderStateMixin {
  final _mapController = MapController();
  bool _followMode = true;
  bool _mapReady = false;

  // ── Animación del bus entre pings ───────────────────────────────────────
  /// Controlador que interpola la posición visible del bus entre el último
  /// ping renderizado (`_animFrom`) y el más reciente recibido (`_animTo`).
  late final AnimationController _busAnim;
  LatLng? _animFrom;
  LatLng? _animTo;

  // ── Estimación local de velocidad ───────────────────────────────────────
  /// `TrackingState` no expone timestamps por punto: lo aproximamos
  /// guardando el reloj de pared cada vez que `currentPosition` cambia.
  /// Lista circular acotada a 5 muestras para velocidad media reciente
  /// (necesaria para ETA al próximo paradero).
  final List<_PingSample> _recentPings = <_PingSample>[];
  static const int _maxPings = 5;
  LatLng? _lastSeenPos;

  @override
  void initState() {
    super.initState();
    _busAnim = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 800),
    );
    _resumeIfActive();
  }

  @override
  void dispose() {
    _busAnim.dispose();
    super.dispose();
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
        final routeId =
            routeObj?['_id'] as String? ?? routeObj?['id'] as String?;
        await ref
            .read(locationTrackingProvider.notifier)
            .resumeTracking(entryId, routeId: routeId);
      }
    } catch (_) {}
  }

  @override
  Widget build(BuildContext context) {
    final tracking = ref.watch(locationTrackingProvider);

    return SafeArea(
      child: Column(
        children: [
          // Banner offline global: si pierde red, indica que el mapa puede
          // estar desactualizado y los pings se están encolando localmente.
          const ConnectivityBanner(),
          Expanded(
            child:
                tracking.isTracking ? _buildActiveMap(tracking) : _buildNoTrip(),
          ),
        ],
      ),
    );
  }

  Widget _buildActiveMap(TrackingState tracking) {
    final currentPos = tracking.currentPosition;

    // Detecta cambios de posición para animar el marcador y muestrear velocidad.
    if (currentPos != null && currentPos != _lastSeenPos) {
      _onNewPing(currentPos);
    }

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
    final speedMs = _averageRecentSpeedMs();

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
            // Trazo histórico GPS (todo el turno desde el inicio). Color
            // tenue para mantener legibilidad sin opacar la ruta planificada.
            // NO se trunca: la línea inicio→fin permanece visible siempre.
            if (tracking.localTrack.length >= 2)
              PolylineLayer(
                polylines: [
                  Polyline(
                    points: tracking.localTrack,
                    color: (tracking.isOffRoute
                            ? AppColors.noApto
                            : AppColors.gold)
                        .withValues(alpha: 0.45),
                    strokeWidth: 3.0,
                  ),
                ],
              ),
            // Tramo reciente (últimos N puntos): mismo color pero más
            // grueso y con alpha pleno, encima del histórico, para que
            // el conductor distinga el progreso vivo.
            if (tracking.recentTrack.length >= 2)
              PolylineLayer(
                polylines: [
                  Polyline(
                    points: tracking.recentTrack,
                    color:
                        tracking.isOffRoute ? AppColors.noApto : AppColors.gold,
                    strokeWidth: 5.0,
                  ),
                ],
              ),
            // Paraderos numerados (visited = verde, próximo = oro, resto = gris)
            if (waypoints.isNotEmpty)
              MarkerLayer(markers: _buildStopMarkers(waypoints, visited)),
            if (currentPos != null)
              // Capa que se redibuja a 60fps con la posición interpolada.
              AnimatedBuilder(
                animation: _busAnim,
                builder: (context, _) {
                  final animated = _interpolatedPos(currentPos);
                  return MarkerLayer(
                    markers: [
                      Marker(
                        point: animated,
                        width: 44,
                        height: 44,
                        child: Container(
                          decoration: BoxDecoration(
                            color: tracking.isOffRoute
                                ? AppColors.noApto
                                : AppColors.gold,
                            shape: BoxShape.circle,
                            border: Border.all(
                              color: Colors.white,
                              width: 2.5,
                            ),
                            boxShadow: [
                              BoxShadow(
                                color: (tracking.isOffRoute
                                        ? AppColors.noApto
                                        : AppColors.gold)
                                    .withValues(alpha: 0.4),
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
                  );
                },
              ),
          ],
        ),

        _Header(tracking: tracking, speedMs: speedMs),

        if (tracking.isOffRoute)
          const Positioned(
            top: 60,
            left: 8,
            right: 8,
            child: _OffRouteBanner(),
          ),

        Positioned(
          top: tracking.isOffRoute ? 120 : 60,
          left: 8,
          right: 8,
          child: _NextStopCard(tracking: tracking, speedMs: speedMs),
        ),

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
              child: const Icon(
                Icons.my_location,
                color: Colors.white,
                size: 20,
              ),
            ),
          ),

        // Indicador de baja precisión (si descartó muchos puntos)
        if (tracking.discardedLowAccuracy > 0 &&
            tracking.currentAccuracy != null)
          Positioned(
            bottom: 76,
            left: 16,
            right: 16,
            child: _AccuracyBadge(
              accuracy: tracking.currentAccuracy!,
              discarded: tracking.discardedLowAccuracy,
            ),
          ),

        // Panel de diagnóstico GPS — visible siempre que haya turno activo.
        // Le confirma al conductor que el tracking está vivo y ofrece un
        // botón para forzar la subida si ve que la cola no baja.
        Positioned(
          top: 60 + (tracking.isOffRoute ? 60 : 0) + 80,
          left: 12,
          child: _GpsDiagnosticChip(tracking: tracking),
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

      final (bg, fg, ring) =
          isVisited
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

  // ── Animación + muestreo de velocidad ──────────────────────────────────

  /// Llamado cuando `tracking.currentPosition` cambia respecto a lo último
  /// mostrado: arranca un nuevo tween de animación y guarda muestra para
  /// estimar velocidad media reciente.
  void _onNewPing(LatLng newPos) {
    final now = DateTime.now();
    final prev = _lastSeenPos;
    final prevAt = _recentPings.isNotEmpty ? _recentPings.last.at : null;
    final deltaMs = prevAt == null ? 0 : now.difference(prevAt).inMilliseconds;

    // Empuja muestra para velocidad media (con timestamp del reloj de pared).
    if (prev != null) {
      final dist = _haversine.as(LengthUnit.Meter, prev, newPos);
      _recentPings.add(_PingSample(at: now, meters: dist, ms: deltaMs));
      if (_recentPings.length > _maxPings) {
        _recentPings.removeAt(0);
      }
    } else {
      _recentPings.add(_PingSample(at: now, meters: 0, ms: 0));
    }

    // Tween: desde donde se está mostrando ahora (interpolado o último origen)
    // hasta la nueva posición. Si el delta es chico saltamos directo.
    final from = _interpolatedPos(prev ?? newPos);

    if (prev == null || deltaMs < 500) {
      _animFrom = newPos;
      _animTo = newPos;
      _busAnim.value = 1.0;
    } else {
      _animFrom = from;
      _animTo = newPos;
      _busAnim.duration = Duration(milliseconds: deltaMs.clamp(500, 2000));
      _busAnim
        ..reset()
        ..forward();
    }

    _lastSeenPos = newPos;
  }

  /// Interpola entre `_animFrom` y `_animTo` según `_busAnim.value`. Si la
  /// animación no está armada todavía, devuelve la posición pasada como
  /// fallback (la última conocida).
  LatLng _interpolatedPos(LatLng fallback) {
    final from = _animFrom;
    final to = _animTo;
    if (from == null || to == null) return fallback;
    final t = _busAnim.value;
    return LatLng(
      from.latitude + (to.latitude - from.latitude) * t,
      from.longitude + (to.longitude - from.longitude) * t,
    );
  }

  /// Velocidad media reciente en m/s a partir de las últimas muestras
  /// (excluyendo la primera, que tiene `ms == 0`). Devuelve `null` si no
  /// hay suficientes datos para una estimación útil.
  double? _averageRecentSpeedMs() {
    if (_recentPings.length < 2) return null;
    var totalM = 0.0;
    var totalMs = 0;
    for (var i = 1; i < _recentPings.length; i++) {
      totalM += _recentPings[i].meters;
      totalMs += _recentPings[i].ms;
    }
    if (totalMs <= 0) return null;
    return totalM / (totalMs / 1000.0);
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
                    child: const Icon(
                      Icons.check,
                      size: 9,
                      color: AppColors.apto,
                    ),
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

  /// Velocidad estimada localmente en m/s (a partir de las últimas muestras
  /// de `currentPosition`). `null` si todavía no hay suficientes datos.
  final double? speedMs;

  const _Header({required this.tracking, this.speedMs});

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
            if (speedMs != null) ...[
              _SpeedPill(speedMs: speedMs!),
              const SizedBox(width: 8),
            ],
            if (total > 0) ...[
              const Icon(
                Icons.location_on_rounded,
                size: 13,
                color: Colors.white70,
              ),
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
            // Pendientes en cola: visible solo cuando hay puntos sin sincronizar
            // (típicamente offline o backend con lag).
            if (tracking.queuedPoints > 0) ...[
              const SizedBox(width: 8),
              _QueueBadge(count: tracking.queuedPoints),
            ],
          ],
        ),
      ),
    );
  }
}

/// Badge compacto que muestra la cantidad de pings GPS pendientes de subir.
/// Aparece solo cuando `queuedPoints > 0` (offline o backend lento).
class _QueueBadge extends StatelessWidget {
  final int count;
  const _QueueBadge({required this.count});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
      decoration: BoxDecoration(
        color: AppColors.riesgoBg,
        border: Border.all(color: AppColors.riesgoBorder),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(
            Icons.cloud_upload_outlined,
            size: 11,
            color: AppColors.riesgo,
          ),
          const SizedBox(width: 3),
          Text(
            '$count',
            style: AppTheme.inter(
              fontSize: 10,
              fontWeight: FontWeight.w700,
              color: AppColors.riesgo,
              tabular: true,
            ),
          ),
        ],
      ),
    );
  }
}

/// Pill compacta con la velocidad actual del bus. Muestra "Detenido"
/// cuando estamos por debajo de 0.5 m/s (≈ 1.8 km/h, ruido GPS).
class _SpeedPill extends StatelessWidget {
  final double speedMs;
  const _SpeedPill({required this.speedMs});

  @override
  Widget build(BuildContext context) {
    final stopped = speedMs < 0.5;
    final kmh = (speedMs * 3.6).round();
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: stopped
            ? Colors.white.withValues(alpha: 0.08)
            : AppColors.gold.withValues(alpha: 0.18),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(
          color: stopped
              ? Colors.white.withValues(alpha: 0.18)
              : AppColors.gold.withValues(alpha: 0.55),
          width: 0.8,
        ),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            stopped ? Icons.pause_circle_filled_rounded : Icons.speed_rounded,
            size: 12,
            color: stopped ? Colors.white70 : AppColors.goldLight,
          ),
          const SizedBox(width: 4),
          Text(
            stopped ? 'Detenido' : '$kmh km/h',
            style: AppTheme.inter(
              fontSize: 11,
              fontWeight: FontWeight.w700,
              color: stopped ? Colors.white70 : AppColors.goldLight,
              tabular: true,
            ),
          ),
        ],
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
          const Icon(
            Icons.gps_not_fixed_rounded,
            size: 14,
            color: AppColors.riesgo,
          ),
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

class _OffRouteBanner extends StatelessWidget {
  const _OffRouteBanner();

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: BoxDecoration(
        color: AppColors.noApto.withValues(alpha: 0.95),
        borderRadius: BorderRadius.circular(12),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.2),
            blurRadius: 8,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Row(
        children: [
          const Icon(
            Icons.warning_amber_rounded,
            color: Colors.white,
            size: 24,
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  'Desvío de ruta detectado',
                  style: AppTheme.inter(
                    fontSize: 14,
                    fontWeight: FontWeight.bold,
                    color: Colors.white,
                  ),
                ),
                Text(
                  'Por favor, reincorpórese a la ruta asignada.',
                  style: AppTheme.inter(
                    fontSize: 12,
                    color: Colors.white.withValues(alpha: 0.9),
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

class _NextStopCard extends StatelessWidget {
  final TrackingState tracking;

  /// Velocidad media reciente en m/s (computada en la página). `null` si
  /// no hay suficientes datos para estimar ETA → omitimos la línea.
  final double? speedMs;

  const _NextStopCard({required this.tracking, this.speedMs});

  @override
  Widget build(BuildContext context) {
    final waypoints = tracking.routeWaypoints;
    final visited = tracking.visitedStopIndices;
    final ordered = [...waypoints]..sort((a, b) => a.order.compareTo(b.order));

    RouteWaypoint? nextStop;
    for (final wp in ordered) {
      if (!visited.contains(wp.order)) {
        nextStop = wp;
        break;
      }
    }

    if (nextStop == null) return const SizedBox.shrink();

    // ── Distancia + ETA al próximo paradero ─────────────────────────────
    // ETA naïve: distancia haversine / velocidad media reciente. Sólo
    // mostrado cuando tenemos posición actual y velocidad > 0.5 m/s.
    String? distanceText;
    String? etaText;
    final pos = tracking.currentPosition;
    if (pos != null) {
      final meters = _haversine.as(LengthUnit.Meter, pos, nextStop.latLng);
      distanceText = meters >= 1000
          ? '${(meters / 1000).toStringAsFixed(1)} km'
          : '${meters.round()} m';
      if (speedMs != null && speedMs! > 0.5) {
        final secs = (meters / speedMs!).round();
        final mins = (secs / 60).ceil().clamp(1, 999);
        etaText = '~$mins min';
      }
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: BoxDecoration(
        color: AppColors.panel,
        borderRadius: BorderRadius.circular(12),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.1),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Row(
        children: [
          Container(
            width: 32,
            height: 32,
            decoration: BoxDecoration(
              color: AppColors.goldBg,
              shape: BoxShape.circle,
              border: Border.all(color: AppColors.goldBorder),
            ),
            alignment: Alignment.center,
            child: Text(
              '${nextStop.order + 1}',
              style: AppTheme.inter(
                fontSize: 14,
                fontWeight: FontWeight.bold,
                color: AppColors.goldDark,
              ),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  'PRÓXIMO PARADERO',
                  style: AppTheme.inter(
                    fontSize: 10,
                    fontWeight: FontWeight.w700,
                    color: AppColors.goldLight,
                    letterSpacing: 1.0,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  nextStop.label ?? 'Desconocido',
                  style: AppTheme.inter(
                    fontSize: 14,
                    fontWeight: FontWeight.bold,
                    color: Colors.white,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                if (distanceText != null || etaText != null) ...[
                  const SizedBox(height: 4),
                  Row(
                    children: [
                      if (distanceText != null) ...[
                        const Icon(
                          Icons.straighten_rounded,
                          size: 12,
                          color: Colors.white60,
                        ),
                        const SizedBox(width: 3),
                        Text(
                          distanceText,
                          style: AppTheme.inter(
                            fontSize: 11,
                            fontWeight: FontWeight.w600,
                            color: Colors.white70,
                            tabular: true,
                          ),
                        ),
                      ],
                      if (etaText != null) ...[
                        if (distanceText != null)
                          const SizedBox(width: 10),
                        const Icon(
                          Icons.access_time_rounded,
                          size: 12,
                          color: Colors.white60,
                        ),
                        const SizedBox(width: 3),
                        Text(
                          etaText,
                          style: AppTheme.inter(
                            fontSize: 11,
                            fontWeight: FontWeight.w600,
                            color: Colors.white70,
                            tabular: true,
                          ),
                        ),
                      ],
                    ],
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// Muestra de un ping GPS con su distancia respecto al ping anterior y
/// el `delta` de tiempo (ms). Usada para promediar velocidad reciente sin
/// depender de timestamps por punto en `TrackingState`.
class _PingSample {
  final DateTime at;
  final double meters;
  final int ms;

  const _PingSample({required this.at, required this.meters, required this.ms});
}

/// Pildora compacta arriba a la izquierda del mapa con el estado del GPS.
/// Sirve de feedback al conductor de que el tracking está vivo: muestra
/// puntos capturados y pendientes de subir. Tap → fuerza el drain.
class _GpsDiagnosticChip extends ConsumerWidget {
  final TrackingState tracking;
  const _GpsDiagnosticChip({required this.tracking});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final captured = tracking.localTrack.length;
    final queued = tracking.queuedPoints;
    final hasIssue = queued > 5;
    final accent = hasIssue ? AppColors.riesgo : AppColors.apto;
    return Material(
      color: Colors.white,
      elevation: 4,
      borderRadius: BorderRadius.circular(20),
      child: InkWell(
        onTap: () async {
          await ref.read(locationTrackingProvider.notifier).flushQueue();
          if (context.mounted) {
            ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(
                content: Text('Forzando subida de ruta...'),
                duration: Duration(seconds: 2),
                behavior: SnackBarBehavior.floating,
              ),
            );
          }
        },
        borderRadius: BorderRadius.circular(20),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 8,
                height: 8,
                decoration: BoxDecoration(
                  color: accent,
                  shape: BoxShape.circle,
                ),
              ),
              const SizedBox(width: 8),
              Text(
                'GPS · $captured pts',
                style: AppTheme.inter(
                  fontSize: 11.5,
                  fontWeight: FontWeight.w700,
                  color: AppColors.ink9,
                  tabular: true,
                ),
              ),
              if (queued > 0) ...[
                const SizedBox(width: 6),
                Container(
                  padding: const EdgeInsets.symmetric(
                      horizontal: 6, vertical: 2),
                  decoration: BoxDecoration(
                    color: hasIssue ? AppColors.riesgoBg : AppColors.goldBg,
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text(
                    '↑ $queued',
                    style: AppTheme.inter(
                      fontSize: 10.5,
                      fontWeight: FontWeight.w800,
                      color: hasIssue ? AppColors.riesgo : AppColors.goldDark,
                      tabular: true,
                    ),
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
