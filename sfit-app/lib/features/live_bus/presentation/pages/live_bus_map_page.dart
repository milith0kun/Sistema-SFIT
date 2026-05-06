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
import '../../../auth/presentation/providers/auth_provider.dart';
import 'live_bus_data.dart';

/// Pantalla "Buses en vivo" para el ciudadano.
///
/// Pide GPS al entrar para ordenar los buses por proximidad. Soporta dos
/// vistas (Mapa y Lista), filtro por ruta y, al tocar un bus, abre un
/// BottomSheet con el detalle (paraderos pendientes con ETA progresivo).
class LiveBusMapPage extends ConsumerStatefulWidget {
  const LiveBusMapPage({super.key});
  @override
  ConsumerState<LiveBusMapPage> createState() => _LiveBusMapPageState();
}

enum _ViewMode { map, list, routes }

class _LiveBusMapPageState extends ConsumerState<LiveBusMapPage> {
  final _mapCtl = MapController();
  Timer? _timer;
  List<BusData> _buses = [];
  List<ActiveRouteData> _routes = [];
  bool _loading = true;

  // Filtro por route.id (multiselect). Vacío = sin filtro.
  final Set<String> _filterRouteIds = {};
  _ViewMode _view = _ViewMode.routes; // arranca en "Rutas" — más útil al ciudadano

  // GPS del ciudadano
  Position? _userPos;
  bool _gpsRequested = false;

  // Smoothers por bus para que los marcadores "deslicen" entre polls de 8s
  // en lugar de saltar. Se limpian cuando un bus deja de estar activo.
  final Map<String, LocationSmoother> _smoothers = {};
  final Map<String, LatLng> _smoothedPositions = {};

  @override
  void initState() {
    super.initState();
    _bootstrap();
  }

  Future<void> _bootstrap() async {
    // 1) Pedir GPS (no bloquea: si falla, igual carga los buses sin sort).
    await _requestGps();
    // 2) Primer fetch + iniciar polling cada 4s. Combinado con el envío del
    // conductor cada ~5s, da una latencia bus→pantalla de 5-9s (antes 5-13s).
    await _fetch();
    _timer = Timer.periodic(const Duration(seconds: 4), (_) => _fetch());
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  Future<void> _requestGps() async {
    if (_gpsRequested) return;
    _gpsRequested = true;
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
    } catch (_) {
      // Sin GPS: continúa, el sort por proximidad se desactiva.
    }
  }

  Future<void> _fetch() async {
    final user = ref.read(authProvider).user;
    final muniId = user?.municipalityId;
    if (muniId == null || muniId.isEmpty) {
      if (mounted) setState(() => _loading = false);
      return;
    }
    try {
      final dio = ref.read(dioClientProvider).dio;
      final qp = <String, dynamic>{'municipalityId': muniId, 'limit': 50};
      if (_userPos != null) {
        qp['lat'] = _userPos!.latitude;
        qp['lng'] = _userPos!.longitude;
      }
      // Fetch en paralelo:
      //   - /public/flota/activas → buses transmitiendo ahora con su ETA
      //   - /public/rutas         → TODAS las rutas activas del municipio
      //                              (con o sin buses) para el catálogo
      //                              completo y polylines de fondo en el mapa
      // Si el endpoint de rutas no existe (backend viejo), toleramos el error
      // y continuamos con los buses solos — la tab "Rutas" muestra vacío.
      final results = await Future.wait([
        dio.get('/public/flota/activas', queryParameters: qp),
        dio.get('/public/rutas', queryParameters: qp).then<dynamic>(
              (r) => r,
              onError: (_) => null,
            ),
      ]);

      // Buses
      final body0 = results[0].data as Map<String, dynamic>;
      final data0 = body0['data'] as Map<String, dynamic>? ?? body0;
      final items = (data0['items'] as List? ?? const [])
          .map((e) => BusData.fromJson(e as Map<String, dynamic>))
          .toList();

      // Rutas activas (agregación) — opcional
      List<ActiveRouteData> routes = const [];
      if (results[1] != null) {
        final body1 = results[1].data as Map<String, dynamic>;
        final data1 = body1['data'] as Map<String, dynamic>? ?? body1;
        routes = (data1['items'] as List? ?? const [])
            .map((e) => ActiveRouteData.fromJson(e as Map<String, dynamic>))
            .toList();
      }

      // Actualizar smoothers — uno por cada bus activo. Reduce el "salto"
      // visible del marcador entre polls de 8s.
      final activeIds = items.map((b) => b.id).toSet();
      _smoothers.removeWhere((id, _) => !activeIds.contains(id));
      _smoothedPositions.removeWhere((id, _) => !activeIds.contains(id));
      for (final b in items) {
        final smoother = _smoothers.putIfAbsent(b.id, LocationSmoother.new);
        _smoothedPositions[b.id] = smoother.smooth(LatLng(b.lat, b.lng));
      }

      if (mounted) setState(() { _buses = items; _routes = routes; _loading = false; });
    } catch (_) {
      if (mounted && _loading) setState(() => _loading = false);
    }
  }

