import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:latlong2/latlong.dart';
import '../../../../core/network/dio_client.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_theme.dart';
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
      return const Center(
        child: CircularProgressIndicator(color: AppColors.gold),
      );
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
                        height: 210,
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
class _RouteMap extends StatelessWidget {
  final List<Map<String, dynamic>> waypoints;
  final MapController mapController;
  final VoidCallback onMapReady;

  const _RouteMap({
    required this.waypoints,
    required this.mapController,
    required this.onMapReady,
  });

  @override
  Widget build(BuildContext context) {
    final points = waypoints.map((w) {
      final lat = (w['lat'] as num?)?.toDouble() ?? 0;
      final lng = (w['lng'] as num?)?.toDouble() ?? 0;
      return LatLng(lat, lng);
    }).toList();

    // Calcular bounds
    LatLngBounds? bounds;
    if (points.length >= 2) {
      bounds = LatLngBounds.fromPoints(points);
    }

    final center = points.isNotEmpty ? points[0] : const LatLng(-13.5319, -71.9675);

    return FlutterMap(
      mapController: mapController,
      options: MapOptions(
        initialCenter: center,
        initialZoom: 14,
        onMapReady: () {
          onMapReady();
          if (bounds != null) {
            try {
              mapController.fitCamera(CameraFit.bounds(
                bounds: bounds,
                padding: const EdgeInsets.all(24),
              ));
            } catch (_) {}
          }
        },
        interactionOptions: const InteractionOptions(
          flags: InteractiveFlag.pinchZoom | InteractiveFlag.drag,
        ),
      ),
      children: [
        TileLayer(
          urlTemplate: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png',
          subdomains: const ['a', 'b', 'c', 'd'],
          userAgentPackageName: 'com.sfit.sfit_app',
        ),
        // Polyline azul del recorrido
        if (points.length >= 2)
          PolylineLayer(
            polylines: [
              Polyline(
                points: points,
                color: const Color(0x993B82F6),
                strokeWidth: 3.5,
              ),
            ],
          ),
        // Marcadores de paraderos
        MarkerLayer(
          markers: waypoints.asMap().entries.map((entry) {
            final i = entry.key;
            final w = entry.value;
            final lat = (w['lat'] as num?)?.toDouble() ?? 0;
            final lng = (w['lng'] as num?)?.toDouble() ?? 0;
            final order = (w['order'] as int? ?? i) + 1;
            return Marker(
              point: LatLng(lat, lng),
              width: 28,
              height: 28,
              child: Container(
                width: 28,
                height: 28,
                decoration: BoxDecoration(
                  color: Colors.white,
                  shape: BoxShape.circle,
                  border: Border.all(color: AppColors.ink3, width: 2),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withValues(alpha: 0.15),
                      blurRadius: 4,
                      offset: const Offset(0, 1),
                    ),
                  ],
                ),
                alignment: Alignment.center,
                child: Text(
                  '$order',
                  style: AppTheme.inter(
                    fontSize: 10,
                    fontWeight: FontWeight.w800,
                    color: AppColors.ink7,
                  ),
                ),
              ),
            );
          }).toList(),
        ),
      ],
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
