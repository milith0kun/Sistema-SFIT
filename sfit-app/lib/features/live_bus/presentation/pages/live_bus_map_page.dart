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
import '../../../../core/utils/geo.dart';
import '../../../../shared/widgets/map/sfit_map_markers.dart';
import '../../../../shared/widgets/map/sfit_map_tiles.dart';
import '../../../../shared/widgets/sfit_loading.dart';
import 'live_bus_data.dart';

/// Pantalla "Buses en vivo".
///
/// Modo ciudadano (sin `companyId`): pide GPS al entrar para ordenar los buses
/// por proximidad y muestra TODA la flota dentro del bounding box. Por
/// defecto se filtra a `serviceScope=urbano` para respetar la privacidad de
/// los viajes interprovinciales (rutas largas con poca afluencia).
///
/// Modo operador (`companyId` no-null): filtra `/public/flota/activas` por
/// empresa para mostrar SOLO la flota propia del operador en el mapa. NO
/// filtra por scope — el operador ve sus dos modalidades si aplica.
class LiveBusMapPage extends ConsumerStatefulWidget {
  /// Si se provee, filtra los buses por empresa. Usado por el dashboard del
  /// operador para ver "su" flota en vivo.
  final String? companyId;

  /// Filtro por modalidad de servicio (`urbano` | `interprovincial`). El
  /// feed ciudadano pasa `urbano` para ocultar interprovinciales del mapa
  /// público. `null` o vacío → el backend devuelve cualquier scope (modo
  /// operador / admin).
  final String? serviceScope;

  const LiveBusMapPage({super.key, this.companyId, this.serviceScope});

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
  // Filtro por tipo de vehículo (ej. {'omnibus','microbus'}). Vacío = todos.
  // El backend acepta `?vehicleType=` repetido, así se filtra server-side.
  final Set<String> _filterVehicleTypes = {};
  _ViewMode _view = _ViewMode.routes; // arranca en "Rutas" — más útil al ciudadano

