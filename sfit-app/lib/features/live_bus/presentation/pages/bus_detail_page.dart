import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:geolocator/geolocator.dart';
import 'package:go_router/go_router.dart';
import 'package:latlong2/latlong.dart';
import '../../../../core/network/dio_client.dart';
import '../../../../core/services/location_smoother.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../shared/widgets/map/sfit_map_markers.dart';
import '../../../../shared/widgets/map/sfit_map_tiles.dart';
import '../../../../shared/widgets/sfit_loading.dart';
import 'live_bus_data.dart';

/// Pantalla completa de detalle de un bus en vivo.
///
/// Reemplaza al BottomSheet anterior. Muestra:
///   - Mapa grande con bus + ruta + paraderos numerados + ubicación del usuario
///   - Datos del bus (placa, ruta, código, velocidad, última actualización)
///   - Timeline de paraderos pendientes con ETA progresivo
///   - Acciones: centrar en bus, reportar problema
///
/// Hace polling cada 4s al endpoint público `/public/flota/activas` y filtra
/// el bus por `id`. Si el bus deja de transmitir (sale del response), muestra
/// un banner "Sin transmisión" y mantiene la última ubicación conocida.
class BusDetailPage extends ConsumerStatefulWidget {
  final String busId;
  const BusDetailPage({super.key, required this.busId});

  @override
  ConsumerState<BusDetailPage> createState() => _BusDetailPageState();
}

class _BusDetailPageState extends ConsumerState<BusDetailPage> {
  final _mapCtl = MapController();
  // Permite leer el tamaño actual del bottom sheet desde `_fitCamera` para
  // calcular un padding asimétrico — sin esto, el "centrar mapa" deja al bus
  // bajo el sheet y parece que el botón no hace nada.
  final _sheetCtl = DraggableScrollableController();
  Timer? _timer;
  BusData? _bus;
  Position? _userPos;
  bool _loading = true;
  /// True cuando el bus dejó de aparecer en el response (perdió señal o
  /// terminó turno). Conservamos la última `_bus` para pantalla.
  bool _stale = false;
  DateTime? _lastSeen;
  /// Tick de UI cada 1s solo para refrescar el "actualizado hace Xs" sin
  /// esperar al próximo poll de 4s. El setState es barato porque el árbol
  /// que cambia es chico (la pill superior).
  Timer? _uiTick;

  final _smoother = LocationSmoother();
  LatLng? _smoothedPos;
  /// Zoom actual del mapa: trackeado para que markers y polylines escalen
  /// con SfitMapStyle (sin esto el bus se ve gigante a zoom bajo).
  double _currentZoom = 14;

  @override
  void initState() {
    super.initState();
    _bootstrap();
    _uiTick = Timer.periodic(const Duration(seconds: 1), (_) {
      if (mounted) setState(() {});
    });
  }

  Future<void> _bootstrap() async {
    await _requestGps();
    await _fetch();
    _timer = Timer.periodic(const Duration(seconds: 4), (_) => _fetch());
    // Encuadrar tras el primer fetch
    WidgetsBinding.instance.addPostFrameCallback((_) => _fitCamera());
  }

  @override
  void dispose() {
    _timer?.cancel();
    _uiTick?.cancel();
    _sheetCtl.dispose();
    super.dispose();
  }

