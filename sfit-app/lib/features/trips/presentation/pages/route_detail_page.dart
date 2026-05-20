import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import '../../../../shared/widgets/map/sfit_map_tiles.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:latlong2/latlong.dart';
import '../../../../core/network/dio_client.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../shared/widgets/sfit_loading.dart';
import '../../../../shared/widgets/widgets.dart';
import '../../../auth/presentation/providers/auth_provider.dart';

/// RF-09: Detalle de ruta asignada al conductor.
/// Incluye mini-mapa con waypoints + polyline y lista interactiva de paradas.
class RouteDetailPage extends ConsumerStatefulWidget {
  final String routeId;
  final String routeName;

  const RouteDetailPage({
    super.key,
    required this.routeId,
    required this.routeName,
  });

  @override
  ConsumerState<RouteDetailPage> createState() => _RouteDetailPageState();
}

class _RouteDetailPageState extends ConsumerState<RouteDetailPage> {
  Map<String, dynamic>? _route;
  bool _loading = true;
  String? _error;
  final MapController _mapController = MapController();
  bool _mapReady = false;
  bool _stopsExpanded = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final dio = ref.read(dioClientProvider).dio;
      final resp = await dio.get('/rutas/${widget.routeId}');
      final body = resp.data as Map<String, dynamic>;
      final data = body['data'] as Map<String, dynamic>? ?? body;
      if (mounted) {
        setState(() {
          _route = data;
          _loading = false;
        });
      }
    } catch (_) {
      if (mounted) {
        setState(() {
          _error = 'No se pudo cargar el detalle de la ruta.';
          _loading = false;
        });
      }
    }
  }

  SfitStatus _parseStatus(String? raw) {
    switch ((raw ?? '').toLowerCase()) {
      case 'activa':
      case 'activo':
      case 'active':
        return SfitStatus.activo;
      case 'en_ruta':
      case 'en ruta':
        return SfitStatus.enRuta;
      case 'inactiva':
      case 'inactivo':
      case 'inactive':
        return SfitStatus.inactivo;
      case 'suspendida':
      case 'suspendido':
        return SfitStatus.suspendido;
      default:
        return SfitStatus.activo;
    }
  }

  List<Map<String, dynamic>> _parseWaypoints() {
    final raw = _route?['waypoints'] as List? ?? [];
    final wps = raw
        .map((w) => w as Map<String, dynamic>)
        .toList()
      ..sort((a, b) =>
          (a['order'] as int? ?? 0).compareTo(b['order'] as int? ?? 0));
    return wps;
  }

  void _centerOnStop(double lat, double lng) {
    if (!_mapReady) return;
    try {
      _mapController.move(LatLng(lat, lng), 16);
    } catch (_) {}
  }

  @override
  Widget build(BuildContext context) {
    final user = ref.read(authProvider).user;
    final isOperador = user?.role == 'operador';

    return Scaffold(
      appBar: AppBar(
        title: Text(widget.routeName),
        leading: const BackButton(),
        actions: [
          if (isOperador)
            IconButton(
              tooltip: 'Editar ruta',
              icon: const Icon(Icons.edit_outlined, size: 20),
              onPressed: () => context.push(
                '/ruta-editar',
                extra: {
                  'routeId': widget.routeId,
                  'routeName': widget.routeName,
                },
              ),
            ),
        ],
      ),
      body: _buildBody(),
    );
  }

  Widget _buildBody() {
    if (_loading) {
      return const SfitLoading.page(color: AppColors.gold);
    }

    if (_error != null) {
      return _ErrorState(message: _error!, onRetry: _load);
    }

    final route = _route!;
    final name = route['name'] as String? ?? widget.routeName;
    final code = route['code'] as String? ?? '';
    final statusRaw = route['status'] as String? ?? 'activa';
    final length = route['length'] as String?;
    final stopsCount = route['stops'] as int?;
    final vehicleTypeKey = route['vehicleTypeKey'] as String?;
    final rawFreqs = route['frequencies'] as List?;
    final frequencies = rawFreqs?.cast<String>() ?? <String>[];
    final waypoints = _parseWaypoints();

    final sfitStatus = _parseStatus(statusRaw);

    return RefreshIndicator(
      onRefresh: _load,
      color: AppColors.gold,
      child: SingleChildScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // ── Hero card ─────────────────────────────────────────
            SfitHeroCard(
              kicker: 'MIS RUTAS',
              title: name,
              rfCode: 'RF-09',
              pills: [
                if (code.isNotEmpty) SfitHeroPill(label: 'Código', value: code),
                SfitHeroPill(label: 'Estado', value: statusRaw),
              ],
            ),
            const SizedBox(height: 20),

            // ── Info de la ruta ───────────────────────────────────
            _SectionCard(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Wrap(
                  spacing: 20,
                  runSpacing: 14,
                  children: [
                    if (length != null)
                      _InfoItem(icon: Icons.straighten, label: 'Longitud', value: length),
                    _InfoItem(
                      icon: Icons.place_outlined,
                      label: 'Paradas',
                      value: '${waypoints.isNotEmpty ? waypoints.length : (stopsCount ?? 0)}',
                    ),
                    if (vehicleTypeKey != null)
                      _InfoItem(icon: Icons.directions_bus_outlined, label: 'Tipo vehículo', value: vehicleTypeKey),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 16),

            // ── Estado ────────────────────────────────────────────
            _SectionCard(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Row(
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'ESTADO DE LA RUTA',
                            style: AppTheme.inter(
                              fontSize: 10,
                              fontWeight: FontWeight.w700,
                              color: AppColors.ink4,
                              letterSpacing: 1.4,
                            ),
                          ),
                          const SizedBox(height: 8),
                          SfitStatusPill(status: sfitStatus, label: statusRaw),
                        ],
                      ),
                    ),
                    if (frequencies.isNotEmpty) ...[
                      Container(width: 1, height: 44, color: AppColors.ink2),
                      const SizedBox(width: 16),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'FRECUENCIA',
                              style: AppTheme.inter(
                                fontSize: 10,
                                fontWeight: FontWeight.w700,
                                color: AppColors.ink4,
                                letterSpacing: 1.4,
                              ),
                            ),
                            const SizedBox(height: 8),
                            Row(
                              children: [
                                const Icon(Icons.schedule, size: 15, color: AppColors.gold),
                                const SizedBox(width: 6),
                                Expanded(
                                  child: Text(
                                    frequencies.join(', '),
                                    style: AppTheme.inter(
                                      fontSize: 13,
                                      fontWeight: FontWeight.w700,
                                      color: AppColors.ink9,
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          ],
                        ),
                      ),
                    ],
                  ],
                ),
              ),
            ),
            const SizedBox(height: 16),

            // ── Mini-mapa con recorrido ───────────────────────────
            if (waypoints.isNotEmpty) ...[
              _SectionCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Padding(
                      padding: const EdgeInsets.fromLTRB(16, 14, 16, 8),
                      child: Row(
                        children: [
                          const Icon(Icons.map_outlined, size: 16, color: AppColors.gold),
                          const SizedBox(width: 8),
                          Text(
                            'RECORRIDO',
                            style: AppTheme.inter(
                              fontSize: 10,
                              fontWeight: FontWeight.w700,
                              color: AppColors.ink4,
                              letterSpacing: 1.4,
                            ),
                          ),
                        ],
                      ),
                    ),
                    ClipRRect(
                      borderRadius: const BorderRadius.only(
                        bottomLeft: Radius.circular(12),
                        bottomRight: Radius.circular(12),
                      ),
                      child: SizedBox(
                        height: 260,
                        child: _RouteMap(
                          waypoints: waypoints,
                          mapController: _mapController,
                          onMapReady: () {
                            if (mounted) setState(() => _mapReady = true);
                          },
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 16),

              // ── Lista de paradas ────────────────────────────────
              _SectionCard(
                child: Column(
                  children: [
                    InkWell(
                      onTap: () => setState(() => _stopsExpanded = !_stopsExpanded),
                      borderRadius: const BorderRadius.vertical(top: Radius.circular(12)),
                      child: Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                        child: Row(
                          children: [
                            const Icon(Icons.format_list_numbered, size: 16, color: AppColors.gold),
                            const SizedBox(width: 8),
                            Text(
                              'PARADAS (${waypoints.length})',
                              style: AppTheme.inter(
                                fontSize: 10,
                                fontWeight: FontWeight.w700,
                                color: AppColors.ink4,
                                letterSpacing: 1.4,
                              ),
                            ),
                            const Spacer(),
                            Icon(
                              _stopsExpanded ? Icons.expand_less : Icons.expand_more,
                              size: 20,
                              color: AppColors.ink4,
                            ),
                          ],
                        ),
                      ),
                    ),
                    if (_stopsExpanded)
                      ...waypoints.asMap().entries.map((entry) {
                        final i = entry.key;
                        final wp = entry.value;
                        final lat = (wp['lat'] as num?)?.toDouble() ?? 0;
                        final lng = (wp['lng'] as num?)?.toDouble() ?? 0;
                        final label = wp['label'] as String? ?? 'Paradero ${(wp['order'] as int? ?? i) + 1}';
                        final isLast = i == waypoints.length - 1;
                        return InkWell(
                          onTap: () => _centerOnStop(lat, lng),
                          child: Container(
                            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                            decoration: BoxDecoration(
                              border: isLast
                                  ? null
                                  : const Border(bottom: BorderSide(color: AppColors.ink1, width: 1)),
                            ),
                            child: Row(
                              children: [
                                Container(
                                  width: 28,
                                  height: 28,
                                  decoration: BoxDecoration(
                                    color: AppColors.goldBg,
                                    border: Border.all(color: AppColors.goldBorder),
                                    shape: BoxShape.circle,
                                  ),
                                  alignment: Alignment.center,
                                  child: Text(
                                    '${(wp['order'] as int? ?? i) + 1}',
                                    style: AppTheme.inter(
                                      fontSize: 11,
                                      fontWeight: FontWeight.w800,
                                      color: AppColors.goldDark,
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
                                        label,
                                        style: AppTheme.inter(
                                          fontSize: 13,
                                          fontWeight: FontWeight.w600,
                                          color: AppColors.ink8,
                                        ),
                                      ),
                                      Text(
                                        '${lat.toStringAsFixed(5)}, ${lng.toStringAsFixed(5)}',
                                        style: AppTheme.inter(
                                          fontSize: 10,
                                          color: AppColors.ink4,
                                          tabular: true,
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                                const Icon(Icons.my_location_outlined, size: 16, color: AppColors.ink4),
                              ],
                            ),
                          ),
                        );
                      }),
                  ],
                ),
              ),
              const SizedBox(height: 24),
            ] else ...[
              // Sin waypoints — placeholder
              _SectionCard(
                child: Padding(
                  padding: const EdgeInsets.all(20),
                  child: Row(
                    children: [
                      const Icon(Icons.info_outline, size: 18, color: AppColors.ink4),
                      const SizedBox(width: 10),
                      Text(
                        stopsCount != null && stopsCount > 0
                            ? '$stopsCount paradas en esta ruta'
                            : 'Sin paradas intermedias registradas',
                        style: AppTheme.inter(fontSize: 13, color: AppColors.ink5),
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 24),
            ],

            FilledButton.icon(
              onPressed: () => context.push(
                '/viaje-checkin',
                extra: {
                  'routeId': widget.routeId,
                  'routeName': widget.routeName,
                },
              ),
              icon: const Icon(Icons.play_arrow_rounded, size: 20),
              label: Text(
                'Iniciar turno en esta ruta',
                style: AppTheme.inter(
                  fontSize: 15,
                  fontWeight: FontWeight.w700,
                  color: Colors.white,
                ),
              ),
              style: FilledButton.styleFrom(
                backgroundColor: AppColors.apto,
                minimumSize: const Size(double.infinity, 52),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ── Mini-mapa con waypoints + polyline ──────────────────────────────────────────
class _RouteMap extends StatefulWidget {
  final List<Map<String, dynamic>> waypoints;
  final MapController mapController;
  final VoidCallback onMapReady;

  const _RouteMap({
    required this.waypoints,
    required this.mapController,
    required this.onMapReady,
  });

  @override
  State<_RouteMap> createState() => _RouteMapState();
}

class _RouteMapState extends State<_RouteMap> {
  int? _selectedIndex;
  LatLngBounds? _bounds;

  List<LatLng> get _points => widget.waypoints.map((w) {
        final lat = (w['lat'] as num?)?.toDouble() ?? 0;
        final lng = (w['lng'] as num?)?.toDouble() ?? 0;
        return LatLng(lat, lng);
      }).toList();

  void _zoomIn() {
    try {
      final z = widget.mapController.camera.zoom;
      widget.mapController.move(widget.mapController.camera.center, z + 1);
    } catch (_) {}
  }

  void _zoomOut() {
    try {
      final z = widget.mapController.camera.zoom;
      widget.mapController.move(widget.mapController.camera.center, z - 1);
    } catch (_) {}
  }

  void _fitBounds() {
    if (_bounds == null) return;
    try {
      widget.mapController.fitCamera(CameraFit.bounds(
        bounds: _bounds!,
        padding: const EdgeInsets.all(36),
      ));
    } catch (_) {}
  }

  void _showStopSheet(int index) {
    final w = widget.waypoints[index];
    final lat = (w['lat'] as num?)?.toDouble() ?? 0;
    final lng = (w['lng'] as num?)?.toDouble() ?? 0;
    final order = (w['order'] as int? ?? index) + 1;
    final isFirst = index == 0;
    final isLast = index == widget.waypoints.length - 1;
    final fallback = isFirst ? 'Origen' : isLast ? 'Destino' : 'Paradero $order';
    final label = w['label'] as String? ?? fallback;

    setState(() => _selectedIndex = index);
    widget.mapController.move(LatLng(lat, lng), 16);

    showModalBottomSheet<void>(
      context: context,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (_) => Padding(
        padding: const EdgeInsets.fromLTRB(20, 14, 20, 22),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Center(
              child: Container(
                width: 36, height: 4,
                margin: const EdgeInsets.only(bottom: 14),
                decoration: BoxDecoration(
                  color: AppColors.ink2,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
            Row(
              children: [
                _StopBadge(
                  index: index,
                  total: widget.waypoints.length,
                  order: order,
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(label,
                          style: AppTheme.inter(
                            fontSize: 16, fontWeight: FontWeight.w800,
                            color: AppColors.ink9)),
                      const SizedBox(height: 2),
                      Text(
                        isFirst ? 'Origen del recorrido'
                            : isLast ? 'Destino del recorrido'
                            : 'Paradero intermedio · #$order',
                        style: AppTheme.inter(fontSize: 12, color: AppColors.ink5),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 14),
            Container(height: 1, color: AppColors.ink1),
            const SizedBox(height: 10),
            Row(
              children: [
                const Icon(Icons.my_location, size: 14, color: AppColors.ink5),
                const SizedBox(width: 6),
                Text('${lat.toStringAsFixed(5)}, ${lng.toStringAsFixed(5)}',
                    style: AppTheme.inter(
                      fontSize: 12, color: AppColors.ink6, tabular: true)),
              ],
            ),
          ],
        ),
      ),
    ).whenComplete(() {
      if (mounted) setState(() => _selectedIndex = null);
    });
  }

  @override
  Widget build(BuildContext context) {
    final points = _points;
    if (points.length >= 2) _bounds = LatLngBounds.fromPoints(points);
    final center = points.isNotEmpty ? points[0] : const LatLng(-13.5319, -71.9675);

    return Stack(
      children: [
        FlutterMap(
          mapController: widget.mapController,
          options: MapOptions(
            initialCenter: center,
            initialZoom: 14,
            minZoom: 3,
            maxZoom: 19,
            onMapReady: () {
              widget.onMapReady();
              if (_bounds != null) {
                try {
                  widget.mapController.fitCamera(CameraFit.bounds(
                    bounds: _bounds!,
                    padding: const EdgeInsets.all(36),
                  ));
                } catch (_) {}
              }
            },
            interactionOptions: const InteractionOptions(
              flags: InteractiveFlag.all & ~InteractiveFlag.rotate,
            ),
          ),
          children: [
            // Tiles OSM estándar (cacheados localmente vía CachedTileProvider).
            sfitOsmTile(),
            // Polyline en doble capa: halo blanco + dorado encima (mejor contraste sobre el mapa)
            if (points.length >= 2) ...[
              PolylineLayer(polylines: [
                Polyline(
                  points: points,
                  color: Colors.white,
                  strokeWidth: 7,
                ),
              ]),
              PolylineLayer(polylines: [
                Polyline(
                  points: points,
                  color: AppColors.gold,
                  strokeWidth: 4.5,
                ),
              ]),
            ],
            // Marcadores de paraderos: origen verde · destino rojo · intermedios dorado
            MarkerLayer(
              markers: widget.waypoints.asMap().entries.map((entry) {
                final i = entry.key;
                final w = entry.value;
                final lat = (w['lat'] as num?)?.toDouble() ?? 0;
                final lng = (w['lng'] as num?)?.toDouble() ?? 0;
                final order = (w['order'] as int? ?? i) + 1;
                final isFirst = i == 0;
                final isLast = i == widget.waypoints.length - 1;
                final selected = _selectedIndex == i;

                return Marker(
                  point: LatLng(lat, lng),
                  width: selected ? 38 : 32,
                  height: selected ? 38 : 32,
                  alignment: Alignment.center,
                  child: GestureDetector(
                    onTap: () => _showStopSheet(i),
                    child: _StopMarker(
                      isFirst: isFirst,
                      isLast: isLast,
                      order: order,
                      selected: selected,
                    ),
                  ),
                );
              }).toList(),
            ),
          ],
        ),
        // Atribución OSM (requerida por la licencia)
        Positioned(
          left: 6, bottom: 6,
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 2),
            decoration: BoxDecoration(
              color: Colors.white.withValues(alpha: 0.85),
              borderRadius: BorderRadius.circular(3),
            ),
            child: Text('© OpenStreetMap',
                style: AppTheme.inter(fontSize: 8.5, color: AppColors.ink6)),
          ),
        ),
        // Controles flotantes: zoom + recentrar
        Positioned(
          right: 8, top: 8,
          child: Column(
            children: [
              _MapControlButton(
                icon: Icons.add,
                tooltip: 'Acercar',
                onTap: _zoomIn,
              ),
              const SizedBox(height: 6),
              _MapControlButton(
                icon: Icons.remove,
                tooltip: 'Alejar',
                onTap: _zoomOut,
              ),
              const SizedBox(height: 6),
              _MapControlButton(
                icon: Icons.center_focus_strong_outlined,
                tooltip: 'Centrar ruta',
                onTap: _fitBounds,
              ),
            ],
          ),
        ),
      ],
    );
  }
}

// ── Marker visual de paradero ───────────────────────────────────────────────────
class _StopMarker extends StatelessWidget {
  final bool isFirst;
  final bool isLast;
  final int order;
  final bool selected;

  const _StopMarker({
    required this.isFirst,
    required this.isLast,
    required this.order,
    required this.selected,
  });

  @override
  Widget build(BuildContext context) {
    final (bg, fg, icon) = isFirst
        ? (AppColors.apto, Colors.white, Icons.play_arrow_rounded)
        : isLast
            ? (AppColors.noApto, Colors.white, Icons.stop_rounded)
            : (AppColors.gold, AppColors.ink9, null);

    return Container(
      decoration: BoxDecoration(
        color: bg,
        shape: BoxShape.circle,
        border: Border.all(color: Colors.white, width: 2.5),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: selected ? 0.35 : 0.22),
            blurRadius: selected ? 8 : 5,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      alignment: Alignment.center,
      child: icon != null
          ? Icon(icon, size: 16, color: fg)
          : Text(
              '$order',
              style: AppTheme.inter(
                fontSize: 11,
                fontWeight: FontWeight.w800,
                color: fg,
                tabular: true,
              ),
            ),
    );
  }
}

// ── Badge de paradero (usado en bottom sheet) ───────────────────────────────────
class _StopBadge extends StatelessWidget {
  final int index;
  final int total;
  final int order;
  const _StopBadge({required this.index, required this.total, required this.order});

  @override
  Widget build(BuildContext context) {
    final isFirst = index == 0;
    final isLast = index == total - 1;
    final (bg, fg, icon) = isFirst
        ? (AppColors.apto, Colors.white, Icons.play_arrow_rounded)
        : isLast
            ? (AppColors.noApto, Colors.white, Icons.stop_rounded)
            : (AppColors.gold, AppColors.ink9, null);

    return Container(
      width: 40, height: 40,
      decoration: BoxDecoration(color: bg, shape: BoxShape.circle),
      alignment: Alignment.center,
      child: icon != null
          ? Icon(icon, size: 20, color: fg)
          : Text('$order',
              style: AppTheme.inter(
                fontSize: 14, fontWeight: FontWeight.w800,
                color: fg, tabular: true)),
    );
  }
}

// ── Botón flotante para controles del mapa ──────────────────────────────────────
class _MapControlButton extends StatelessWidget {
  final IconData icon;
  final String tooltip;
  final VoidCallback onTap;

  const _MapControlButton({
    required this.icon,
    required this.tooltip,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Tooltip(
      message: tooltip,
      child: Material(
        color: Colors.white,
        elevation: 2,
        shape: const CircleBorder(),
        child: InkWell(
          customBorder: const CircleBorder(),
          onTap: onTap,
          child: SizedBox(
            width: 36, height: 36,
            child: Icon(icon, size: 18, color: AppColors.ink8),
          ),
        ),
      ),
    );
  }
}

// ── Item de información ────────────────────────────────────────────────────────
class _InfoItem extends StatelessWidget {
  final IconData icon;
  final String label;
  final String value;
  const _InfoItem({required this.icon, required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: 15, color: AppColors.gold),
        const SizedBox(width: 6),
        Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(label, style: AppTheme.inter(fontSize: 10, color: AppColors.ink4, fontWeight: FontWeight.w600, letterSpacing: 0.6)),
            Text(value, style: AppTheme.inter(fontSize: 13, color: AppColors.ink9, fontWeight: FontWeight.w700)),
          ],
        ),
      ],
    );
  }
}

// ── Card contenedor genérico ───────────────────────────────────────────────────
class _SectionCard extends StatelessWidget {
  final Widget child;
  const _SectionCard({required this.child});

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        border: Border.all(color: AppColors.ink2),
        borderRadius: BorderRadius.circular(12),
      ),
      child: child,
    );
  }
}

// ── Estado de error ────────────────────────────────────────────────────────────
class _ErrorState extends StatelessWidget {
  final String message;
  final VoidCallback onRetry;
  const _ErrorState({required this.message, required this.onRetry});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.error_outline, size: 44, color: AppColors.noApto),
            const SizedBox(height: 12),
            Text(message, textAlign: TextAlign.center, style: AppTheme.inter(fontSize: 13, color: AppColors.ink6)),
            const SizedBox(height: 16),
            FilledButton.icon(
              onPressed: onRetry,
              icon: const Icon(Icons.refresh, size: 18),
              label: const Text('Reintentar'),
              style: FilledButton.styleFrom(backgroundColor: AppColors.gold, minimumSize: const Size(160, 44)),
            ),
          ],
        ),
      ),
    );
  }
}