  /// Cuando es `true`, el endpoint devuelve TODA la red sin aplicar el
  /// bounding box ±33km. Útil para que el ciudadano vea buses de otras
  /// ciudades antes de viajar. Se acompaña de un `limit` más generoso.
  bool _showAllNetwork = false;

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
    // Bootstrap optimizado para minimizar tiempo de carga percibido:
    //   1. Disparar fetch INMEDIATAMENTE (sin esperar GPS) — el ciudadano
    //      ve la lista de rutas/buses en cuanto el backend responde, ~200ms.
    //   2. En paralelo, intentar GPS rápido (lastKnown 0ms → current 4s timeout).
    //   3. Cuando llegue el GPS, refetch para activar el orden por proximidad.
    //   4. Iniciar polling cada 4s para mantener live.
    //
    // Antes: GPS → fetch (8s peor caso bloqueante). Ahora: fetch ~200ms,
    // GPS ~0-4s en paralelo, refetch automático cuando GPS llega.
    unawaited(_fetch());
    unawaited(_requestGpsAndRefetch());
    _timer = Timer.periodic(const Duration(seconds: 4), (_) => _fetch());
  }

  Future<void> _requestGpsAndRefetch() async {
    final hadPos = _userPos != null;
    await _requestGps();
    // Solo refetch si recién obtuvimos GPS (antes no teníamos) — evita un
    // fetch redundante al inicializar.
    if (!hadPos && _userPos != null && mounted) {
      _fetch();
    }
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

      // Estrategia 2-tiempos: primero `getLastKnownPosition` (instantáneo,
      // viene del caché del SO) para tener una posición aproximada YA. Luego
      // refinar con `getCurrentPosition` (timeout 4s, antes 8s — más agresivo).
      final cached = await Geolocator.getLastKnownPosition();
      if (cached != null && mounted) {
        setState(() => _userPos = cached);
      }

      final fresh = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(
          accuracy: LocationAccuracy.high,
          timeLimit: Duration(seconds: 4),
        ),
      );
      if (mounted) setState(() => _userPos = fresh);
    } catch (_) {
      // Sin GPS preciso: si tenemos cached, lo conservamos; si no, sin sort.
    }
  }

  Future<void> _fetch() async {
    // Ya NO filtramos por el municipio del ciudadano — mostramos todos los
    // buses y rutas dentro del bounding box del backend (~33 km del usuario),
    // o de toda la red si el ciudadano activó "Toda la red". El campo
    // `municipalityName` del response permite identificar de qué jurisdicción
    // es cada bus/ruta.
    try {
      final dio = ref.read(dioClientProvider).dio;
      // Límite más generoso cuando se pide TODA la red, para que no se corte
      // el response a 80 cuando hay flota nacional > 80 buses.
      final qp = <String, dynamic>{'limit': _showAllNetwork ? 300 : 80};
      if (_userPos != null) {
        qp['lat'] = _userPos!.latitude;
        qp['lng'] = _userPos!.longitude;
      }
      if (_showAllNetwork) {
        qp['bbox'] = 'off';
      }
      // Filtro por tipo de vehículo: el backend acepta el query repetido
      // (?vehicleType=omnibus&vehicleType=microbus). Dio lo serializa con
      // `ListFormat.multi` por defecto.
      if (_filterVehicleTypes.isNotEmpty) {
        qp['vehicleType'] = _filterVehicleTypes.toList();
      }
      if (widget.companyId != null) {
        qp['companyId'] = widget.companyId;
      }
      // Privacidad: el feed ciudadano pasa `serviceScope=urbano` para que
      // los buses interprovinciales no aparezcan en el mapa. Operador/admin
      // omiten el parámetro y ven cualquier modalidad.
      if (widget.serviceScope != null && widget.serviceScope!.isNotEmpty) {
        qp['serviceScope'] = widget.serviceScope;
      }
      // Para `/public/rutas`: pedimos que incluya candidatas (RouteCapture
      // sin validar generadas al cerrar turno sin ruta). Las mostramos en
      // sección aparte "Rutas sin validar" para diferenciar.
      final qpRoutes = <String, dynamic>{
        ...qp,
        'includeCandidates': true,
      };
      // Fetch en paralelo:
      //   - /public/flota/activas → buses transmitiendo ahora con su ETA
      //   - /public/rutas         → TODAS las rutas activas del municipio
      //                              (con o sin buses) para el catálogo
      //                              completo y polylines de fondo en el mapa
      // Si el endpoint de rutas no existe (backend viejo), toleramos el error
      // y continuamos con los buses solos — la tab "Rutas" muestra vacío.
      final results = await Future.wait([
        dio.get('/public/flota/activas', queryParameters: qp),
        dio.get('/public/rutas', queryParameters: qpRoutes).then<dynamic>(
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
  /// el recorrido + buses transmitiendo en ella. Para candidatas (sin
  /// validar) usamos `samplePolyline` como fuente de puntos.
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
          ...r.samplePolyline.map((c) => LatLng(c[0], c[1])),
          ...r.buses.map((b) => LatLng(b.lat, b.lng)),
          if (_userPos != null) LatLng(_userPos!.latitude, _userPos!.longitude),
        ];
        // Solo fitear si los puntos tienen varianza espacial real. Sin esta
        // guarda, capturas con todos los GPS colapsados en una coordenada
        // (driver que cerró turno sin moverse) producen bounds degenerados
        // → CameraFit calcula zoom Infinity → flutter_map .toInt() crashea.
        if (pts.length >= 2 && _ptsHaveVariance(pts)) {
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

  /// Tipos de vehículo posibles (canónicos del sistema). Lista fija porque el
  /// usuario debe poder filtrar incluso cuando no hay ningún bus de ese tipo
  /// transmitiendo ahora — y porque la inferencia desde el response no sirve
  /// cuando el filtro server-side ya ocultó los demás.
  static const _vehicleTypeChoices = <({String key, String label, IconData icon})>[
    (key: 'transporte_urbano',          label: 'Urbano',         icon: Icons.directions_bus_rounded),
    (key: 'transporte_interprovincial', label: 'Interprovincial', icon: Icons.airport_shuttle_rounded),
  ];

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
          // Toggle "Cerca de mí" ⇄ "Toda la red". Solo aplica al ciudadano
          // (modo operador siempre filtra por su empresa via companyId).
          if (widget.companyId == null)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 8),
              child: _NetworkScopeChip(
                showAll: _showAllNetwork,
                onToggle: () {
                  setState(() => _showAllNetwork = !_showAllNetwork);
                  _fetch();
                },
              ),
            ),
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
        // Chips de tipo de vehículo. Se ven siempre porque el filtro afecta
        // tanto a la lista de Rutas como a la de Buses como al Mapa.
        Container(
          color: Colors.white,
          padding: const EdgeInsets.fromLTRB(0, 4, 0, 0),
          child: SizedBox(
            height: 36,
            child: ListView.separated(
              padding: const EdgeInsets.symmetric(horizontal: 12),
              scrollDirection: Axis.horizontal,
              itemCount: _vehicleTypeChoices.length,
              separatorBuilder: (_, __) => const SizedBox(width: 6),
              itemBuilder: (_, i) {
                final t = _vehicleTypeChoices[i];
                final selected = _filterVehicleTypes.contains(t.key);
                return FilterChip(
                  avatar: Icon(t.icon,
                      size: 14,
                      color: selected ? AppColors.goldDark : AppColors.ink6),
                  label: Text(t.label,
                      style: AppTheme.inter(
                          fontSize: 11.5, fontWeight: FontWeight.w600)),
                  selected: selected,
                  onSelected: (v) {
                    setState(() {
                      if (v) {
                        _filterVehicleTypes.add(t.key);
                      } else {
                        _filterVehicleTypes.remove(t.key);
                      }
                    });
                    _fetch();
                  },
                  selectedColor: AppColors.goldBg,
                  checkmarkColor: AppColors.goldDark,
                  showCheckmark: false,
                  side: BorderSide(
                      color: selected ? AppColors.goldBorder : AppColors.ink2),
                  backgroundColor: Colors.white,
                  visualDensity: VisualDensity.compact,
                  materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
                );
              },
            ),
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
              ? _LoadingSkeleton(view: _view)
              : _view == _ViewMode.routes
                  ? (_routes.isEmpty
                      ? _EmptyState(
                          noBuses: true,
                          kind: _EmptyKind.noRoutes,
                          onAction: _fetch,
                          actionLabel: 'Reintentar',
                        )
                      : _RoutesView(
                          routes: _routes,
                          hasUserGps: _userPos != null,
                          formatEta: _formatEta,
                          formatDistance: _formatDistance,
                          onTapRoute: _focusOnRoute,
                        ))
                  : _view == _ViewMode.map
                      // Tab Mapa: siempre mostramos el mapa con tu ubicación
                      // y las rutas de fondo, aunque no haya buses ni filtros
                      // coincidan. Un chip flotante avisa si no hay buses.
                      ? Stack(children: [
                          _MapView(
                            buses: filtered,
                            allRoutes: _routes,
                            filterRouteIds: _filterRouteIds,
                            mapCtl: _mapCtl,
                            userPos: _userPos,
                            statusColor: _statusColor,
                            displayPos: _displayPos,
                            onTapBus: (b) => context.push('/buses-en-vivo/${b.id}'),
                            highlight: _highlightedRoute,
                          ),
                          if (filtered.isEmpty)
                            Positioned(
                              top: 12, left: 12, right: 12,
                              child: _MapOverlayBanner(
                                icon: _buses.isEmpty
                                    ? Icons.directions_bus_outlined
                                    : Icons.filter_alt_off_outlined,
                                title: _buses.isEmpty
                                    ? 'Sin buses transmitiendo ahora'
                                    : 'Sin coincidencias con el filtro',
                                actionLabel: _filterRouteIds.isNotEmpty
                                    ? 'Limpiar'
                                    : null,
                                onAction: _filterRouteIds.isNotEmpty
                                    ? () => setState(_filterRouteIds.clear)
                                    : null,
                              ),
                            ),
                        ])
                      // Tab Buses: lista vacía → empty state full screen.
                      : (filtered.isEmpty
                          ? _EmptyState(
                              noBuses: _buses.isEmpty,
                              kind: _buses.isEmpty
                                  ? _EmptyKind.noActiveBuses
                                  : _EmptyKind.noFilterMatch,
                              onAction: _filterRouteIds.isNotEmpty
                                  ? () => setState(_filterRouteIds.clear)
                                  : _fetch,
                              actionLabel: _filterRouteIds.isNotEmpty
                                  ? 'Limpiar filtros'
                                  : 'Reintentar',
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

// ── Toggle alcance: Cerca de mí ⇄ Toda la red ─────────────────────────
/// Chip de header que alterna entre "Cerca" (default, bbox ±33km del GPS) y
/// "Toda la red" (sin bbox — útil para ver buses de otras ciudades antes de
/// viajar, o cuando el ciudadano no está donde quiere consultar la flota).
class _NetworkScopeChip extends StatelessWidget {
  final bool showAll;
  final VoidCallback onToggle;
  const _NetworkScopeChip({required this.showAll, required this.onToggle});

  @override
  Widget build(BuildContext context) {
    final bg = showAll ? AppColors.goldBg : Colors.white;
    final border = showAll ? AppColors.goldBorder : AppColors.ink2;
    final fg = showAll ? AppColors.goldDark : AppColors.ink7;
    final icon = showAll ? Icons.public_rounded : Icons.near_me_rounded;
    final label = showAll ? 'Toda la red' : 'Cerca';
    return Tooltip(
      message: showAll
          ? 'Mostrando buses de TODA la red. Tap para volver a "Cerca de mí".'
          : 'Mostrando buses dentro de ~33 km. Tap para ver toda la red.',
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: onToggle,
          borderRadius: BorderRadius.circular(999),
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
            decoration: BoxDecoration(
              color: bg,
              borderRadius: BorderRadius.circular(999),
              border: Border.all(color: border),
            ),
            child: Row(mainAxisSize: MainAxisSize.min, children: [
              Icon(icon, size: 14, color: fg),
              const SizedBox(width: 5),
              Text(
                label,
                style: AppTheme.inter(
                  fontSize: 11.5,
                  fontWeight: FontWeight.w700,
                  color: fg,
                ),
              ),
            ]),
          ),
        ),
      ),
    );
  }
}

// ── Vista Mapa ─────────────────────────────────────────────────────────
class _MapView extends StatefulWidget {
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

  @override
  State<_MapView> createState() => _MapViewState();
}

class _MapViewState extends State<_MapView> {
  /// Zoom actual del mapa. Lo trackeamos para que markers y polylines escalen
  /// con SfitMapStyle (sin esto, los íconos del bus se ven gigantes a zoom
  /// bajo y los paraderos invisibles a zoom muy alto).
  double _currentZoom = 14;

  /// Construye la lista de puntos del tramo dorado:
  /// posición actual del bus → waypoints intermedios pendientes → paradero del usuario.
  /// Devuelve null si el bus ya pasó tu paradero o si no hay datos suficientes.
  List<LatLng>? _userStopSegment(BusData bus) {
    final highlight = widget.highlight;
    if (highlight == null) return null;
    final route = highlight.route;
    final stop = highlight.stop;
    if (bus.routeId != route.routeId) return null;

    // Waypoints pendientes: los que el bus aún no ha visitado, en orden creciente.
    final pending = bus.etaByStop.where((s) => !s.visited).toList()
      ..sort((a, b) => a.stopIndex.compareTo(b.stopIndex));

    // Si tu paradero ya fue visitado por este bus, no resaltar.
    final visitedTarget = bus.etaByStop.any((s) => s.stopIndex == stop.stopIndex && s.visited);
    if (visitedTarget) return null;

    // Tomar paraderos pendientes hasta llegar a tu paradero (inclusive).
    final segment = <LatLng>[widget.displayPos(bus)];
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
    final buses = widget.buses;
    final allRoutes = widget.allRoutes;
    final filterRouteIds = widget.filterRouteIds;
    final userPos = widget.userPos;
    final highlight = widget.highlight;
    final statusColor = widget.statusColor;
    final displayPos = widget.displayPos;
    final onTapBus = widget.onTapBus;
    final zoom = _currentZoom;
    final stopSize = SfitMapStyle.stopMarkerSize(zoom);
    final myLocSize = SfitMapStyle.myLocationSize(zoom);
    final initialCenter = userPos != null
        ? LatLng(userPos.latitude, userPos.longitude)
        : (buses.isNotEmpty
            ? LatLng(buses.first.lat, buses.first.lng)
            : const LatLng(-13.5319, -71.9675));
    return FlutterMap(
      mapController: widget.mapCtl,
      options: MapOptions(
        initialCenter: initialCenter,
        initialZoom: 14,
        // Trackeamos el zoom para escalar markers y polylines con SfitMapStyle.
        // Solo refrescamos si el delta supera 0.4 niveles para evitar rebuilds
        // por cada panning sutil.
        onPositionChanged: (pos, _) {
          final z = pos.zoom;
          if ((z - _currentZoom).abs() > 0.4) {
            setState(() => _currentZoom = z);
          }
        },
      ),
      children: [
        sfitCartoVoyagerTile(),
        // ── Polylines de TODAS las rutas como fondo ──
        // Cuando NO hay filtro: todas en gris tenue para mostrar el mapa
        // completo de rutas del municipio aunque no haya buses transmitiendo.
        // Cuando hay UNA ruta filtrada: dibujamos sólo esa.
        // - Validadas se pintan con dorado al estar filtradas.
        // - Candidatas (validated == false) se mantienen en gris siempre,
        //   incluso filtradas, para que el ciudadano las distinga.
        //
        // Filtramos rutas con puntos degenerados (todos en la misma coordenada)
        // ANTES de construir las polylines: flutter_map crashea con 'Infinity
        // or NaN toInt' cuando una polyline tiene zero spread espacial al
        // calcular sus bounds internas para tile rendering.
        PolylineLayer(
          polylines: _buildPolylinesSafe(allRoutes, filterRouteIds, zoom),
        ),
        // ── Paraderos de la ruta filtrada ──
        // Antes solo se mostraban si la ruta era "validated"; ahora también
        // dibujamos los waypoints de candidatas (con estilo más sobrio) para
        // que el ciudadano vea siempre los puntos de embarque cuando filtra.
        if (filterRouteIds.length == 1)
          for (final r in allRoutes)
            if (r.routeId == filterRouteIds.first && r.waypoints.isNotEmpty)
              MarkerLayer(
                markers: r.waypoints.map((w) {
                  final main = r.validated ? AppColors.goldDark : AppColors.ink5;
                  return Marker(
                    point: LatLng(w.lat, w.lng),
                    width: stopSize,
                    height: stopSize,
                    alignment: Alignment.center,
                    child: Container(
                      decoration: BoxDecoration(
                        color: Colors.white,
                        shape: BoxShape.circle,
                        border: Border.all(color: main, width: stopSize < 22 ? 1.6 : 2.2),
                        boxShadow: [
                          BoxShadow(
                            color: Colors.black.withValues(alpha: 0.15),
                            blurRadius: 3,
                          ),
                        ],
                      ),
                      alignment: Alignment.center,
                      child: SfitMapStyle.showStopLabels(zoom)
                          ? Text(
                              '${w.order + 1}',
                              style: AppTheme.inter(
                                fontSize: stopSize * 0.34,
                                fontWeight: FontWeight.w800,
                                color: main,
                                tabular: true,
                              ),
                            )
                          : Icon(
                              Icons.circle,
                              size: stopSize * 0.36,
                              color: main,
                            ),
                    ),
                  );
                }).toList(),
              ),
        // Marcador del ciudadano (escala con zoom)
        if (userPos != null)
          MarkerLayer(markers: [
            Marker(
              point: LatLng(userPos.latitude, userPos.longitude),
              width: myLocSize,
              height: myLocSize,
              alignment: Alignment.center,
              child: Container(
                decoration: BoxDecoration(
                  color: const Color(0xFF2563EB),
                  shape: BoxShape.circle,
                  border: Border.all(color: Colors.white, width: myLocSize < 18 ? 2 : 3),
                  boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.25), blurRadius: 4)],
                ),
              ),
            ),
          ]),
        // Polylines de la ruta de cada bus. Dibujamos en este orden de
        // abajo hacia arriba para que las capas se compongan bien:
        //   1. Ruta planificada PENDIENTE (del bus al fin) → punteada tenue
        //   2. Ruta planificada YA PASADA (inicio → bus) → sólida color tenue
        //   3. liveTrack real recorrido → sólida color marcado (encima)
        // El liveTrack es la "línea trazada" real del bus durante el turno.
        // La planificada queda como contexto/referencia visual.
        for (final b in buses)
          ..._buildBusRoutePolylines(b, statusColor, displayPos(b), highlight, zoom),
        // Capa del recorrido REAL del bus (puntos GPS reportados durante el
        // turno) — es la "línea trazada" que el ciudadano espera ver completa
        // desde el inicio del recorrido.
        for (final b in buses)
          if (b.liveTrack.length >= 2)
            Builder(builder: (_) {
              final track = b.liveTrack.map((c) => LatLng(c[0], c[1])).toList();
              // Cortamos el liveTrack en la posición actual del bus para que
              // la línea no aparente "sobresalir" adelante del marker (el
              // smoothing del marker queda un poco atrás del último ping).
              final cut = splitPolylineAtPosition(track, displayPos(b)).traveled;
              if (cut.length < 2) return const SizedBox.shrink();
              return PolylineLayer(polylines: [
                Polyline(
                  points: cut,
                  strokeWidth: SfitMapStyle.recentStroke(zoom),
                  color: statusColor(b.vehicleStatus).withValues(
                    alpha: highlight != null ? 0.55 : 0.85,
                  ),
                ),
              ]);
            }),
        // Tramo "TU UBICACIÓN → tu paradero" en azul punteado: ruta de
        // aproximación a pie (línea recta como heurística — para precisión
        // siguiendo calles haría falta una API de walking directions).
        if (highlight != null && userPos != null)
          PolylineLayer(polylines: [
            Polyline(
              points: [
                LatLng(userPos.latitude, userPos.longitude),
                LatLng(highlight.stop.lat, highlight.stop.lng),
              ],
              strokeWidth: SfitMapStyle.plannedStroke(zoom) + 0.6,
              color: AppColors.blueBus.withValues(alpha: 0.75),
              pattern: const StrokePattern.dotted(),
            ),
          ]),
        // Tramo "bus → tu paradero" en dorado, resaltando lo que falta para
        // que el bus llegue a donde está el ciudadano. Halo blanco + dorado
        // encima para asegurar contraste sobre cualquier zona del mapa.
        if (highlight != null) ...[
          PolylineLayer(
            polylines: [
              for (final b in buses)
                if (b.routeId == highlight.route.routeId)
                  if (_userStopSegment(b) case final seg? when seg.length >= 2)
                    Polyline(
                      points: seg,
                      strokeWidth: SfitMapStyle.recentStroke(zoom) + 3,
                      color: Colors.white,
                    ),
            ],
          ),
          PolylineLayer(
            polylines: [
              for (final b in buses)
                if (b.routeId == highlight.route.routeId)
                  if (_userStopSegment(b) case final seg? when seg.length >= 2)
                    Polyline(
                      points: seg,
                      strokeWidth: SfitMapStyle.recentStroke(zoom) + 1,
                      color: AppColors.gold,
                    ),
            ],
          ),
          // Marker del paradero más cercano al ciudadano (halo dorado).
          // Cuando hay GPS y zoom suficiente, mostramos al lado un pill con
          // "X min 👟" para que el ciudadano sepa de un vistazo cuánto camina.
          MarkerLayer(markers: [
            Marker(
              point: LatLng(highlight.stop.lat, highlight.stop.lng),
              width: SfitMapStyle.showStopLabels(zoom) ? stopSize * 3.2 : stopSize * 1.35,
              height: stopSize * 1.35,
              alignment: Alignment.center,
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Container(
                    width: stopSize * 1.35,
                    height: stopSize * 1.35,
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
                    child: Icon(
                      Icons.place,
                      size: stopSize * 0.6,
                      color: Colors.white,
                    ),
                  ),
                  if (SfitMapStyle.showStopLabels(zoom) && userPos != null) ...[
                    const SizedBox(width: 6),
                    Flexible(
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                        decoration: BoxDecoration(
                  color: AppColors.blueBus,
                          borderRadius: BorderRadius.circular(10),
                          boxShadow: [
                            BoxShadow(
                              color: Colors.black.withValues(alpha: 0.18),
                              blurRadius: 4,
                              offset: const Offset(0, 1),
                            ),
                          ],
                        ),
                        child: Text(
                          '${formatWalkDuration(walkSecondsBetween(LatLng(userPos.latitude, userPos.longitude), LatLng(highlight.stop.lat, highlight.stop.lng)))} 👟',
                          style: AppTheme.inter(
                            fontSize: 10.5,
                            fontWeight: FontWeight.w800,
                            color: Colors.white,
                          ),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ]),
        ],
        // Marcadores de buses: ícono completo (no círculo), escala con zoom.
        // El heading se calcula a partir de los últimos puntos del liveTrack
        // para que el bus apunte en la dirección de avance — sin esto siempre
        // queda mirando al norte aunque el bus vaya al este o sur.
        MarkerLayer(
          markers: [
            for (final b in buses)
              sfitBusMarker(
                point: displayPos(b),
                zoom: zoom,
                statusColor: statusColor(b.vehicleStatus),
                isOffRoute: b.isOffRoute,
                rotation: headingFromTrack(
                  b.liveTrack.map((c) => LatLng(c[0], c[1])).toList(),
                ),
                onTap: () => onTapBus(b),
              ),
          ],
        ),
      ],
    );
  }

  /// Construye los layers de la RUTA PLANIFICADA del bus como contexto/
  /// referencia visual. El recorrido real ya lo dibuja una capa de liveTrack
  /// más arriba, así que aquí solo añadimos:
  ///  - El tramo PENDIENTE (del bus al fin de ruta) punteado tenue, para que
  ///    el ciudadano sepa por dónde va a continuar el bus.
  ///  - Cuando no hay liveTrack todavía, también dibujamos el tramo "ya
  ///    pasado" de la planificada como respaldo (antes de que llegue el
  ///    primer ping en vivo).
  List<Widget> _buildBusRoutePolylines(
    BusData b,
    Color Function(String) statusColor,
    LatLng currentPos,
    ({ActiveRouteData route, NearestStop stop})? highlight,
    double zoom,
  ) {
    List<LatLng> path;
    bool dotted;
    if (b.polylineCoords.isNotEmpty) {
      path = b.polylineCoords.map((c) => LatLng(c[0], c[1])).toList();
      dotted = false;
    } else if (b.waypoints.length >= 2) {
      path = b.waypoints.map((w) => LatLng(w.lat, w.lng)).toList();
      dotted = true;
    } else {
      return const <Widget>[];
    }
    final split = splitPolylineAtPosition(path, currentPos);
    final base = statusColor(b.vehicleStatus);
    // Cuando hay un tramo dorado activo (highlight de paradero del usuario),
    // bajamos la opacidad para que el dorado destaque encima.
    final mute = highlight != null;
    final hasLiveTrack = b.liveTrack.length >= 2;
    final traveledStroke = SfitMapStyle.plannedStroke(zoom);
    final remainingStroke = SfitMapStyle.plannedStroke(zoom);
    return [
      // Solo dibujamos el "ya pasado" planificado si NO hay liveTrack todavía.
      // Si hay liveTrack, esa capa muestra el recorrido real y ésta sería
      // ruido visual.
      if (!hasLiveTrack && split.traveled.length >= 2)
        PolylineLayer(
          polylines: [
            Polyline(
              points: split.traveled,
              strokeWidth: traveledStroke,
              color: base.withValues(alpha: mute ? 0.20 : 0.45),
              pattern: dotted ? const StrokePattern.dotted() : const StrokePattern.solid(),
            ),
          ],
        ),
      // El tramo pendiente siempre se dibuja punteado tenue como guía visual.
      if (split.remaining.length >= 2)
        PolylineLayer(
          polylines: [
            Polyline(
              points: split.remaining,
              strokeWidth: remainingStroke,
              color: base.withValues(alpha: mute ? 0.10 : 0.22),
              pattern: const StrokePattern.dotted(),
            ),
          ],
        ),
    ];
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
                    if (b.municipalityName != null) ...[
                      const SizedBox(height: 2),
                      Row(children: [
                        const Icon(Icons.apartment_rounded, size: 11, color: AppColors.ink5),
                        const SizedBox(width: 3),
                        Flexible(
                          child: Text(
                            b.municipalityName!,
                            style: AppTheme.inter(fontSize: 10.5, color: AppColors.ink5, fontWeight: FontWeight.w500),
                            maxLines: 1, overflow: TextOverflow.ellipsis,
                          ),
                        ),
                      ]),
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
    // Particionamos rutas oficiales (validated) vs candidatas (unvalidated).
    // El backend mezcla ambas en /public/rutas cuando includeCandidates=true.
    final validated = routes.where((r) => r.validated).toList();
    final candidates = routes.where((r) => !r.validated).toList();
    final hasBoth = validated.isNotEmpty && candidates.isNotEmpty;

    return ListView(
      padding: const EdgeInsets.fromLTRB(12, 10, 12, 16),
      children: [
        if (validated.isNotEmpty) ...[
          if (hasBoth) const _RoutesSectionHeader(label: 'RUTAS VALIDADAS'),
          for (int i = 0; i < validated.length; i++) ...[
            _ValidatedRouteCard(
              route: validated[i],
              hasUserGps: hasUserGps,
              formatEta: formatEta,
              formatDistance: formatDistance,
              onTap: () => onTapRoute(validated[i]),
            ),
            if (i < validated.length - 1) const SizedBox(height: 8),
          ],
        ],
        if (candidates.isNotEmpty) ...[
          if (validated.isNotEmpty) const SizedBox(height: 18),
          const _RoutesSectionHeader(label: 'RUTAS SIN VALIDAR'),
          // Aviso explicativo para el ciudadano: estas rutas las generó el
          // sistema a partir de un recorrido real de un conductor. Aún no
          // están aprobadas oficialmente por la municipalidad.
          Container(
            padding: const EdgeInsets.fromLTRB(10, 8, 10, 8),
            margin: const EdgeInsets.only(bottom: 8),
            decoration: BoxDecoration(
              color: AppColors.ink1,
              border: Border.all(color: AppColors.ink2),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Row(children: [
              const Icon(Icons.info_outline, size: 14, color: AppColors.ink6),
              const SizedBox(width: 6),
              Expanded(
                child: Text(
                  'Recorridos capturados por conductores. Pendientes de validación oficial.',
                  style: AppTheme.inter(
                    fontSize: 11.5, color: AppColors.ink6, height: 1.3),
                ),
              ),
            ]),
          ),
          for (int i = 0; i < candidates.length; i++) ...[
            _CandidateRouteCard(
              route: candidates[i],
              onTap: () => onTapRoute(candidates[i]),
            ),
            if (i < candidates.length - 1) const SizedBox(height: 8),
          ],
        ],
      ],
    );
  }
}

class _RoutesSectionHeader extends StatelessWidget {
  final String label;
  const _RoutesSectionHeader({required this.label});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(2, 2, 2, 8),
      child: Text(
        label,
        style: AppTheme.inter(
          fontSize: 11, fontWeight: FontWeight.w800,
          color: AppColors.ink5, letterSpacing: 1.2),
      ),
    );
  }
}

class _ValidatedRouteCard extends StatelessWidget {
  final ActiveRouteData route;
  final bool hasUserGps;
  final String Function(int?) formatEta;
  final String Function(int?) formatDistance;
  final VoidCallback onTap;

  const _ValidatedRouteCard({
    required this.route,
    required this.hasUserGps,
    required this.formatEta,
    required this.formatDistance,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final r = route;
    return InkWell(
      onTap: onTap,
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
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          r.name,
                          style: AppTheme.inter(
                            fontSize: 14.5, fontWeight: FontWeight.w700,
                            color: AppColors.ink9),
                          maxLines: 1, overflow: TextOverflow.ellipsis,
                        ),
                        if (r.municipalityName != null)
                          Text(
                            r.municipalityName!,
                            style: AppTheme.inter(
                              fontSize: 11, color: AppColors.ink5,
                              fontWeight: FontWeight.w500),
                            maxLines: 1, overflow: TextOverflow.ellipsis,
                          ),
                      ],
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
  }
}

/// Card de una ruta candidata (no validada). Diseño deliberadamente más
/// sobrio que `_ValidatedRouteCard`: borde gris, badge "SIN VALIDAR",
/// mini-mapa con la `samplePolyline` en gris y SIN contador de buses
/// (siempre 0 para candidatas).

/// Verifica que una lista de puntos tenga al menos 2 puntos con varianza
/// espacial mínima (tolerancia ~1cm). Usado antes de `LatLngBounds.fromPoints`
/// para evitar bounds degenerados que harían que `CameraFit.bounds` calcule
/// zoom infinito y cause "Unsupported operation: Infinity or NaN toInt".
bool _ptsHaveVariance(List<LatLng> pts) {
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

/// Misma validación pero para listas de pares [lat, lng].
bool _coordsHaveVariance(List<List<double>> coords) {
  if (coords.length < 2) return false;
  final first = coords.first;
  if (first.length < 2) return false;
  for (final c in coords) {
    if (c.length < 2) continue;
    if ((c[0] - first[0]).abs() > 1e-7 || (c[1] - first[1]).abs() > 1e-7) {
      return true;
    }
  }
  return false;
}

/// Convierte una `List<List<double>>` a `List<LatLng>` saltando entries
/// con menos de 2 elementos o coords no finitas (NaN/Infinity).
List<LatLng> _coordsToLatLngs(List<List<double>> coords) {
  final out = <LatLng>[];
  for (final c in coords) {
    if (c.length < 2) continue;
    final lat = c[0];
    final lng = c[1];
    if (!lat.isFinite || !lng.isFinite) continue;
    out.add(LatLng(lat, lng));
  }
  return out;
}

/// Construye la lista de Polylines del map view filtrando rutas degeneradas
/// (sin varianza espacial) que harían crashear flutter_map al calcular
/// bounds internas durante el tile rendering. Si una ruta tiene polyline
/// pero sus puntos colapsan, la saltamos completa para esa ruta.
List<Polyline> _buildPolylinesSafe(
  List<ActiveRouteData> allRoutes,
  Set<String> filterRouteIds,
  double zoom,
) {
  // Grosor base de las polylines de fondo (rutas del catálogo). Las focused
  // usan el grosor "histórico" (más visible), las no-focused el "planeado"
  // (más fino para no saturar).
  final focusedStroke = SfitMapStyle.historicalStroke(zoom);
  final unfocusedStroke = SfitMapStyle.plannedStroke(zoom);
  final out = <Polyline>[];
  for (final r in allRoutes) {
    if (!(filterRouteIds.isEmpty || filterRouteIds.contains(r.routeId))) {
      continue;
    }
    final isFocused = filterRouteIds.contains(r.routeId);

    if (!r.validated) {
      // Candidata: probar samplePolyline → polylineCoords → waypoints,
      // tomando el primero que tenga varianza real.
      if (r.samplePolyline.length >= 2 &&
          _coordsHaveVariance(r.samplePolyline)) {
        final pts = _coordsToLatLngs(r.samplePolyline);
        if (pts.length >= 2) {
          out.add(Polyline(
            points: pts,
            strokeWidth: isFocused ? focusedStroke : unfocusedStroke,
            color: AppColors.ink5.withValues(alpha: isFocused ? 0.7 : 0.4),
            pattern: StrokePattern.dashed(segments: const [6.0, 4.0]),
          ));
        }
      } else if (r.polylineCoords.length >= 2 &&
          _coordsHaveVariance(r.polylineCoords)) {
        final pts = _coordsToLatLngs(r.polylineCoords);
        if (pts.length >= 2) {
          out.add(Polyline(
            points: pts,
            strokeWidth: isFocused ? focusedStroke : unfocusedStroke,
            color: AppColors.ink5.withValues(alpha: isFocused ? 0.7 : 0.4),
            pattern: StrokePattern.dashed(segments: const [6.0, 4.0]),
          ));
        }
      } else if (r.waypoints.length >= 2) {
        final pts = r.waypoints
            .where((w) => w.lat.isFinite && w.lng.isFinite)
            .map((w) => LatLng(w.lat, w.lng))
            .toList();
        if (pts.length >= 2 && _ptsHaveVariance(pts)) {
          out.add(Polyline(
            points: pts,
            strokeWidth: unfocusedStroke,
            color: AppColors.ink5.withValues(alpha: 0.35),
            pattern: const StrokePattern.dotted(),
          ));
        }
      }
      // Si nada tiene varianza, simplemente no dibujamos esa candidata.
    } else {
      // Validada (oficial)
      if (r.polylineCoords.length >= 2 &&
          _coordsHaveVariance(r.polylineCoords)) {
        final pts = _coordsToLatLngs(r.polylineCoords);
        if (pts.length >= 2) {
          out.add(Polyline(
            points: pts,
            strokeWidth: isFocused ? focusedStroke + 0.6 : unfocusedStroke,
            color: isFocused
                ? AppColors.gold.withValues(alpha: 0.7)
                : AppColors.ink4.withValues(alpha: 0.35),
          ));
        }
      } else if (r.waypoints.length >= 2) {
        final pts = r.waypoints
            .where((w) => w.lat.isFinite && w.lng.isFinite)
            .map((w) => LatLng(w.lat, w.lng))
            .toList();
        if (pts.length >= 2 && _ptsHaveVariance(pts)) {
          out.add(Polyline(
            points: pts,
            strokeWidth: unfocusedStroke,
            color: AppColors.ink3.withValues(alpha: 0.4),
            pattern: const StrokePattern.dotted(),
          ));
        }
      }
    }
  }
  return out;
}

class _CandidateRouteCard extends StatelessWidget {
  final ActiveRouteData route;
  final VoidCallback onTap;
  const _CandidateRouteCard({required this.route, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final r = route;
    // Puntos para el mini-mapa: priorizar samplePolyline; fallback a
    // polylineCoords y por último a waypoints (mejor que nada).
    final pts = <LatLng>[
      if (r.samplePolyline.isNotEmpty)
        ...r.samplePolyline.map((c) => LatLng(c[0], c[1]))
      else if (r.polylineCoords.isNotEmpty)
        ...r.polylineCoords.map((c) => LatLng(c[0], c[1]))
      else
        ...r.waypoints.map((w) => LatLng(w.lat, w.lng)),
    ];
    // Bounds válidos solo si hay >=2 puntos Y los puntos tienen varianza
    // espacial real (no colapsan en uno solo). Sin esto, captures donde
    // el conductor no se movió o solo registró 1 GPS válido producen
    // bounds degenerados → CameraFit.bounds calcula zoom Infinity → crash
    // "Unsupported operation: Infinity or NaN toInt".
    final hasMapBounds = _ptsHaveVariance(pts);
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: Container(
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: AppColors.ink2),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Mini-mapa con el sample en gris (sólo si hay >=2 puntos
            // distintos — captures con todos los puntos en la misma
            // coordenada se renderizan sin mapa).
            if (hasMapBounds)
              ClipRRect(
                borderRadius:
                    const BorderRadius.vertical(top: Radius.circular(11)),
                child: AspectRatio(
                  aspectRatio: 16 / 6,
                  child: IgnorePointer(
                    child: FlutterMap(
                      options: MapOptions(
                        initialCameraFit: CameraFit.bounds(
                          bounds: LatLngBounds.fromPoints(pts),
                          padding: const EdgeInsets.all(14),
                        ),
                        interactionOptions: const InteractionOptions(
                            flags: InteractiveFlag.none),
                      ),
                      children: [
                        sfitCartoVoyagerTile(),
                        PolylineLayer(polylines: [
                          Polyline(
                            points: pts,
                            color: AppColors.ink5.withValues(alpha: 0.75),
                            strokeWidth: 3,
                            pattern:
                                StrokePattern.dashed(segments: const [6.0, 4.0]),
                          ),
                        ]),
                      ],
                    ),
                  ),
                ),
              ),
            Padding(
              padding: const EdgeInsets.all(14),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(children: [
                    if (r.code != null) ...[
                      Container(
                        padding:
                            const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
                        decoration: BoxDecoration(
                          color: AppColors.ink5,
                          borderRadius: BorderRadius.circular(5),
                        ),
                        child: Text(
                          r.code!,
                          style: AppTheme.inter(
                              fontSize: 11,
                              fontWeight: FontWeight.w800,
                              color: Colors.white,
                              letterSpacing: 0.5),
                        ),
                      ),
                      const SizedBox(width: 8),
                    ],
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            r.name,
                            style: AppTheme.inter(
                                fontSize: 14.5,
                                fontWeight: FontWeight.w700,
                                color: AppColors.ink8),
                            maxLines: 1, overflow: TextOverflow.ellipsis,
                          ),
                          if (r.municipalityName != null)
                            Text(
                              r.municipalityName!,
                              style: AppTheme.inter(
                                  fontSize: 11,
                                  color: AppColors.ink5,
                                  fontWeight: FontWeight.w500),
                              maxLines: 1, overflow: TextOverflow.ellipsis,
                            ),
                        ],
                      ),
                    ),
                    const SizedBox(width: 8),
                    Container(
                      padding:
                          const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                      decoration: BoxDecoration(
                        color: AppColors.ink1,
                        border: Border.all(color: AppColors.ink3),
                        borderRadius: BorderRadius.circular(999),
                      ),
                      child: Row(mainAxisSize: MainAxisSize.min, children: [
                        const Icon(Icons.lock_clock,
                            size: 11, color: AppColors.ink6),
                        const SizedBox(width: 4),
                        Text(
                          'SIN VALIDAR',
                          style: AppTheme.inter(
                              fontSize: 10,
                              fontWeight: FontWeight.w800,
                              color: AppColors.ink6,
                              letterSpacing: 0.6),
                        ),
                      ]),
                    ),
                  ]),
                  const SizedBox(height: 8),
                  Text(
                    'Recorrido capturado por conductor — pendiente de validación oficial.',
                    style: AppTheme.inter(
                        fontSize: 11.5, color: AppColors.ink6, height: 1.35),
                  ),
                  const SizedBox(height: 10),
                  Container(height: 1, color: AppColors.ink1),
                  const SizedBox(height: 8),
                  Row(children: [
                    const Icon(Icons.map_outlined,
                        size: 14, color: AppColors.ink5),
                    const SizedBox(width: 5),
                    Text(
                      'Toca para ver el trazo en el mapa',
                      style: AppTheme.inter(fontSize: 11.5, color: AppColors.ink5),
                    ),
                    const Spacer(),
                    const Icon(Icons.arrow_forward_rounded,
                        size: 16, color: AppColors.ink5),
                  ]),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ── Estado vacío ───────────────────────────────────────────────────────
/// Tipo de estado vacío según el contexto de la tab. Cada variante usa un
/// icono y mensaje distintos para guiar al ciudadano sobre qué hacer.
enum _EmptyKind {
  /// Tab Rutas: el catálogo está vacío (no hay rutas registradas en la zona).
  noRoutes,
  /// Tab Buses/Mapa: hay rutas pero ninguna tiene buses transmitiendo ahora.
  noActiveBuses,
  /// Hay buses pero ninguno coincide con el filtro elegido.
  noFilterMatch,
}

class _EmptyState extends StatelessWidget {
  final bool noBuses;
  /// Permite distinguir entre "no hay rutas en el catálogo" y "no hay buses".
  /// Si es null se infiere desde `noBuses` para conservar compat.
  final _EmptyKind? kind;
  /// Acción opcional para botón secundario (ej. limpiar filtros, refrescar).
  final VoidCallback? onAction;
  final String? actionLabel;

  const _EmptyState({
    required this.noBuses,
    this.kind,
    this.onAction,
    this.actionLabel,
  });

  _EmptyKind get _kind =>
      kind ?? (noBuses ? _EmptyKind.noActiveBuses : _EmptyKind.noFilterMatch);

  @override
  Widget build(BuildContext context) {
    final (icon, title, body, accent) = switch (_kind) {
      _EmptyKind.noRoutes => (
          Icons.alt_route_rounded,
          'Aún no hay rutas',
          'No encontramos rutas registradas en tu zona. Intenta más tarde o pídele a la municipalidad que registre las rutas.',
          AppColors.info,
        ),
      _EmptyKind.noActiveBuses => (
          Icons.directions_bus_outlined,
          'Sin buses ahora mismo',
          'No hay buses transmitiendo en este momento. Aparecerán aquí cuando un conductor inicie su turno.',
          AppColors.gold,
        ),
      _EmptyKind.noFilterMatch => (
          Icons.filter_alt_off_outlined,
          'Sin coincidencias',
          'Ningún bus activo coincide con el filtro elegido. Limpiá el filtro para ver todos.',
          AppColors.ink5,
        ),
    };

    final accentBg = accent == AppColors.gold
        ? AppColors.goldBg
        : accent == AppColors.info
            ? AppColors.infoBg
            : AppColors.ink1;
    final accentBorder = accent == AppColors.gold
        ? AppColors.goldBorder
        : accent == AppColors.info
            ? AppColors.infoBorder
            : AppColors.ink2;

    return Center(
      child: Container(
        margin: const EdgeInsets.all(28),
        padding: const EdgeInsets.fromLTRB(24, 28, 24, 22),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: AppColors.ink2),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 64, height: 64,
              decoration: BoxDecoration(
                color: accentBg,
                shape: BoxShape.circle,
                border: Border.all(color: accentBorder, width: 1.5),
              ),
              child: Icon(icon, size: 30, color: accent),
            ),
            const SizedBox(height: 16),
            Text(
              title,
              textAlign: TextAlign.center,
              style: AppTheme.inter(
                fontSize: 15.5, fontWeight: FontWeight.w800, color: AppColors.ink9),
            ),
            const SizedBox(height: 6),
            Text(
              body,
              textAlign: TextAlign.center,
              style: AppTheme.inter(
                fontSize: 12.5, color: AppColors.ink6, height: 1.4),
            ),
            if (onAction != null && actionLabel != null) ...[
              const SizedBox(height: 16),
              OutlinedButton.icon(
                onPressed: onAction,
                icon: Icon(
                  _kind == _EmptyKind.noFilterMatch
                      ? Icons.filter_alt_off
                      : Icons.refresh,
                  size: 16),
                label: Text(
                  actionLabel!,
                  style: AppTheme.inter(fontSize: 12.5, fontWeight: FontWeight.w700),
                ),
                style: OutlinedButton.styleFrom(
                  foregroundColor: AppColors.ink8,
                  side: const BorderSide(color: AppColors.ink2),
                  padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 10),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

/// Card flotante encima del mapa cuando no hay buses transmitiendo o ningún
/// bus coincide con el filtro. No reemplaza al mapa — el usuario puede seguir
/// viendo su ubicación y las rutas de fondo.
class _MapOverlayBanner extends StatelessWidget {
  final IconData icon;
  final String title;
  final String? actionLabel;
  final VoidCallback? onAction;

  const _MapOverlayBanner({
    required this.icon,
    required this.title,
    this.actionLabel,
    this.onAction,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(10),
        boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.12), blurRadius: 8)],
      ),
      child: Row(children: [
        Icon(icon, size: 16, color: AppColors.ink6),
        const SizedBox(width: 8),
        Expanded(
          child: Text(
            title,
            style: AppTheme.inter(
              fontSize: 12, fontWeight: FontWeight.w600, color: AppColors.ink8),
            maxLines: 1, overflow: TextOverflow.ellipsis,
          ),
        ),
        if (actionLabel != null && onAction != null) ...[
          const SizedBox(width: 8),
          TextButton(
            onPressed: onAction,
            style: TextButton.styleFrom(
              foregroundColor: AppColors.goldDark,
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
              minimumSize: Size.zero,
              tapTargetSize: MaterialTapTargetSize.shrinkWrap,
            ),
            child: Text(
              actionLabel!,
              style: AppTheme.inter(fontSize: 12, fontWeight: FontWeight.w700),
            ),
          ),
        ],
      ]),
    );
  }
}

/// Skeleton de carga adaptado al tab activo.
///
/// - **routes**: 3 cards verticales con shimmer en bloques (badge + título +
///   subtítulo + chip + paradero placeholder).
/// - **list**: 4 filas horizontales con avatar circular + 2 líneas de texto.
/// - **map**: subtle hint con ícono y "Cargando mapa…" (el mapa real
///   aparecerá enseguida; sin skeleton visual completo para no engañar).
///
/// Comparte un único `AnimationController` entre los shimmer boxes para
/// no gastar GPU/memoria con N controllers simultáneos.
class _LoadingSkeleton extends StatefulWidget {
  final _ViewMode view;
  const _LoadingSkeleton({required this.view});

  @override
  State<_LoadingSkeleton> createState() => _LoadingSkeletonState();
}

class _LoadingSkeletonState extends State<_LoadingSkeleton>
    with SingleTickerProviderStateMixin {
  late final AnimationController _ctrl;

  @override
  void initState() {
    super.initState();
    _ctrl = AnimationController(
      duration: const Duration(milliseconds: 1100),
      vsync: this,
    )..repeat();
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    switch (widget.view) {
      case _ViewMode.routes:
        return ListView(
          padding: const EdgeInsets.fromLTRB(12, 10, 12, 16),
          children: [
            _RouteSkeletonCard(controller: _ctrl),
            const SizedBox(height: 8),
            _RouteSkeletonCard(controller: _ctrl),
            const SizedBox(height: 8),
            _RouteSkeletonCard(controller: _ctrl),
          ],
        );
      case _ViewMode.list:
        return ListView.separated(
          padding: const EdgeInsets.fromLTRB(12, 10, 12, 16),
          itemCount: 4,
          separatorBuilder: (_, __) => const SizedBox(height: 8),
          itemBuilder: (_, __) => _BusSkeletonRow(controller: _ctrl),
        );
      case _ViewMode.map:
        return Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const SizedBox(width: 22, height: 22, child: SfitLoading.inline(strokeWidth: 2.2, color: AppColors.gold)),
              const SizedBox(height: 12),
              Text(
                'Cargando mapa…',
                style: AppTheme.inter(fontSize: 12, color: AppColors.ink5, fontWeight: FontWeight.w600),
              ),
            ],
          ),
        );
    }
  }
}

class _RouteSkeletonCard extends StatelessWidget {
  final AnimationController controller;
  const _RouteSkeletonCard({required this.controller});

  @override
  Widget build(BuildContext context) {
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
            _Shimmer(controller: controller, w: 36, h: 22, r: 5),
            const SizedBox(width: 8),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _Shimmer(controller: controller, w: 160, h: 13, r: 4),
                  const SizedBox(height: 6),
                  _Shimmer(controller: controller, w: 90, h: 10, r: 3),
                ],
              ),
            ),
            const SizedBox(width: 8),
            _Shimmer(controller: controller, w: 76, h: 22, r: 999),
          ]),
          const SizedBox(height: 12),
          _Shimmer(controller: controller, w: double.infinity, h: 56, r: 8),
          const SizedBox(height: 12),
          Container(height: 1, color: AppColors.ink1),
          const SizedBox(height: 8),
          _Shimmer(controller: controller, w: 220, h: 11, r: 3),
        ],
      ),
    );
  }
}

