import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:latlong2/latlong.dart';
import '../../../../core/constants/app_constants.dart';
import '../../../../core/services/location_tracking_service.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../shared/widgets/map/sfit_map_markers.dart';
import '../../../trips/data/datasources/trips_api_service.dart';

/// Pantalla de resumen al cerrar un FleetEntry. Llamada con
/// `context.push('/conductor/trip-summary/<entryId>')` desde `TripCheckoutPage`.
///
/// Consulta GET /api/flota/[id] (que incluye trackPoints y métricas
/// calculadas al cerrar: distanceMeters, durationSeconds,
/// routeCompliancePercentage, visitedStops).
class TripSummaryPage extends ConsumerStatefulWidget {
  final String entryId;
  /// Track GPS pre-cargado (de mis-recorridos en Mis rutas). Permite
  /// renderizar el mapa de inmediato sin esperar el fetch a /flota/{id}
  /// y evita el fallback "sin trazo" cuando el backend antiguo no devuelve
  /// trackPoints todavía.
  final List<LatLng>? preloadedTrack;

  const TripSummaryPage({
    super.key,
    required this.entryId,
    this.preloadedTrack,
  });

  @override
  ConsumerState<TripSummaryPage> createState() => _TripSummaryPageState();
}

class _TripSummaryPageState extends ConsumerState<TripSummaryPage> {
  Map<String, dynamic>? _entry;
  bool _loading = true;
  String? _error;
  /// Zoom actual del mapa (escala markers/polylines vía SfitMapStyle).
  double _currentZoom = 14;
  /// Track persistido localmente (Hive) — fallback cuando el backend devuelve
  /// trackPoints vacío. Es el respaldo definitivo del trazo.
  List<LatLng> _persistedTrack = const [];
  /// Indica si el bulk upload se disparó automáticamente (para evitar loops).
  bool _bulkUploadAttempted = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() { _loading = true; _error = null; });
    try {
      // Cargamos en paralelo: detalle del backend + track persistido local.
      // Sin el track local, si el backend está vacío (pings perdidos) el
      // mapa quedaba en blanco aunque la app SÍ había capturado los pings
      // durante el turno.
      final tracking = ref.read(locationTrackingProvider.notifier);
      final results = await Future.wait([
        ref.read(tripsApiServiceProvider).getFleetEntryDetail(widget.entryId),
        tracking.getPersistedTrack(widget.entryId),
      ]);
      final data = results[0] as Map<String, dynamic>;
      final localTrack = results[1] as List<LatLng>;
      if (!mounted) return;
      setState(() {
        _entry = data;
        _persistedTrack = localTrack;
        _loading = false;
      });
      // Si el backend devolvió trackPoints vacío PERO tenemos track local,
      // el ping-by-ping falló durante el turno. Intentamos el bulk upload
      // una sola vez: el backend dedupa, así que es seguro reintentar.
      final backendTrack = (data['trackPoints'] as List?) ?? const [];
      if (backendTrack.isEmpty &&
          localTrack.isNotEmpty &&
          !_bulkUploadAttempted) {
        _bulkUploadAttempted = true;
        unawaited(_repairTrack());
      }
    } catch (e) {
      if (mounted) setState(() { _error = 'No se pudo cargar el resumen: $e'; _loading = false; });
    }
  }

  /// Sube el track local en bulk al backend y recarga el resumen para que
  /// las métricas (distanceMeters, endLocation, compliance) se actualicen.
  Future<void> _repairTrack() async {
    try {
      final inserted = await ref
          .read(locationTrackingProvider.notifier)
          .bulkUploadTrack(widget.entryId);
      if (!mounted) return;
      if (inserted > 0) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Ruta sincronizada ($inserted puntos)'),
            backgroundColor: AppColors.apto,
            behavior: SnackBarBehavior.floating,
          ),
        );
        await _load();
      }
    } catch (_) {
      // El track local sigue mostrándose como fallback aunque falle el bulk.
    }
  }

  String _formatDistance(num? meters) {
    if (meters == null || meters == 0) return '—';
    final m = meters.toDouble();
    if (m < 1000) return '${m.round()} m';
    return '${(m / 1000).toStringAsFixed(2)} km';
  }

  String _formatDuration(num? seconds) {
    if (seconds == null || seconds == 0) return '—';
    final s = seconds.toInt();
    final h = s ~/ 3600;
    final m = (s % 3600) ~/ 60;
    if (h == 0) return '${m}m';
    return '${h}h ${m.toString().padLeft(2, '0')}m';
  }

  String _formatTime(String? iso) {
    if (iso == null || iso.isEmpty) return '—';
    try {
      final d = DateTime.parse(iso).toLocal();
      return '${d.hour.toString().padLeft(2, '0')}:${d.minute.toString().padLeft(2, '0')}';
    } catch (_) {
      return iso;
    }
  }

  @override
  Widget build(BuildContext context) {
    // Si la cola Hive del tracking todavía tiene pings al abrir el resumen
    // (caso típico: turno largo + outbox tras red intermitente), recargamos
    // el detalle del FleetEntry cuando termine el drain. Sin esto, el
    // usuario veía métricas calculadas con datos parciales (0 km, "GPS no
    // registrado") y al refrescar a mano sí aparecían las correctas.
    ref.listen<TrackingState>(locationTrackingProvider, (prev, next) {
      if (prev != null && prev.queuedPoints > 0 && next.queuedPoints == 0) {
        _load();
      }
    });
    final pendingPings =
        ref.watch(locationTrackingProvider.select((s) => s.queuedPoints));

    if (_loading) {
      return const Scaffold(
        backgroundColor: AppColors.paper,
        body: Center(child: CircularProgressIndicator(color: AppColors.gold)),
      );
    }

    if (_error != null || _entry == null) {
      return Scaffold(
        backgroundColor: AppColors.paper,
        appBar: AppBar(
          backgroundColor: Colors.white,
          elevation: 0,
          leading: const BackButton(),
        ),
        body: Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const Icon(Icons.error_outline, size: 48, color: AppColors.noApto),
                const SizedBox(height: 12),
                Text(_error ?? 'Error', textAlign: TextAlign.center,
                  style: AppTheme.inter(fontSize: 14, color: AppColors.ink7)),
                const SizedBox(height: 16),
                FilledButton(
                  onPressed: () => context.go('/home'),
                  child: const Text('Volver al inicio'),
                ),
              ],
            ),
          ),
        ),
      );
    }

    final e = _entry!;
    final vehicle = e['vehicleId'] as Map<String, dynamic>?;
    final route = e['routeId'] as Map<String, dynamic>?;
    final plate = vehicle?['plate'] as String? ?? '—';
    final distanceMeters = e['distanceMeters'] as num?;
    final durationSeconds = e['durationSeconds'] as num?;
    final compliance = e['routeCompliancePercentage'] as num?;
    final visitedStops = (e['visitedStops'] as List?)?.cast<Map<String, dynamic>>() ?? const [];
    final trackPoints = (e['trackPoints'] as List?)?.cast<Map<String, dynamic>>() ?? const [];
    final waypoints = (route?['waypoints'] as List?)?.cast<Map<String, dynamic>>() ?? const [];
    final capture = e['capture'] as Map<String, dynamic>?;
    final captureStatus = capture?['status'] as String?;
    final totalStops = waypoints.length;
    final visitedCount = visitedStops.length;

    final fromBackend = trackPoints
        .where((p) => p['lat'] != null && p['lng'] != null)
        .map((p) => LatLng((p['lat'] as num).toDouble(), (p['lng'] as num).toDouble()))
        .toList();

    // Cascada de fallbacks para el track del mapa:
    //   1) Backend (LocationPing): la fuente de verdad cuando los pings se
    //      enviaron exitosamente durante el turno.
    //   2) Track persistido local (Hive `_trackBox`): respaldo del cliente
    //      cuando el ping-by-ping falló (red/auth/etc.). Se carga en `_load`
    //      junto al detalle. Si está, también disparamos un bulk upload para
    //      que el backend se ponga al día — mientras tanto el conductor ve
    //      su ruta dibujada.
    //   3) preloadedTrack (vía go_router `extra` desde "Mis rutas"): cubre
    //      el caso donde la página se abre desde el listado y el caller ya
    //      tenía los puntos en memoria.
    final tpLatLng = fromBackend.isNotEmpty
        ? fromBackend
        : _persistedTrack.isNotEmpty
            ? _persistedTrack
            : (widget.preloadedTrack ?? const <LatLng>[]);

    // Validación de varianza espacial — sin esto el mapa explotaría con
    // "Infinity or NaN toInt" cuando todos los GPS están colapsados en
    // una sola coord (driver que no se movió).
    final hasValidTrack = tpLatLng.length >= 2 &&
        _hasVariance(tpLatLng);

    return Scaffold(
      backgroundColor: AppColors.paper,
      // SIEMPRE usamos la vista map-first para que el flujo se sienta
      // consistente entre todas las pasadas. Cuando no hay track válido,
      // _buildMapFirstView muestra un placeholder en el mapa con el mensaje
      // "GPS no registrado para este viaje" y mantiene el bottom sheet con
      // métricas + paraderos. La vista clásica se reserva como fallback
      // duro por si el track es inválido (NaN/Infinity, etc.).
      body: _buildMapFirstView(
        tpLatLng: tpLatLng,
        hasValidTrack: hasValidTrack,
        visitedStops: visitedStops,
        waypoints: waypoints,
        plate: plate,
        routeName: route?['name'] as String?,
        captureStatus: captureStatus,
        distanceMeters: distanceMeters,
        durationSeconds: durationSeconds,
        compliance: compliance,
        visitedCount: visitedCount,
        totalStops: totalStops,
        pendingPings: pendingPings,
      ),
    );
  }

  // ── Vista map-first: FlutterMap fullscreen + bottom sheet con métricas
  Widget _buildMapFirstView({
    required List<LatLng> tpLatLng,
    bool hasValidTrack = true,
    required List<Map<String, dynamic>> visitedStops,
    required List<Map<String, dynamic>> waypoints,
    required String plate,
    required String? routeName,
    required String? captureStatus,
    required num? distanceMeters,
    required num? durationSeconds,
    required num? compliance,
    required int visitedCount,
    required int totalStops,
    required int pendingPings,
  }) {
    // Cuando no hay track válido, centramos en Cusco como referencia
    // visual (la mayoría de viajes son ahí). El conductor puede pan/zoom
    // para encontrar su zona, y el banner explica el motivo.
    const fallbackCenter = LatLng(AppConstants.fallbackMapLat, AppConstants.fallbackMapLng);
    final mapOptions = hasValidTrack
        ? MapOptions(
            initialCameraFit: CameraFit.bounds(
              bounds: LatLngBounds.fromPoints(tpLatLng),
              padding: const EdgeInsets.fromLTRB(40, 100, 40, 280),
            ),
            minZoom: 4,
            maxZoom: 18,
            interactionOptions: const InteractionOptions(
              flags: InteractiveFlag.all & ~InteractiveFlag.rotate,
            ),
            onPositionChanged: (pos, _) {
              if ((pos.zoom - _currentZoom).abs() > 0.5) {
                setState(() => _currentZoom = pos.zoom);
              }
            },
          )
        : MapOptions(
            initialCenter: fallbackCenter,
            initialZoom: 13,
            interactionOptions: const InteractionOptions(
              flags: InteractiveFlag.all & ~InteractiveFlag.rotate,
            ),
            onPositionChanged: (pos, _) {
              if ((pos.zoom - _currentZoom).abs() > 0.5) {
                setState(() => _currentZoom = pos.zoom);
              }
            },
          );

    return Stack(
      children: [
        // ── Mapa fullscreen interactivo ──────────────────────────
        Positioned.fill(
          child: FlutterMap(
            options: mapOptions,
            children: [
              TileLayer(
                urlTemplate:
                    'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png',
                subdomains: const ['a', 'b', 'c', 'd'],
                userAgentPackageName: 'com.sfit.sfit_app',
              ),
              // Trazado real del conductor en dorado (grosor adaptable al zoom).
              if (hasValidTrack)
                PolylineLayer(polylines: [
                  Polyline(
                    points: tpLatLng,
                    color: AppColors.gold,
                    strokeWidth: SfitMapStyle.recentStroke(_currentZoom),
                  ),
                ]),
              // Markers: paraderos visitados verdes + inicio/fin destacados.
              // Solo si hay track — sin track no tiene sentido pintar inicio/fin.
              if (hasValidTrack)
                MarkerLayer(markers: [
                ...visitedStops.where((s) {
                  final lat = (s['lat'] as num?)?.toDouble();
                  final lng = (s['lng'] as num?)?.toDouble();
                  return lat != null &&
                      lng != null &&
                      lat.isFinite &&
                      lng.isFinite;
                }).map((s) => Marker(
                      point: LatLng(
                        (s['lat'] as num).toDouble(),
                        (s['lng'] as num).toDouble(),
                      ),
                      width: 26,
                      height: 26,
                      child: Container(
                        decoration: BoxDecoration(
                          color: AppColors.apto,
                          shape: BoxShape.circle,
                          border: Border.all(color: Colors.white, width: 2.5),
                          boxShadow: [
                            BoxShadow(
                              color: Colors.black.withValues(alpha: 0.2),
                              blurRadius: 4,
                            ),
                          ],
                        ),
                        alignment: Alignment.center,
                        child: const Icon(Icons.check_rounded,
                            size: 14, color: Colors.white),
                      ),
                    )),
                sfitTrackEndpointMarker(
                  point: tpLatLng.first,
                  zoom: _currentZoom,
                  isStart: true,
                ),
                sfitTrackEndpointMarker(
                  point: tpLatLng.last,
                  zoom: _currentZoom,
                  isStart: false,
                ),
              ]),
            ],
          ),
        ),
        // ── Header flotante con back + título ────────────────────
        SafeArea(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(12, 8, 12, 0),
            child: Row(
              children: [
                _MapTopButton(
                  icon: Icons.arrow_back_rounded,
                  onTap: () => context.canPop() ? context.pop() : context.go('/home'),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 14, vertical: 10),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(12),
                      boxShadow: [
                        BoxShadow(
                          color: Colors.black.withValues(alpha: 0.08),
                          blurRadius: 8,
                          offset: const Offset(0, 2),
                        ),
                      ],
                    ),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(children: [
                          const Icon(Icons.directions_bus_rounded,
                              size: 14, color: AppColors.gold),
                          const SizedBox(width: 5),
                          Flexible(
                            child: Text(
                              plate +
                                  (routeName != null ? ' · $routeName' : ''),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: AppTheme.inter(
                                fontSize: 13,
                                fontWeight: FontWeight.w700,
                                color: AppColors.ink9,
                              ),
                            ),
                          ),
                        ]),
                        if (captureStatus != null) ...[
                          const SizedBox(height: 4),
                          _CaptureStatusBadge(status: captureStatus),
                        ],
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
        // ── Banner cuando aún hay pings encolados subiendo ───────
        if (pendingPings > 0)
          Positioned(
            left: 16,
            right: 16,
            top: 88,
            child: _PendingSyncBanner(count: pendingPings),
          ),
        // ── Banner cuando no hay GPS registrado ──────────────────
        if (!hasValidTrack && pendingPings == 0)
          Positioned(
            left: 16,
            right: 16,
            top: 88,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: AppColors.ink2),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.08),
                    blurRadius: 10,
                    offset: const Offset(0, 2),
                  ),
                ],
              ),
              child: Row(
                children: [
                  Container(
                    width: 32,
                    height: 32,
                    decoration: const BoxDecoration(
                      color: Color(0xFFFFF4E5),
                      shape: BoxShape.circle,
                    ),
                    alignment: Alignment.center,
                    child: const Icon(Icons.location_off_rounded,
                        size: 18, color: Color(0xFFB45309)),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'GPS no registrado',
                          style: AppTheme.inter(
                            fontSize: 13,
                            fontWeight: FontWeight.w700,
                            color: AppColors.ink9,
                          ),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          'Este viaje no tiene puntos GPS para mostrar el trazado.',
                          style: AppTheme.inter(
                            fontSize: 11.5,
                            color: AppColors.ink6,
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
        // ── Bottom sheet draggable con métricas + paraderos ──────
        DraggableScrollableSheet(
          initialChildSize: 0.32,
          minChildSize: 0.12,
          maxChildSize: 0.85,
          builder: (ctx, scrollCtl) => Container(
            decoration: const BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
              boxShadow: [
                BoxShadow(
                  color: Color(0x1A000000),
                  blurRadius: 16,
                  offset: Offset(0, -4),
                ),
              ],
            ),
            child: Column(
              children: [
                // Handle
                Container(
                  margin: const EdgeInsets.only(top: 10, bottom: 12),
                  width: 40,
                  height: 4,
                  decoration: BoxDecoration(
                    color: AppColors.ink2,
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
                Expanded(
                  child: ListView(
                    controller: scrollCtl,
                    padding: const EdgeInsets.fromLTRB(20, 0, 20, 24),
                    children: [
                      // Hero compacto
                      Row(children: [
                        Container(
                          width: 38,
                          height: 38,
                          decoration: BoxDecoration(
                            color: AppColors.aptoBg,
                            shape: BoxShape.circle,
                            border: Border.all(
                                color: AppColors.aptoBorder, width: 1.5),
                          ),
                          child: const Icon(Icons.check_rounded,
                              size: 22, color: AppColors.apto),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text('¡Viaje completado!',
                                  style: AppTheme.inter(
                                      fontSize: 16,
                                      fontWeight: FontWeight.w800,
                                      color: AppColors.ink9)),
                              const SizedBox(height: 2),
                              Text(
                                  'Desliza para ver detalles',
                                  style: AppTheme.inter(
                                      fontSize: 11.5,
                                      color: AppColors.ink5,
                                      fontWeight: FontWeight.w500)),
                            ],
                          ),
                        ),
                      ]),
                      const SizedBox(height: 18),
                      // Métricas
                      Row(children: [
                        Expanded(
                          child: _MetricCard(
                            icon: Icons.straighten_rounded,
                            label: 'Distancia',
                            value: _formatDistance(distanceMeters),
                          ),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: _MetricCard(
                            icon: Icons.schedule_rounded,
                            label: 'Duración',
                            value: _formatDuration(durationSeconds),
                          ),
                        ),
                      ]),
                      const SizedBox(height: 10),
                      Row(children: [
                        Expanded(
                          child: _MetricCard(
                            icon: Icons.place_outlined,
                            label: 'Paraderos',
                            value: totalStops > 0
                                ? '$visitedCount / $totalStops'
                                : '$visitedCount',
                          ),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: _MetricCard(
                            icon: Icons.verified_outlined,
                            label: 'Cumplimiento',
                            value: compliance != null
                                ? '${compliance.round()}%'
                                : '—',
                            accent: _complianceColor(compliance),
                          ),
                        ),
                      ]),
                      if (visitedStops.isNotEmpty) ...[
                        const SizedBox(height: 20),
                        Text('PARADEROS VISITADOS',
                            style: AppTheme.inter(
                                fontSize: 11,
                                fontWeight: FontWeight.w700,
                                color: AppColors.ink5,
                                letterSpacing: 1.2)),
                        const SizedBox(height: 8),
                        Container(
                          decoration: BoxDecoration(
                            color: Colors.white,
                            borderRadius: BorderRadius.circular(12),
                            border: Border.all(color: AppColors.ink2),
                          ),
                          child: Column(
                            children: visitedStops.asMap().entries.map((entry) {
                              final i = entry.key;
                              final s = entry.value;
                              final isLast = i == visitedStops.length - 1;
                              return Container(
                                padding: const EdgeInsets.symmetric(
                                    horizontal: 14, vertical: 12),
                                decoration: BoxDecoration(
                                  border: Border(
                                      bottom: isLast
                                          ? BorderSide.none
                                          : const BorderSide(
                                              color: AppColors.ink1)),
                                ),
                                child: Row(children: [
                                  Container(
                                    width: 24,
                                    height: 24,
                                    decoration: const BoxDecoration(
                                        color: AppColors.aptoBg,
                                        shape: BoxShape.circle),
                                    child: const Icon(Icons.check_rounded,
                                        size: 14, color: AppColors.apto),
                                  ),
                                  const SizedBox(width: 10),
                                  Expanded(
                                    child: Text(
                                      s['label'] as String? ??
                                          'Paradero ${(s['stopIndex'] as num? ?? 0).toInt() + 1}',
                                      style: AppTheme.inter(
                                          fontSize: 13,
                                          fontWeight: FontWeight.w600,
                                          color: AppColors.ink9),
                                    ),
                                  ),
                                  Text(
                                    _formatTime(s['visitedAt'] as String?),
                                    style: AppTheme.inter(
                                        fontSize: 12,
                                        color: AppColors.ink5,
                                        tabular: true),
                                  ),
                                ]),
                              );
                            }).toList(),
                          ),
                        ),
                      ],
                      const SizedBox(height: 20),
                      // Botón Listo
                      SizedBox(
                        width: double.infinity,
                        height: 48,
                        child: FilledButton(
                          onPressed: () => context.go('/home'),
                          style: FilledButton.styleFrom(
                            backgroundColor: AppColors.ink9,
                            shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(10)),
                          ),
                          child: Text('Listo',
                              style: AppTheme.inter(
                                  fontSize: 14,
                                  fontWeight: FontWeight.w700,
                                  color: Colors.white)),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }

  // Verifica que un track GPS tenga al menos 2 puntos con varianza espacial
  // real. Sin esta validación, FlutterMap explota con "Infinity or NaN
  // toInt" cuando todos los puntos están colapsados en una coord (driver
  // que cerró turno sin moverse).
  bool _hasVariance(List<LatLng> pts) {
    if (pts.length < 2) return false;
    final first = pts.first;
    for (final p in pts) {
      if ((p.latitude - first.latitude).abs() > 1e-7 ||
          (p.longitude - first.longitude).abs() > 1e-7) {
        return true;
      }
    }
    return false;
  }

  Color _complianceColor(num? c) {
    if (c == null) return AppColors.ink6;
    if (c >= 80) return AppColors.apto;
    if (c >= 50) return AppColors.riesgo;
    return AppColors.noApto;
  }
}

class _CaptureStatusBadge extends StatelessWidget {
  final String status;
  const _CaptureStatusBadge({required this.status});

  @override
  Widget build(BuildContext context) {
    final cfg = _styleFor(status);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: cfg.bg,
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: cfg.border),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(cfg.icon, size: 12, color: cfg.fg),
          const SizedBox(width: 6),
          Text(
            cfg.label,
            style: AppTheme.inter(fontSize: 10.5, fontWeight: FontWeight.w700, color: cfg.fg, letterSpacing: 0.6),
          ),
        ],
      ),
    );
  }

  _BadgeStyle _styleFor(String s) {
    switch (s) {
      case 'validated':
        return _BadgeStyle(
          label: 'RUTA VALIDADA',
          icon: Icons.verified_rounded,
          fg: AppColors.apto,
          bg: AppColors.aptoBg,
          border: AppColors.aptoBorder,
        );
      case 'raw':
        return _BadgeStyle(
          label: 'PASADA REGISTRADA',
          icon: Icons.timeline_rounded,
          fg: AppColors.ink7,
          bg: AppColors.ink1,
          border: AppColors.ink2,
        );
      case 'merged':
        return _BadgeStyle(
          label: 'CANDIDATA ACUMULADA',
          icon: Icons.layers_rounded,
          fg: AppColors.ink7,
          bg: AppColors.ink1,
          border: AppColors.ink2,
        );
      case 'rejected':
        return _BadgeStyle(
          label: 'CANDIDATA RECHAZADA',
          icon: Icons.block_rounded,
          fg: AppColors.noApto,
          bg: AppColors.ink1,
          border: AppColors.ink2,
        );
      case 'candidate':
      default:
        return _BadgeStyle(
          label: 'SIN VALIDAR',
          icon: Icons.hourglass_top_rounded,
          fg: AppColors.riesgo,
          bg: AppColors.ink1,
          border: AppColors.ink2,
        );
    }
  }
}

class _BadgeStyle {
  final String label;
  final IconData icon;
  final Color fg;
  final Color bg;
  final Color border;
  _BadgeStyle({required this.label, required this.icon, required this.fg, required this.bg, required this.border});
}

class _MetricCard extends StatelessWidget {
  final IconData icon;
  final String label;
  final String value;
  final Color? accent;
  const _MetricCard({required this.icon, required this.label, required this.value, this.accent});

  @override
  Widget build(BuildContext context) {
    final color = accent ?? AppColors.ink9;
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.ink2),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(children: [
            Icon(icon, size: 14, color: AppColors.ink5),
            const SizedBox(width: 6),
            Text(label, style: AppTheme.inter(fontSize: 10.5, fontWeight: FontWeight.w700, color: AppColors.ink5, letterSpacing: 0.6)),
          ]),
          const SizedBox(height: 8),
          Text(
            value,
            style: AppTheme.inter(fontSize: 22, fontWeight: FontWeight.w800, color: color, tabular: true),
          ),
        ],
      ),
    );
  }
}

/// Botón circular flotante para superponer sobre el mapa (back, etc).
/// Sombra suave + fondo blanco para asegurar contraste sobre cualquier
/// zona del mapa.
class _MapTopButton extends StatelessWidget {
  final IconData icon;
  final VoidCallback onTap;
  const _MapTopButton({required this.icon, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.white,
      shape: const CircleBorder(),
      elevation: 4,
      child: InkWell(
        onTap: onTap,
        customBorder: const CircleBorder(),
        child: SizedBox(
          width: 40,
          height: 40,
          child: Icon(icon, size: 20, color: AppColors.ink9),
        ),
      ),
    );
  }
}

/// Banner que avisa que aún quedan pings GPS subiendo al servidor — las
/// métricas y el trazo del mapa se actualizarán automáticamente cuando la
/// cola termine de drenarse (`ref.listen` en `build`).
class _PendingSyncBanner extends StatelessWidget {
  final int count;
  const _PendingSyncBanner({required this.count});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.goldBorder),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.08),
            blurRadius: 10,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Row(
        children: [
          const SizedBox(
            width: 18,
            height: 18,
            child: CircularProgressIndicator(
              strokeWidth: 2.2,
              color: AppColors.gold,
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Subiendo ruta…',
                  style: AppTheme.inter(
                    fontSize: 13,
                    fontWeight: FontWeight.w700,
                    color: AppColors.ink9,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  '$count punto${count == 1 ? '' : 's'} pendiente${count == 1 ? '' : 's'} de sincronizar. Las métricas se actualizarán al terminar.',
                  style: AppTheme.inter(
                    fontSize: 11.5,
                    color: AppColors.ink6,
                    fontWeight: FontWeight.w500,
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