  /// Tap en card de ruta: fija filtro a esa ruta y salta al mapa para ver
  /// el recorrido + buses transmitiendo en ella.
  void _focusOnRoute(ActiveRouteData r) {
    setState(() {
      _filterRouteIds
        ..clear()
        ..add(r.routeId);
      _view = _ViewMode.map;
    });
    // Intenta encuadrar el mapa en la ruta tras el rebuild.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      try {
        final pts = <LatLng>[
          ...r.waypoints.map((w) => LatLng(w.lat, w.lng)),
          ...r.buses.map((b) => LatLng(b.lat, b.lng)),
          if (_userPos != null) LatLng(_userPos!.latitude, _userPos!.longitude),
        ];
        if (pts.length >= 2) {
          _mapCtl.fitCamera(CameraFit.bounds(
            bounds: LatLngBounds.fromPoints(pts),
            padding: const EdgeInsets.all(48),
          ));
        }
      } catch (_) {}
    });
  }

  /// Posición visual del bus (suavizada). Cae a la posición cruda si no
  /// hay smoother todavía (primer fetch).
  LatLng _displayPos(BusData b) =>
      _smoothedPositions[b.id] ?? LatLng(b.lat, b.lng);

  // ── Lista filtrada ──────────────────────────────────────────────────
  List<BusData> get _filtered {
    if (_filterRouteIds.isEmpty) return _buses;
    return _buses
        .where((b) => b.routeId != null && _filterRouteIds.contains(b.routeId))
        .toList();
  }

  // Rutas únicas en los buses para construir los chips de filtro.
  List<({String id, String label})> get _availableRoutes {
    final seen = <String, String>{};
    for (final b in _buses) {
      final id = b.routeId;
      if (id == null) continue;
      seen.putIfAbsent(id, () => b.routeCode != null ? '${b.routeCode!} · ${b.routeName ?? 'Ruta'}' : (b.routeName ?? 'Ruta'));
    }
    return seen.entries.map((e) => (id: e.key, label: e.value)).toList()
      ..sort((a, b) => a.label.compareTo(b.label));
  }

  Color _statusColor(String s) => switch (s) {
        'apto' => AppColors.apto,
        'riesgo' => AppColors.riesgo,
        _ => AppColors.noApto,
      };

  String _formatDistance(int? m) {
    if (m == null) return '';
    if (m < 1000) return '${m}m';
    return '${(m / 1000).toStringAsFixed(1)}km';
  }

  String _formatEta(int? s) {
    if (s == null) return '—';
    if (s < 60) return '< 1 min';
    final m = (s / 60).round();
    return '$m min';
  }

  /// Cuando hay UNA ruta filtrada y conocemos al ciudadano, devolvemos la
  /// `ActiveRouteData` y el paradero más cercano para pintar el tramo
  /// "bus → tu paradero" resaltado en dorado encima del recorrido base.
  ({ActiveRouteData route, NearestStop stop})? get _highlightedRoute {
    if (_filterRouteIds.length != 1) return null;
    if (_userPos == null) return null;
    final id = _filterRouteIds.first;
    for (final r in _routes) {
      if (r.routeId == id && r.nearestStop != null) {
        return (route: r, stop: r.nearestStop!);
      }
    }
    return null;
  }

  // ── Build ───────────────────────────────────────────────────────────
  @override
  Widget build(BuildContext context) {
    final filtered = _filtered;
    return Scaffold(
      backgroundColor: AppColors.paper,
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        surfaceTintColor: Colors.transparent,
        leading: const BackButton(),
        title: Row(children: [
          const Icon(Icons.directions_bus_rounded, size: 20, color: AppColors.gold),
          const SizedBox(width: 8),
          Text(
            'Buses en vivo',
            style: AppTheme.inter(fontSize: 16, fontWeight: FontWeight.w700, color: AppColors.ink9),
          ),
          const SizedBox(width: 8),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
            decoration: BoxDecoration(
              color: AppColors.aptoBg,
              border: Border.all(color: AppColors.aptoBorder),
              borderRadius: BorderRadius.circular(999),
            ),
            child: Text(
              '${filtered.length}',
              style: AppTheme.inter(fontSize: 10, fontWeight: FontWeight.w700, color: AppColors.apto, tabular: true),
            ),
          ),
        ]),
        actions: [
          if (_userPos == null)
            IconButton(
              tooltip: 'Activar ubicación',
              onPressed: () async { await _requestGps(); _fetch(); },
              icon: const Icon(Icons.my_location, size: 20, color: AppColors.ink5),
            ),
        ],
      ),
      body: Column(children: [
        // Toggle Rutas | Buses | Mapa
        Container(
          padding: const EdgeInsets.fromLTRB(12, 10, 12, 6),
          color: Colors.white,
          child: _ViewToggle(
            value: _view,
            onChanged: (v) => setState(() => _view = v),
          ),
        ),
        // Chips de filtro por ruta — solo en Mapa/Buses (no en Rutas)
        if (_view != _ViewMode.routes && _availableRoutes.length > 1)
          SizedBox(
            height: 40,
            child: ListView.separated(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
              scrollDirection: Axis.horizontal,
              itemCount: _availableRoutes.length + (_filterRouteIds.isEmpty ? 0 : 1),
              separatorBuilder: (_, __) => const SizedBox(width: 6),
              itemBuilder: (_, i) {
                // Botón "Limpiar" cuando hay filtro activo
                if (_filterRouteIds.isNotEmpty && i == 0) {
                  return ActionChip(
                    label: Text('Limpiar', style: AppTheme.inter(fontSize: 11.5, fontWeight: FontWeight.w600, color: AppColors.ink7)),
                    avatar: const Icon(Icons.close, size: 14, color: AppColors.ink6),
                    onPressed: () => setState(_filterRouteIds.clear),
                    side: const BorderSide(color: AppColors.ink2),
                    backgroundColor: Colors.white,
                    visualDensity: VisualDensity.compact,
                  );
                }
                final idx = _filterRouteIds.isNotEmpty ? i - 1 : i;
                final r = _availableRoutes[idx];
                final selected = _filterRouteIds.contains(r.id);
                return FilterChip(
                  label: Text(r.label, style: AppTheme.inter(fontSize: 11.5, fontWeight: FontWeight.w600)),
                  selected: selected,
                  onSelected: (v) => setState(() {
                    if (v) {
                      _filterRouteIds.add(r.id);
                    } else {
                      _filterRouteIds.remove(r.id);
                    }
                  }),
                  selectedColor: AppColors.goldBg,
                  checkmarkColor: AppColors.goldDark,
                  showCheckmark: true,
                  side: BorderSide(color: selected ? AppColors.goldBorder : AppColors.ink2),
                  backgroundColor: Colors.white,
                  visualDensity: VisualDensity.compact,
                );
              },
            ),
          ),
        Expanded(
          child: _loading
              ? const Center(child: CircularProgressIndicator(color: AppColors.gold))
              : _view == _ViewMode.routes
                  ? (_routes.isEmpty
                      ? const _EmptyState(noBuses: true)
                      : _RoutesView(
                          routes: _routes,
                          hasUserGps: _userPos != null,
                          formatEta: _formatEta,
                          formatDistance: _formatDistance,
                          onTapRoute: _focusOnRoute,
                        ))
                  : (filtered.isEmpty
                      ? _EmptyState(noBuses: _buses.isEmpty)
                      : _view == _ViewMode.map
                          ? _MapView(
                              buses: filtered,
                              allRoutes: _routes,
                              filterRouteIds: _filterRouteIds,
                              mapCtl: _mapCtl,
                              userPos: _userPos,
                              statusColor: _statusColor,
                              displayPos: _displayPos,
                              onTapBus: (b) => context.push('/buses-en-vivo/${b.id}'),
                              highlight: _highlightedRoute,
                            )
                          : _ListView(
                              buses: filtered,
                              statusColor: _statusColor,
                              formatDistance: _formatDistance,
                              formatEta: _formatEta,
                              hasUserGps: _userPos != null,
                              onTapBus: (b) => context.push('/buses-en-vivo/${b.id}'),
                            )),
        ),
      ]),
    );
  }
}