  Future<void> _requestGps() async {
    try {
      final enabled = await Geolocator.isLocationServiceEnabled();
      if (!enabled) return;
      var perm = await Geolocator.checkPermission();
      if (perm == LocationPermission.denied) {
        perm = await Geolocator.requestPermission();
      }
      if (perm == LocationPermission.denied || perm == LocationPermission.deniedForever) {
        return;
      }
      final pos = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(
          accuracy: LocationAccuracy.high,
          timeLimit: Duration(seconds: 8),
        ),
      );
      if (mounted) setState(() => _userPos = pos);
    } catch (_) {/* sin GPS, ok */}
  }

  Future<void> _fetch() async {
    // Sin filtro por muni — el backend devuelve buses cercanos al usuario.
    try {
      final dio = ref.read(dioClientProvider).dio;
      final qp = <String, dynamic>{'limit': 150};
      if (_userPos != null) {
        qp['lat'] = _userPos!.latitude;
        qp['lng'] = _userPos!.longitude;
      }
      final resp = await dio.get('/public/flota/activas', queryParameters: qp);
      final body = resp.data as Map<String, dynamic>;
      final data = body['data'] as Map<String, dynamic>? ?? body;
      final items = (data['items'] as List? ?? const [])
          .map((e) => BusData.fromJson(e as Map<String, dynamic>))
          .toList();
      final found = items.where((b) => b.id == widget.busId).cast<BusData?>().firstWhere(
            (_) => true,
            orElse: () => null,
          );
      if (!mounted) return;
      if (found != null) {
        _smoothedPos = _smoother.smooth(LatLng(found.lat, found.lng));
        setState(() {
          _bus = found;
          _stale = false;
          _lastSeen = DateTime.now();
          _loading = false;
        });
      } else {
        // No vino en el response → sin transmisión actual.
        setState(() {
          _stale = _bus != null;
          _loading = false;
        });
      }
    } catch (_) {
      if (mounted && _loading) setState(() => _loading = false);
    }
  }

  /// Valida que un par lat/lng sea finito y dentro de rango. Evita pasar
  /// 0/0, NaN o Infinity al mapa, lo que rompe `fitCamera` con el error
  /// "Unsupported operation: Infinity or NaN toInt".
  static bool _validCoord(double lat, double lng) =>
      lat.isFinite && lng.isFinite &&
      !(lat == 0 && lng == 0) &&
      lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;

  void _fitCamera() {
    final b = _bus;
    if (b == null) return;
    if (!_validCoord(b.lat, b.lng)) return;
    try {
      final pts = <LatLng>[
        LatLng(b.lat, b.lng),
        for (final w in b.waypoints)
          if (_validCoord(w.lat, w.lng)) LatLng(w.lat, w.lng),
        for (final c in b.liveTrack)
          if (c.length >= 2 && _validCoord(c[0], c[1])) LatLng(c[0], c[1]),
        if (_userPos != null && _validCoord(_userPos!.latitude, _userPos!.longitude))
          LatLng(_userPos!.latitude, _userPos!.longitude),
      ];
      // Eliminar duplicados exactos para que bounds tenga ancho/alto > 0.
      final unique = <LatLng>{};
      final dedup = <LatLng>[];
      for (final p in pts) {
        final key = LatLng(
          double.parse(p.latitude.toStringAsFixed(6)),
          double.parse(p.longitude.toStringAsFixed(6)),
        );
        if (unique.add(key)) dedup.add(p);
      }
      // Padding asimétrico: deja espacio arriba para el header pill flotante
      // y abajo para el bottom sheet draggable. Sin esto, fitCamera centra el
      // bus pero queda tapado por el sheet y parece que el botón no responde.
      final mq = MediaQuery.of(context);
      final screenH = mq.size.height;
      final sheetFraction = _sheetCtl.isAttached ? _sheetCtl.size : 0.32;
      final bottomPad = (screenH * sheetFraction).clamp(120.0, screenH * 0.6) + 16;
      final topPad = mq.padding.top + 72;
      final fitPadding = EdgeInsets.fromLTRB(48, topPad, 48, bottomPad);
      if (dedup.length >= 2) {
        _mapCtl.fitCamera(CameraFit.bounds(
          bounds: LatLngBounds.fromPoints(dedup),
          padding: fitPadding,
        ));
      } else {
        // Sólo el bus: centramos pero descontamos la mitad del sheet para
        // que el marker no quede oculto. flutter_map no permite offset
        // directo, así que desplazamos el target hacia el norte.
        final dy = (bottomPad - topPad) / 2;
        // ~111_320 m por grado de latitud. Convertimos pad pixels → grados
        // usando una aproximación válida para los zooms que usamos (14-16).
        final metersPerPixel = 156543.03392 *
            (b.lat.abs() < 89 ? 1 / (1 << 15).toDouble() : 1.0); // z=15
        final latShift = (dy * metersPerPixel) / 111320.0;
        _mapCtl.move(LatLng(b.lat - latShift, b.lng), 15);
      }
    } catch (_) {/* defensive: nunca dejamos que el mapa rompa la pantalla */}
  }

  Color _statusColor(String s) => switch (s) {
        'apto' => AppColors.apto,
        'riesgo' => AppColors.riesgo,
        _ => AppColors.noApto,
      };

  String _formatDistance(int? m) {
    if (m == null) return '—';
    if (m < 1000) return '${m}m';
    return '${(m / 1000).toStringAsFixed(1)}km';
  }

  String _formatEta(int? s) {
    if (s == null) return '—';
    if (s < 60) return '< 1 min';
    final m = (s / 60).round();
    if (m < 60) return '~$m min';
    final h = m ~/ 60;
    final rem = m % 60;
    return rem == 0 ? '~${h}h' : '~${h}h ${rem}m';
  }

  String _formatSpeed(double? mps) {
    if (mps == null || mps < 0.5) return 'Detenido';
    final kmh = (mps * 3.6).round();
    return '$kmh km/h';
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const Scaffold(
        backgroundColor: AppColors.paper,
        body: const Center(child: SfitLoading.inline(color: AppColors.gold)),
      );
    }
    final bus = _bus;
    if (bus == null) {
      return Scaffold(
        backgroundColor: AppColors.paper,
        appBar: AppBar(
          backgroundColor: Colors.white,
          elevation: 0,
          leading: const BackButton(),
          title: Text('Bus', style: AppTheme.inter(fontSize: 16, fontWeight: FontWeight.w700)),
        ),
        body: Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const Icon(Icons.signal_cellular_off, size: 48, color: AppColors.ink4),
                const SizedBox(height: 12),
                Text(
                  'Bus sin transmisión',
                  style: AppTheme.inter(fontSize: 16, fontWeight: FontWeight.w700, color: AppColors.ink9),
                ),
                const SizedBox(height: 4),
                Text(
                  'No hay datos en vivo de este vehículo. Puede haber terminado su turno.',
                  textAlign: TextAlign.center,
                  style: AppTheme.inter(fontSize: 12.5, color: AppColors.ink5),
                ),
              ],
            ),
          ),
        ),
      );
    }

    final color = _statusColor(bus.vehicleStatus);
    final hasValidPos = _validCoord(bus.lat, bus.lng);

    // Filtramos coordenadas inválidas en cada conjunto antes de pasarlas al
    // mapa. Sin esto, un waypoint con lat=0 lng=0 (placeholder de seed) o
    // un trackPoint corrupto rompe `fitCamera` con el error
    // "Unsupported operation: Infinity or NaN toInt".
    final waypointsLatLng = bus.waypoints
        .where((w) => _validCoord(w.lat, w.lng))
        .map((w) => LatLng(w.lat, w.lng))
        .toList();
    final realPolyline = bus.polylineCoords
        .where((c) => c.length >= 2 && _validCoord(c[0], c[1]))
        .map((c) => LatLng(c[0], c[1]))
        .toList();
    // Trazo en vivo: lo que el conductor ya recorrió. Se usa como fallback
    // de polyline cuando no hay ruta predefinida ("ruta orgánica").
    final liveTrackLatLng = bus.liveTrack
        .where((c) => c.length >= 2 && _validCoord(c[0], c[1]))
        .map((c) => LatLng(c[0], c[1]))
        .toList();

    final displayPos = hasValidPos
        ? (_smoothedPos ?? LatLng(bus.lat, bus.lng))
        : (_userPos != null
            ? LatLng(_userPos!.latitude, _userPos!.longitude)
            : const LatLng(-13.5163, -71.9785)); // Plaza de Armas como fallback

    // Layout estilo Google Maps / Uber: mapa full screen como base, panel
    // inferior arrastrable con la información. Banners y controles flotan
    // encima del mapa.
    return Scaffold(
      backgroundColor: AppColors.paper,
      // Sin AppBar fija — usamos un control flotante para el back y centrar.
      body: Stack(children: [
        // ── Mapa a pantalla completa ────────────────────────────────
        Positioned.fill(
          child: Builder(builder: (context) {
            final zoom = _currentZoom;
            final stopSize = SfitMapStyle.stopMarkerSize(zoom);
            final myLocSize = SfitMapStyle.myLocationSize(zoom);
            // Lógica de capas para no compitan visualmente:
            //  - Si hay liveTrack (recorrido GPS real del turno): es la línea
            //    PRINCIPAL sólida color del estado. La planificada queda
            //    detrás como guía punteada tenue desde el bus al final.
            //  - Si NO hay liveTrack todavía (turno recién iniciado): usamos
            //    la planificada partida en (recorrida sólida, pendiente
            //    punteada) como hasta antes.
            final hasLiveTrack = liveTrackLatLng.length >= 2;
            final plannedPath = realPolyline.length >= 2
                ? realPolyline
                : (waypointsLatLng.length >= 2 ? waypointsLatLng : <LatLng>[]);
            final plannedDotted = realPolyline.length < 2 && waypointsLatLng.length >= 2;
            final plannedSplit = (plannedPath.length >= 2 && hasValidPos)
                ? splitPolylineAtPosition(plannedPath, displayPos)
                : (traveled: <LatLng>[], remaining: plannedPath);
            return FlutterMap(
              mapController: _mapCtl,
              options: MapOptions(
                initialCenter: displayPos,
                initialZoom: 14,
                onPositionChanged: (pos, _) {
                  if ((pos.zoom - _currentZoom).abs() > 0.4) {
                    setState(() => _currentZoom = pos.zoom);
                  }
                },
              ),
              children: [
                sfitCartoVoyagerTile(),
                // Planificada YA PASADA: solo si no hay liveTrack (sino sería ruido).
                if (!hasLiveTrack && plannedSplit.traveled.length >= 2)
                  PolylineLayer(polylines: [
                    Polyline(
                      points: plannedSplit.traveled,
                      color: color.withValues(alpha: 0.55),
                      strokeWidth: SfitMapStyle.plannedStroke(zoom),
                      pattern: plannedDotted
                          ? const StrokePattern.dotted()
                          : const StrokePattern.solid(),
                    ),
                  ]),
                // Planificada PENDIENTE: siempre punteada tenue como guía visual.
                if (plannedSplit.remaining.length >= 2)
                  PolylineLayer(polylines: [
                    Polyline(
                      points: plannedSplit.remaining,
                      color: color.withValues(alpha: 0.22),
                      strokeWidth: SfitMapStyle.plannedStroke(zoom),
                      pattern: const StrokePattern.dotted(),
                    ),
                  ]),
                // Recorrido REAL del bus en el turno (liveTrack): es la
                // "línea trazada" principal que el ciudadano espera ver
                // completa desde el inicio del recorrido. Cortamos en
                // `displayPos` para que la línea no aparente sobresalir
                // adelante del marker (el smoothing del marker queda un
                // poco atrás del último ping crudo).
                if (hasLiveTrack)
                  PolylineLayer(polylines: [
                    Polyline(
                      points: hasValidPos
                          ? splitPolylineAtPosition(liveTrackLatLng, displayPos).traveled
                          : liveTrackLatLng,
                      color: color.withValues(alpha: 0.85),
                      strokeWidth: SfitMapStyle.recentStroke(zoom),
                    ),
                  ]),
                // Paradas aprendidas (clusters detectados del trazo en vivo).
                // Solo se muestran cuando NO hay waypoints formales para no
                // duplicar marcadores con paraderos oficiales.
                if (waypointsLatLng.isEmpty && bus.learnedStops.isNotEmpty)
                  MarkerLayer(
                    markers: bus.learnedStops
                        .where((s) => _validCoord(s.lat, s.lng))
                        .map((s) {
                      return Marker(
                        point: LatLng(s.lat, s.lng),
                        width: stopSize * 0.85,
                        height: stopSize * 0.85,
                        alignment: Alignment.center,
                        child: Container(
                          decoration: BoxDecoration(
                            color: Colors.white,
                            shape: BoxShape.circle,
                            border: Border.all(color: AppColors.info, width: 2),
                            boxShadow: [
                              BoxShadow(
                                color: AppColors.info.withValues(alpha: 0.3),
                                blurRadius: 4,
                              ),
                            ],
                          ),
                          alignment: Alignment.center,
                          child: Icon(
                            Icons.local_taxi_outlined,
                            size: stopSize * 0.42,
                            color: AppColors.info,
                          ),
                        ),
                      );
                    }).toList(),
                  ),
                MarkerLayer(
                  markers: bus.waypoints
                      .where((w) => _validCoord(w.lat, w.lng))
                      .map((w) {
                    final visited = bus.etaByStop.any((s) => s.stopIndex == w.order && s.visited);
                    return Marker(
                      point: LatLng(w.lat, w.lng),
                      width: stopSize,
                      height: stopSize,
                      alignment: Alignment.center,
                      child: Container(
                        decoration: BoxDecoration(
                          color: visited ? AppColors.apto : Colors.white,
                          shape: BoxShape.circle,
                          border: Border.all(
                            color: visited ? AppColors.apto : AppColors.ink4,
                            width: stopSize < 22 ? 1.5 : 2,
                          ),
                        ),
                        alignment: Alignment.center,
                        child: SfitMapStyle.showStopLabels(zoom)
                            ? Text(
                                '${w.order + 1}',
                                style: AppTheme.inter(
                                  fontSize: stopSize * 0.34,
                                  fontWeight: FontWeight.w800,
                                  color: visited ? Colors.white : AppColors.ink7,
                                  tabular: true,
                                ),
                              )
                            : Icon(
                                Icons.circle,
                                size: stopSize * 0.36,
                                color: visited ? Colors.white : AppColors.ink7,
                              ),
                      ),
                    );
                  }).toList(),
                ),
                if (_userPos != null && _validCoord(_userPos!.latitude, _userPos!.longitude))
                  MarkerLayer(markers: [
                    Marker(
                      point: LatLng(_userPos!.latitude, _userPos!.longitude),
                      width: myLocSize,
                      height: myLocSize,
                      alignment: Alignment.center,
                      child: Container(
                        decoration: BoxDecoration(
                          color: AppColors.blueBus,
                          shape: BoxShape.circle,
                          border: Border.all(color: Colors.white, width: myLocSize < 18 ? 2 : 3),
                          boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.25), blurRadius: 4)],
                        ),
                      ),
                    ),
                  ]),
                if (hasValidPos)
                  MarkerLayer(markers: [
                    sfitBusMarker(
                      point: displayPos,
                      zoom: zoom,
                      statusColor: color,
                      isOffRoute: bus.isOffRoute,
                      // Heading promedio sobre los últimos 4 puntos del trazo
                      // suaviza jitter del GPS y evita giros bruscos del bus.
                      rotation: headingFromTrack(liveTrackLatLng),
                    ),
                  ]),
              ],
            );
          }),
        ),
        // ── Controles flotantes superiores ──────────────────────────
        Positioned(
          top: MediaQuery.of(context).padding.top + 8,
          left: 12,
          right: 12,
          child: Row(children: [
            _floatingIconButton(
              icon: Icons.arrow_back_rounded,
              onTap: () => Navigator.of(context).maybePop(),
              tooltip: 'Volver',
            ),
            const SizedBox(width: 8),
            // Pill con la placa del bus, código de ruta y estado "en vivo".
            Expanded(
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 9),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(999),
                  boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.10), blurRadius: 8)],
                ),
                child: Row(children: [
                  Icon(Icons.directions_bus_rounded, size: 17, color: color),
                  const SizedBox(width: 6),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Row(children: [
                          Flexible(
                            child: Text(
                              bus.plate,
                              style: AppTheme.inter(
                                fontSize: 13.5, fontWeight: FontWeight.w800,
                                color: AppColors.ink9, tabular: true),
                              maxLines: 1, overflow: TextOverflow.ellipsis,
                            ),
                          ),
                          if (bus.routeCode != null) ...[
                            const SizedBox(width: 6),
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1),
                              decoration: BoxDecoration(
                                color: AppColors.ink9,
                                borderRadius: BorderRadius.circular(3),
                              ),
                              child: Text(
                                bus.routeCode!,
                                style: AppTheme.inter(
                                  fontSize: 9, fontWeight: FontWeight.w800,
                                  color: Colors.white, letterSpacing: 0.3),
                              ),
                            ),
                          ],
                        ]),
                        if (_lastSeen != null)
                          Row(children: [
                            // Punto pulsante verde "en vivo".
                            _LivePulseDot(active: !_stale && hasValidPos),
                            const SizedBox(width: 4),
                            Text(
                              _stale
                                  ? 'sin señal · ${_ago(_lastSeen!)}'
                                  : 'actualizado ${_ago(_lastSeen!)}',
                              style: AppTheme.inter(
                                fontSize: 10,
                                color: _stale ? AppColors.riesgo : AppColors.ink5,
                                fontWeight: FontWeight.w600),
                            ),
                          ]),
                      ],
                    ),
                  ),
                ]),
              ),
            ),
            const SizedBox(width: 8),
            _floatingIconButton(
              icon: Icons.center_focus_strong_outlined,
              onTap: _fitCamera,
              tooltip: 'Centrar mapa',
            ),
          ]),
        ),
        // ── Banners flotantes (solo cuando aplica) ──────────────────
        if (_stale || !hasValidPos)
          Positioned(
            top: MediaQuery.of(context).padding.top + 64,
            left: 12,
            right: 12,
            child: Column(children: [
              if (_stale) _floatingBanner(_staleBannerContent()),
              if (!hasValidPos) ...[
                if (_stale) const SizedBox(height: 8),
                _floatingBanner(_waitingGpsBannerContent()),
              ],
            ]),
          ),
        // ── Bottom sheet arrastrable con la info ────────────────────
        DraggableScrollableSheet(
          controller: _sheetCtl,
          initialChildSize: 0.32,
          minChildSize: 0.18,
          maxChildSize: 0.88,
          snap: true,
          snapSizes: const [0.18, 0.32, 0.88],
          builder: (_, scrollController) => Container(
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
              boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.12), blurRadius: 16, offset: const Offset(0, -2))],
            ),
            child: ListView(
              controller: scrollController,
              padding: EdgeInsets.zero,
              children: [
                Center(
                  child: Container(
                    margin: const EdgeInsets.only(top: 8, bottom: 4),
                    width: 38, height: 4,
                    decoration: BoxDecoration(
                      color: AppColors.ink2,
                      borderRadius: BorderRadius.circular(2),
                    ),
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.fromLTRB(14, 8, 14, 14),
                  child: Column(children: [
                    _busSummaryCard(bus, color),
                    const SizedBox(height: 12),
                    _kpiStrip(bus),
                    if (bus.etaByStop.isNotEmpty) ...[
                      const SizedBox(height: 18),
                      _sectionLabel('LÍNEA DE TIEMPO — PARADEROS PENDIENTES'),
                      const SizedBox(height: 8),
                      _timeline(bus),
                    ],
                    const SizedBox(height: 18),
                    _actionButtons(bus),
                    const SizedBox(height: 20),
                  ]),
                ),
              ],
            ),
          ),
        ),
      ]),
    );
  }

  Widget _floatingIconButton({
    required IconData icon,
    required VoidCallback onTap,
    required String tooltip,
  }) {
    return Material(
      color: Colors.white,
      shape: const CircleBorder(),
      elevation: 4,
      shadowColor: Colors.black.withValues(alpha: 0.25),
      child: InkWell(
        onTap: onTap,
        customBorder: const CircleBorder(),
        child: Tooltip(
          message: tooltip,
          child: Padding(
            padding: const EdgeInsets.all(10),
            child: Icon(icon, size: 20, color: AppColors.ink8),
          ),
        ),
      ),
    );
  }

  Widget _floatingBanner(Widget content) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(10),
          boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.12), blurRadius: 8)],
        ),
        child: content,
      );

  Widget _staleBannerContent() => Row(children: [
        const Icon(Icons.signal_cellular_alt_1_bar, size: 16, color: AppColors.riesgo),
        const SizedBox(width: 8),
        Expanded(
          child: Text(
            'Sin transmisión reciente · última señal ${_lastSeen != null ? _ago(_lastSeen!) : "hace un rato"}',
            style: AppTheme.inter(fontSize: 11.5, color: AppColors.riesgoText, fontWeight: FontWeight.w600),
          ),
        ),
      ]);

  Widget _waitingGpsBannerContent() => Row(children: [
        const Icon(Icons.gps_not_fixed, size: 16, color: AppColors.info),
        const SizedBox(width: 8),
        Expanded(
          child: Text(
            'Esperando primera ubicación del bus…',
            style: AppTheme.inter(fontSize: 11.5, color: AppColors.info, fontWeight: FontWeight.w600),
          ),
        ),
      ]);

  String _ago(DateTime t) {
    final secs = DateTime.now().difference(t).inSeconds;
    if (secs < 60) return 'hace ${secs}s';
    final m = secs ~/ 60;
    return 'hace ${m}m';
  }

  Widget _busSummaryCard(BusData bus, Color color) {
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
            Container(
              width: 44, height: 44,
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
                  Row(children: [
                    Text(
                      bus.plate,
                      style: AppTheme.inter(fontSize: 17, fontWeight: FontWeight.w800, color: AppColors.ink9, tabular: true),
                    ),
                    if (bus.routeCode != null) ...[
                      const SizedBox(width: 8),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
                        decoration: BoxDecoration(
                          color: AppColors.ink9,
                          borderRadius: BorderRadius.circular(5),
                        ),
                        child: Text(
                          bus.routeCode!,
                          style: AppTheme.inter(fontSize: 10.5, fontWeight: FontWeight.w800, color: Colors.white, letterSpacing: 0.5),
                        ),
                      ),
                    ],
                  ]),
                  if (bus.routeName != null) ...[
                    const SizedBox(height: 2),
                    Text(
                      bus.routeName!,
                      style: AppTheme.inter(fontSize: 13, color: AppColors.ink6),
                    ),
                  ],
                  if (bus.municipalityName != null) ...[
                    const SizedBox(height: 2),
                    Row(children: [
                      const Icon(Icons.apartment_rounded, size: 11, color: AppColors.ink5),
                      const SizedBox(width: 3),
                      Flexible(
                        child: Text(
                          bus.municipalityName!,
                          style: AppTheme.inter(
                            fontSize: 11, color: AppColors.ink5,
                            fontWeight: FontWeight.w500),
                          maxLines: 1, overflow: TextOverflow.ellipsis,
                        ),
                      ),
                    ]),
                  ],
                ],
              ),
            ),
            if (bus.isOffRoute)
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: AppColors.riesgoBg,
                  border: Border.all(color: AppColors.riesgo),
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Row(mainAxisSize: MainAxisSize.min, children: [
                  const Icon(Icons.warning_amber_rounded, size: 12, color: AppColors.riesgo),
                  const SizedBox(width: 4),
                  Text(
                    'Desviado',
                    style: AppTheme.inter(fontSize: 10, fontWeight: FontWeight.w700, color: AppColors.riesgoText),
                  ),
                ]),
              ),
          ]),
        ],
      ),
    );
  }

  Widget _kpiStrip(BusData bus) {
    return Row(children: [
      Expanded(
        child: _kpiTile(
          icon: Icons.speed_rounded,
          label: 'Velocidad',
          value: _formatSpeed(_extractSpeedFromBus(bus)),
        ),
      ),
      const SizedBox(width: 8),
      Expanded(
        child: _kpiTile(
          icon: Icons.my_location_rounded,
          label: 'Distancia',
          value: _formatDistance(bus.distanceFromUserMeters),
        ),
      ),
      const SizedBox(width: 8),
      Expanded(
        child: _kpiTile(
          icon: Icons.schedule_rounded,
          label: 'Próx. parada',
          value: _formatEta(bus.nextStopEta),
        ),
      ),
    ]);
  }

  /// Velocidad real reportada por el GPS del conductor. Devuelve null si
  /// el bus nunca reportó velocidad o si está literalmente detenido.
  double? _extractSpeedFromBus(BusData b) => b.speed;

  Widget _kpiTile({required IconData icon, required String label, required String value}) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 10),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: AppColors.ink2),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(children: [
            Icon(icon, size: 13, color: AppColors.ink5),
            const SizedBox(width: 4),
            Text(
              label.toUpperCase(),
              style: AppTheme.inter(fontSize: 9, fontWeight: FontWeight.w700, color: AppColors.ink5, letterSpacing: 0.5),
            ),
          ]),
          const SizedBox(height: 4),
          Text(
            value,
            style: AppTheme.inter(fontSize: 14, fontWeight: FontWeight.w800, color: AppColors.ink9, tabular: true),
            maxLines: 1, overflow: TextOverflow.ellipsis,
          ),
        ],
      ),
    );
  }

  Widget _sectionLabel(String t) => Padding(
        padding: const EdgeInsets.only(left: 4),
        child: Text(
          t,
          style: AppTheme.inter(fontSize: 10.5, fontWeight: FontWeight.w800, color: AppColors.ink5, letterSpacing: 1.1),
        ),
      );

  Widget _timeline(BusData bus) {
    return Container(
      padding: const EdgeInsets.fromLTRB(12, 12, 12, 4),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.ink2),
      ),
      child: Stack(children: [
        Positioned(left: 13, top: 14, bottom: 14, child: Container(width: 2, color: AppColors.ink2)),
        Column(
          children: bus.etaByStop.asMap().entries.map((entry) {
            final i = entry.key;
            final s = entry.value;
            final isFirst = i == 0;
            return Padding(
              padding: const EdgeInsets.only(bottom: 14),
              child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Container(
                  margin: const EdgeInsets.only(top: 2),
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
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text(
                      s.label,
                      style: AppTheme.inter(
                        fontSize: 13.5,
                        fontWeight: isFirst ? FontWeight.w700 : FontWeight.w500,
                        color: AppColors.ink9,
                      ),
                      maxLines: 2, overflow: TextOverflow.ellipsis,
                    ),
                    const SizedBox(height: 2),
                    Text(
                      'a ${_formatDistance(s.distanceFromBusMeters)} del bus',
                      style: AppTheme.inter(fontSize: 11, color: AppColors.ink5),
                    ),
                  ]),
                ),
                const SizedBox(width: 8),
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
          }).toList(),
        ),
      ]),
    );
  }

  Widget _actionButtons(BusData bus) {
    return Row(children: [
      Expanded(
        child: OutlinedButton.icon(
          onPressed: () {
            // Reportar problema con este bus → pasa contexto al formulario
            // de reporte ciudadano. Si no existe esa ruta, solo navega al
            // listado de reportes para que el ciudadano cree uno manual.
            context.push('/reportes/nuevo', extra: {
              'plate': bus.plate,
              'routeName': bus.routeName,
              'lat': bus.lat,
              'lng': bus.lng,
            });
          },
          icon: const Icon(Icons.report_problem_outlined, size: 16),
          label: Text(
            'Reportar',
            style: AppTheme.inter(fontSize: 13, fontWeight: FontWeight.w600),
          ),
          style: OutlinedButton.styleFrom(
            foregroundColor: AppColors.ink7,
            side: const BorderSide(color: AppColors.ink2),
            padding: const EdgeInsets.symmetric(vertical: 12),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
          ),
        ),
      ),
      const SizedBox(width: 10),
      Expanded(
        child: FilledButton.icon(
          onPressed: _fitCamera,
          icon: const Icon(Icons.my_location, size: 16),
          label: Text(
            'Centrar',
            style: AppTheme.inter(fontSize: 13, fontWeight: FontWeight.w600),
          ),
          style: FilledButton.styleFrom(
            backgroundColor: AppColors.gold,
            foregroundColor: Colors.white,
            padding: const EdgeInsets.symmetric(vertical: 12),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
          ),
        ),
      ),
    ]);
  }
}

/// Punto verde pulsante para indicar que la posición se está actualizando
/// en vivo. Se atenúa cuando el bus dejó de transmitir (`active=false`).
class _LivePulseDot extends StatefulWidget {
  final bool active;
  const _LivePulseDot({required this.active});

  @override
  State<_LivePulseDot> createState() => _LivePulseDotState();
}

class _LivePulseDotState extends State<_LivePulseDot>
    with SingleTickerProviderStateMixin {
  late final AnimationController _ctl = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 1100),
  )..repeat(reverse: true);

  @override
  void dispose() {
    _ctl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final color = widget.active ? AppColors.apto : AppColors.riesgo;
    return AnimatedBuilder(
      animation: _ctl,
      builder: (_, __) => Container(
        width: 7, height: 7,
        decoration: BoxDecoration(
          color: color.withValues(alpha: widget.active ? (0.5 + 0.5 * _ctl.value) : 0.7),
          shape: BoxShape.circle,
          boxShadow: widget.active
              ? [BoxShadow(color: color.withValues(alpha: 0.45 * _ctl.value), blurRadius: 4 * _ctl.value, spreadRadius: _ctl.value)]
              : null,
        ),
      ),
    );
  }
}