class _BusSkeletonRow extends StatelessWidget {
  final AnimationController controller;
  const _BusSkeletonRow({required this.controller});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.ink2),
      ),
      child: Row(children: [
        _Shimmer(controller: controller, w: 44, h: 44, r: 22),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _Shimmer(controller: controller, w: 110, h: 13, r: 4),
              const SizedBox(height: 6),
              _Shimmer(controller: controller, w: 180, h: 10, r: 3),
              const SizedBox(height: 6),
              _Shimmer(controller: controller, w: 140, h: 10, r: 3),
            ],
          ),
        ),
        const SizedBox(width: 8),
        _Shimmer(controller: controller, w: 60, h: 20, r: 999),
      ]),
    );
  }
}

class _Shimmer extends StatelessWidget {
  final AnimationController controller;
  final double w;
  final double h;
  final double r;
  const _Shimmer({required this.controller, required this.w, required this.h, required this.r});

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: controller,
      builder: (_, __) => Container(
        width: w,
        height: h,
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(r),
          gradient: LinearGradient(
            begin: Alignment(-1 + controller.value * 2, -0.3),
            end: Alignment(1 + controller.value * 2, 0.3),
            colors: const [AppColors.ink1, AppColors.ink2, AppColors.ink1],
            stops: const [0.0, 0.5, 1.0],
          ),
        ),
      ),
    );
  }
}