// ── Toggle Mapa | Lista (segmented control sobrio) ────────────────────
class _ViewToggle extends StatelessWidget {
  final _ViewMode value;
  final ValueChanged<_ViewMode> onChanged;
  const _ViewToggle({required this.value, required this.onChanged});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(3),
      decoration: BoxDecoration(
        color: AppColors.ink1,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: AppColors.ink2),
      ),
      child: Row(children: [
        _segment(_ViewMode.routes, Icons.alt_route_rounded, 'Rutas'),
        _segment(_ViewMode.list, Icons.list_rounded, 'Buses'),
        _segment(_ViewMode.map, Icons.map_outlined, 'Mapa'),
      ]),
    );
  }

  Expanded _segment(_ViewMode m, IconData icon, String label) {
    final selected = value == m;
    return Expanded(
      child: GestureDetector(
        onTap: () => onChanged(m),
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 150),
          height: 34,
          decoration: BoxDecoration(
            color: selected ? Colors.white : Colors.transparent,
            borderRadius: BorderRadius.circular(8),
            boxShadow: selected
                ? [BoxShadow(color: Colors.black.withValues(alpha: 0.06), blurRadius: 4)]
                : null,
          ),
          alignment: Alignment.center,
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(icon, size: 14, color: selected ? AppColors.ink9 : AppColors.ink5),
              const SizedBox(width: 6),
              Text(
                label,
                style: AppTheme.inter(
                  fontSize: 12,
                  fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
                  color: selected ? AppColors.ink9 : AppColors.ink5,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

// ── Vista Mapa ─────────────────────────────────────────────────────────
class _MapView extends StatelessWidget {
  final List<BusData> buses;
  /// Catálogo completo de rutas del municipio. Se dibujan en gris tenue como
  /// "fondo" para que el ciudadano vea siempre el mapa de rutas aunque no
  /// haya buses transmitiendo, y para mostrar paraderos al filtrar una.
  final List<ActiveRouteData> allRoutes;
  /// Si hay una ruta filtrada, sólo dibujamos esa con paraderos numerados;
  /// las demás se ocultan para no saturar.
  final Set<String> filterRouteIds;
  final MapController mapCtl;
  final Position? userPos;
  final Color Function(String) statusColor;
  /// Resolver de posición visual del bus (smoothed). Cae a (b.lat, b.lng) si
  /// no hay smoother todavía.
  final LatLng Function(BusData) displayPos;
  final void Function(BusData) onTapBus;
  /// Cuando hay UNA ruta filtrada con GPS del usuario, recibimos la ruta y el
  /// paradero más cercano para pintar el tramo "bus → tu paradero" resaltado.
  final ({ActiveRouteData route, NearestStop stop})? highlight;

  const _MapView({
    required this.buses,
    required this.allRoutes,
    required this.filterRouteIds,
    required this.mapCtl,
    required this.userPos,
    required this.statusColor,
    required this.displayPos,
    required this.onTapBus,
    this.highlight,
  });

  /// Construye la lista de puntos del tramo dorado:
  /// posición actual del bus → waypoints intermedios pendientes → paradero del usuario.
  /// Devuelve null si el bus ya pasó tu paradero o si no hay datos suficientes.
  List<LatLng>? _userStopSegment(BusData bus) {
    if (highlight == null) return null;
    final route = highlight!.route;
    final stop = highlight!.stop;
    if (bus.routeId != route.routeId) return null;

    // Waypoints pendientes: los que el bus aún no ha visitado, en orden creciente.
    final pending = bus.etaByStop.where((s) => !s.visited).toList()
      ..sort((a, b) => a.stopIndex.compareTo(b.stopIndex));

    // Si tu paradero ya fue visitado por este bus, no resaltar.
    final visitedTarget = bus.etaByStop.any((s) => s.stopIndex == stop.stopIndex && s.visited);
    if (visitedTarget) return null;

    // Tomar paraderos pendientes hasta llegar a tu paradero (inclusive).
    final segment = <LatLng>[displayPos(bus)];
    for (final s in pending) {
      segment.add(LatLng(s.lat, s.lng));
      if (s.stopIndex == stop.stopIndex) return segment;
    }
    // Si no hay registro del paradero en el ETA del bus, cae al waypoint si existe.
    final wp = route.waypoints.firstWhere(
      (w) => w.order == stop.stopIndex,
      orElse: () => BusWaypoint(lat: stop.lat, lng: stop.lng, order: stop.stopIndex),
    );
    segment.add(LatLng(wp.lat, wp.lng));
    return segment;
  }

  @override
  Widget build(BuildContext context) {
    final initialCenter = userPos != null
        ? LatLng(userPos!.latitude, userPos!.longitude)
        : (buses.isNotEmpty
            ? LatLng(buses.first.lat, buses.first.lng)
            : const LatLng(-13.5319, -71.9675));
    return FlutterMap(
      mapController: mapCtl,
      options: MapOptions(initialCenter: initialCenter, initialZoom: 14),
      children: [
        TileLayer(
          urlTemplate: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png',
          subdomains: const ['a', 'b', 'c', 'd'],
          userAgentPackageName: 'com.sfit.sfit_app',
        ),
        // ── Polylines de TODAS las rutas como fondo ──
        // Cuando NO hay filtro: todas en gris tenue para mostrar el mapa
        // completo de rutas del municipio aunque no haya buses transmitiendo.
        // Cuando hay UNA ruta filtrada: dibujamos sólo esa, resaltada.
        PolylineLayer(
          polylines: [
            for (final r in allRoutes)
              if (filterRouteIds.isEmpty || filterRouteIds.contains(r.routeId))
                if (r.polylineCoords.isNotEmpty)
                  Polyline(
                    points: r.polylineCoords.map((c) => LatLng(c[0], c[1])).toList(),
                    strokeWidth: filterRouteIds.contains(r.routeId) ? 4 : 2.5,
                    color: filterRouteIds.contains(r.routeId)
                        ? AppColors.gold.withValues(alpha: 0.7)
                        : AppColors.ink4.withValues(alpha: 0.35),
                  )
                else if (r.waypoints.length >= 2)
                  Polyline(
                    points: r.waypoints.map((w) => LatLng(w.lat, w.lng)).toList(),
                    strokeWidth: 2,
                    color: AppColors.ink3.withValues(alpha: 0.4),
                    pattern: const StrokePattern.dotted(),
                  ),
          ],
        ),
        // ── Paraderos numerados (solo si hay UNA ruta filtrada) ──
        if (filterRouteIds.length == 1)
          for (final r in allRoutes)
            if (r.routeId == filterRouteIds.first)
              MarkerLayer(
                markers: r.waypoints
                    .map((w) => Marker(
                          point: LatLng(w.lat, w.lng),
                          width: 24, height: 24,
                          child: Container(
                            decoration: BoxDecoration(
                              color: Colors.white,
                              shape: BoxShape.circle,
                              border: Border.all(color: AppColors.goldDark, width: 2),
                            ),
                            alignment: Alignment.center,
                            child: Text(
                              '${w.order + 1}',
                              style: AppTheme.inter(
                                fontSize: 10,
                                fontWeight: FontWeight.w800,
                                color: AppColors.goldDark,
                                tabular: true,
                              ),
                            ),
                          ),
                        ))
                    .toList(),
              ),
        // Marcador del ciudadano
        if (userPos != null)
          MarkerLayer(markers: [
            Marker(
              point: LatLng(userPos!.latitude, userPos!.longitude),
              width: 22, height: 22,
              child: Container(
                decoration: BoxDecoration(
                  color: Colors.blue,
                  shape: BoxShape.circle,
                  border: Border.all(color: Colors.white, width: 3),
                  boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.2), blurRadius: 4)],
                ),
              ),
            ),
          ]),
        // Polylines de la ruta de cada bus (línea más gruesa por encima).
        // Preferencia: geometría real de Google Routes (siguiendo calles)
        // si está cacheada en el backend; fallback a waypoints crudos
        // (líneas rectas entre paraderos) si no — mejor que nada.
        // Cuando hay highlight (ruta filtrada + GPS): la polyline base
        // se atenúa más para que el tramo dorado "bus → tu paradero"
        // se destaque encima.
        PolylineLayer(
          polylines: [
            for (final b in buses)
              if (b.polylineCoords.isNotEmpty)
                Polyline(
                  points: b.polylineCoords
                      .map((c) => LatLng(c[0], c[1]))
                      .toList(),
                  strokeWidth: 3,
                  color: statusColor(b.vehicleStatus).withValues(
                    alpha: highlight != null ? 0.20 : 0.45,
                  ),
                )
              else if (b.waypoints.length >= 2)
                Polyline(
                  points: b.waypoints
                      .map((w) => LatLng(w.lat, w.lng))
                      .toList(),
                  strokeWidth: 2.5,
                  color: statusColor(b.vehicleStatus).withValues(
                    alpha: highlight != null ? 0.18 : 0.30,
                  ),
                  pattern: const StrokePattern.dotted(),
                ),
          ],
        ),
        // Tramo "bus → tu paradero" en dorado, resaltando lo que falta para
        // que el bus llegue a donde está el ciudadano. Halo blanco + dorado
        // encima para asegurar contraste sobre cualquier zona del mapa.
        if (highlight != null) ...[
          PolylineLayer(
            polylines: [
              for (final b in buses)
                if (b.routeId == highlight!.route.routeId)
                  if (_userStopSegment(b) case final seg? when seg.length >= 2)
                    Polyline(points: seg, strokeWidth: 7, color: Colors.white),
            ],
          ),
          PolylineLayer(
            polylines: [
              for (final b in buses)
                if (b.routeId == highlight!.route.routeId)
                  if (_userStopSegment(b) case final seg? when seg.length >= 2)
                    Polyline(points: seg, strokeWidth: 4.5, color: AppColors.gold),
            ],
          ),
          // Marker del paradero más cercano al ciudadano (halo dorado)
          MarkerLayer(markers: [
            Marker(
              point: LatLng(highlight!.stop.lat, highlight!.stop.lng),
              width: 38, height: 38,
              alignment: Alignment.center,
              child: Container(
                decoration: BoxDecoration(
                  color: AppColors.gold,
                  shape: BoxShape.circle,
                  border: Border.all(color: Colors.white, width: 3),
                  boxShadow: [
                    BoxShadow(
                      color: AppColors.gold.withValues(alpha: 0.45),
                      blurRadius: 10,
                      spreadRadius: 1,
                    ),
                  ],
                ),
                alignment: Alignment.center,
                child: const Icon(Icons.place, size: 18, color: Colors.white),
              ),
            ),
          ]),
        ],
        // Marcadores de buses (posición smoothed + badge off-route)
        MarkerLayer(
          markers: buses.map((b) {
            final color = statusColor(b.vehicleStatus);
            return Marker(
              point: displayPos(b),
              width: 48, height: 48,
              child: GestureDetector(
                onTap: () => onTapBus(b),
                child: Stack(
                  alignment: Alignment.center,
                  children: [
                    AnimatedContainer(
                      duration: const Duration(milliseconds: 220),
                      curve: Curves.easeOut,
                      width: 44, height: 44,
                      decoration: BoxDecoration(
                        color: color,
                        shape: BoxShape.circle,
                        border: Border.all(color: Colors.white, width: 2.5),
                        boxShadow: [
                          BoxShadow(
                            color: Colors.black.withValues(alpha: 0.2),
                            blurRadius: 6,
                          ),
                        ],
                      ),
                      child: const Icon(
                        Icons.directions_bus_rounded,
                        size: 20,
                        color: Colors.white,
                      ),
                    ),
                    if (b.isOffRoute)
                      Positioned(
                        right: 0,
                        top: 0,
                        child: Container(
                          width: 16, height: 16,
                          decoration: BoxDecoration(
                            color: const Color(0xFFB45309), // ámbar warn
                            shape: BoxShape.circle,
                            border: Border.all(color: Colors.white, width: 2),
                          ),
                          child: const Icon(
                            Icons.warning_amber_rounded,
                            size: 9,
                            color: Colors.white,
                          ),
                        ),
                      ),
                  ],
                ),
              ),
            );
          }).toList(),
        ),
      ],
    );
  }
}

// ── Vista Lista ────────────────────────────────────────────────────────
class _ListView extends StatelessWidget {
  final List<BusData> buses;
  final Color Function(String) statusColor;
  final String Function(int?) formatDistance;
  final String Function(int?) formatEta;
  final bool hasUserGps;
  final void Function(BusData) onTapBus;

  const _ListView({
    required this.buses,
    required this.statusColor,
    required this.formatDistance,
    required this.formatEta,
    required this.hasUserGps,
    required this.onTapBus,
  });

  @override
  Widget build(BuildContext context) {
    return ListView.separated(
      padding: const EdgeInsets.fromLTRB(12, 10, 12, 16),
      itemCount: buses.length,
      separatorBuilder: (_, __) => const SizedBox(height: 8),
      itemBuilder: (_, i) {
        final b = buses[i];
        final color = statusColor(b.vehicleStatus);
        return InkWell(
          onTap: () => onTapBus(b),
          borderRadius: BorderRadius.circular(12),
          child: Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: AppColors.ink2),
            ),
            child: Row(children: [
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
                        b.plate,
                        style: AppTheme.inter(fontSize: 15, fontWeight: FontWeight.w800, color: AppColors.ink9, tabular: true),
                      ),
                      if (b.routeCode != null) ...[
                        const SizedBox(width: 8),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                          decoration: BoxDecoration(
                            color: AppColors.ink1,
                            borderRadius: BorderRadius.circular(4),
                          ),
                          child: Text(
                            b.routeCode!,
                            style: AppTheme.inter(fontSize: 10, fontWeight: FontWeight.w700, color: AppColors.ink6),
                          ),
                        ),
                      ],
                    ]),
                    if (b.routeName != null) ...[
                      const SizedBox(height: 2),
                      Text(
                        b.routeName!,
                        style: AppTheme.inter(fontSize: 12, color: AppColors.ink6),
                        maxLines: 1, overflow: TextOverflow.ellipsis,
                      ),
                    ],
                    const SizedBox(height: 4),
                    if (b.nextStopLabel != null)
                      RichText(
                        maxLines: 1, overflow: TextOverflow.ellipsis,
                        text: TextSpan(
                          style: AppTheme.inter(fontSize: 11.5, color: AppColors.ink5),
                          children: [
                            const TextSpan(text: 'Próx: '),
                            TextSpan(
                              text: b.nextStopLabel,
                              style: AppTheme.inter(fontSize: 11.5, color: AppColors.ink7, fontWeight: FontWeight.w600),
                            ),
                            TextSpan(
                              text: ' · ${formatEta(b.nextStopEta)}',
                              style: AppTheme.inter(fontSize: 11.5, color: AppColors.gold, fontWeight: FontWeight.w700),
                            ),
                          ],
                        ),
                      ),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              if (hasUserGps && b.distanceFromUserMeters != null)
                Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                      decoration: BoxDecoration(
                        color: AppColors.goldBg,
                        borderRadius: BorderRadius.circular(999),
                        border: Border.all(color: AppColors.goldBorder),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const Icon(Icons.my_location, size: 10, color: AppColors.goldDark),
                          const SizedBox(width: 3),
                          Text(
                            'a ${formatDistance(b.distanceFromUserMeters)}',
                            style: AppTheme.inter(fontSize: 10.5, fontWeight: FontWeight.w700, color: AppColors.goldDark),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 6),
                    const Icon(Icons.chevron_right, size: 18, color: AppColors.ink4),
                  ],
                )
              else
                const Icon(Icons.chevron_right, size: 18, color: AppColors.ink4),
            ]),
          ),
        );
      },
    );
  }
}

// ── Vista Rutas (cards con # buses, paradero más cercano, ETA) ─────────
class _RoutesView extends StatelessWidget {
  final List<ActiveRouteData> routes;
  final bool hasUserGps;
  final String Function(int?) formatEta;
  final String Function(int?) formatDistance;
  final void Function(ActiveRouteData) onTapRoute;

  const _RoutesView({
    required this.routes,
    required this.hasUserGps,
    required this.formatEta,
    required this.formatDistance,
    required this.onTapRoute,
  });

  @override
  Widget build(BuildContext context) {
    return ListView.separated(
      padding: const EdgeInsets.fromLTRB(12, 10, 12, 16),
      itemCount: routes.length,
      separatorBuilder: (_, __) => const SizedBox(height: 8),
      itemBuilder: (_, i) {
        final r = routes[i];
        return InkWell(
          onTap: () => onTapRoute(r),
          borderRadius: BorderRadius.circular(12),
          child: Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: AppColors.ink2),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // ── Encabezado: código + nombre + count ──
                Row(children: [
                  if (r.code != null) ...[
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
                      decoration: BoxDecoration(
                        color: AppColors.ink9,
                        borderRadius: BorderRadius.circular(5),
                      ),
                      child: Text(
                        r.code!,
                        style: AppTheme.inter(
                          fontSize: 11, fontWeight: FontWeight.w800,
                          color: Colors.white, letterSpacing: 0.5),
                      ),
                    ),
                    const SizedBox(width: 8),
                  ],
                  Expanded(
                    child: Text(
                      r.name,
                      style: AppTheme.inter(
                        fontSize: 14.5, fontWeight: FontWeight.w700,
                        color: AppColors.ink9),
                      maxLines: 1, overflow: TextOverflow.ellipsis,
                    ),
                  ),
                  const SizedBox(width: 8),
                  // Badge: con buses → verde "X en vivo", sin buses → gris "Sin buses".
                  if (r.activeBusCount > 0)
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                      decoration: BoxDecoration(
                        color: AppColors.aptoBg,
                        border: Border.all(color: AppColors.aptoBorder),
                        borderRadius: BorderRadius.circular(999),
                      ),
                      child: Row(mainAxisSize: MainAxisSize.min, children: [
                        Container(
                          width: 6, height: 6,
                          decoration: const BoxDecoration(color: AppColors.apto, shape: BoxShape.circle),
                        ),
                        const SizedBox(width: 5),
                        Text(
                          '${r.activeBusCount} bus${r.activeBusCount == 1 ? "" : "es"} en vivo',
                          style: AppTheme.inter(
                            fontSize: 10.5, fontWeight: FontWeight.w700,
                            color: AppColors.apto, tabular: true),
                        ),
                      ]),
                    )
                  else
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                      decoration: BoxDecoration(
                        color: AppColors.ink1,
                        border: Border.all(color: AppColors.ink2),
                        borderRadius: BorderRadius.circular(999),
                      ),
                      child: Text(
                        'Sin buses ahora',
                        style: AppTheme.inter(
                          fontSize: 10.5, fontWeight: FontWeight.w700,
                          color: AppColors.ink5),
                      ),
                    ),
                ]),

                // ── Paradero más cercano + ETA al usuario ──
                if (hasUserGps && r.nearestStop != null) ...[
                  const SizedBox(height: 12),
                  Container(
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(
                      color: AppColors.goldBg,
                      border: Border.all(color: AppColors.goldBorder),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Row(children: [
                      const Icon(Icons.place_rounded, size: 18, color: AppColors.goldDark),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'Paradero cerca de ti',
                              style: AppTheme.inter(
                                fontSize: 9.5, fontWeight: FontWeight.w700,
                                color: AppColors.goldDark, letterSpacing: 0.6),
                            ),
                            const SizedBox(height: 1),
                            Text(
                              r.nearestStop!.label,
                              style: AppTheme.inter(
                                fontSize: 13, fontWeight: FontWeight.w700,
                                color: AppColors.ink9),
                              maxLines: 1, overflow: TextOverflow.ellipsis,
                            ),
                            Text(
                              'a ${formatDistance(r.nearestStop!.distanceFromUserMeters)} de tu ubicación',
                              style: AppTheme.inter(fontSize: 11, color: AppColors.ink6),
                            ),
                          ],
                        ),
                      ),
                      if (r.etaToUserStopSeconds != null) ...[
                        const SizedBox(width: 6),
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.end,
                          children: [
                            Text(
                              formatEta(r.etaToUserStopSeconds),
                              style: AppTheme.inter(
                                fontSize: 16, fontWeight: FontWeight.w800,
                                color: AppColors.goldDark, tabular: true),
                            ),
                            Text(
                              'llega bus',
                              style: AppTheme.inter(
                                fontSize: 9.5, fontWeight: FontWeight.w600,
                                color: AppColors.ink6, letterSpacing: 0.4),
                            ),
                          ],
                        ),
                      ],
                    ]),
                  ),
                ] else if (r.closestBus != null && hasUserGps && r.closestBus!.distanceFromUserMeters != null) ...[
                  const SizedBox(height: 8),
                  Row(children: [
                    const Icon(Icons.directions_bus_outlined, size: 14, color: AppColors.ink5),
                    const SizedBox(width: 5),
                    Text(
                      'Bus más cercano: ${r.closestBus!.plate} · ${formatDistance(r.closestBus!.distanceFromUserMeters)}',
                      style: AppTheme.inter(fontSize: 11.5, color: AppColors.ink6),
                    ),
                  ]),
                ],

                // ── CTA "Ver en mapa" ──
                const SizedBox(height: 10),
                Container(height: 1, color: AppColors.ink1),
                const SizedBox(height: 8),
                Row(children: [
                  const Icon(Icons.map_outlined, size: 14, color: AppColors.ink5),
                  const SizedBox(width: 5),
                  Text(
                    'Toca para ver el recorrido en el mapa',
                    style: AppTheme.inter(fontSize: 11.5, color: AppColors.ink5),
                  ),
                  const Spacer(),
                  const Icon(Icons.arrow_forward_rounded, size: 16, color: AppColors.gold),
                ]),
              ],
            ),
          ),
        );
      },
    );
  }
}

// ── Estado vacío ───────────────────────────────────────────────────────
class _EmptyState extends StatelessWidget {
  final bool noBuses;
  const _EmptyState({required this.noBuses});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Container(
        margin: const EdgeInsets.all(32),
        padding: const EdgeInsets.all(24),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: AppColors.ink2),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 56, height: 56,
              decoration: BoxDecoration(
                color: AppColors.goldBg,
                shape: BoxShape.circle,
                border: Border.all(color: AppColors.goldBorder),
              ),
              child: const Icon(Icons.directions_bus_outlined, size: 28, color: AppColors.goldDark),
            ),
            const SizedBox(height: 14),
            Text(
              noBuses ? 'Sin buses activos' : 'Sin coincidencias',
              style: AppTheme.inter(fontSize: 15, fontWeight: FontWeight.w700, color: AppColors.ink9),
            ),
            const SizedBox(height: 4),
            Text(
              noBuses
                  ? 'No hay buses con turno activo en tu municipio en este momento.'
                  : 'Cambia el filtro para ver más buses.',
              textAlign: TextAlign.center,
              style: AppTheme.inter(fontSize: 12, color: AppColors.ink5),
            ),
          ],
        ),
      ),
    );
  }
}
