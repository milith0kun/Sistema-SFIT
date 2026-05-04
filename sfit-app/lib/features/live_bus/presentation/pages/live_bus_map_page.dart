import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:geolocator/geolocator.dart';
import 'package:latlong2/latlong.dart';
import '../../../../core/network/dio_client.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../auth/presentation/providers/auth_provider.dart';
import 'bus_detail_sheet.dart';
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

enum _ViewMode { map, list }

class _LiveBusMapPageState extends ConsumerState<LiveBusMapPage> {
  final _mapCtl = MapController();
  Timer? _timer;
  List<BusData> _buses = [];
  bool _loading = true;

  // Filtro por route.id (multiselect). Vacío = sin filtro.
  final Set<String> _filterRouteIds = {};
  _ViewMode _view = _ViewMode.list; // arranca en lista (sort por proximidad)

  // GPS del ciudadano
  Position? _userPos;
  bool _gpsRequested = false;

  @override
  void initState() {
    super.initState();
    _bootstrap();
  }

  Future<void> _bootstrap() async {
    // 1) Pedir GPS (no bloquea: si falla, igual carga los buses sin sort).
    await _requestGps();
    // 2) Primer fetch + iniciar polling cada 8s.
    await _fetch();
    _timer = Timer.periodic(const Duration(seconds: 8), (_) => _fetch());
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
      final resp = await dio.get('/public/flota/activas', queryParameters: qp);
      final body = resp.data as Map<String, dynamic>;
      final data = body['data'] as Map<String, dynamic>? ?? body;
      final items = (data['items'] as List? ?? const [])
          .map((e) => BusData.fromJson(e as Map<String, dynamic>))
          .toList();
      if (mounted) setState(() { _buses = items; _loading = false; });
    } catch (_) {
      if (mounted && _loading) setState(() => _loading = false);
    }
  }

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
        // Toggle Mapa | Lista
        Container(
          padding: const EdgeInsets.fromLTRB(12, 10, 12, 6),
          color: Colors.white,
          child: _ViewToggle(
            value: _view,
            onChanged: (v) => setState(() => _view = v),
          ),
        ),
        // Chips de filtro por ruta
        if (_availableRoutes.length > 1)
          SizedBox(
            height: 40,
            child: ListView.separated(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
              scrollDirection: Axis.horizontal,
              itemCount: _availableRoutes.length,
              separatorBuilder: (_, __) => const SizedBox(width: 6),
              itemBuilder: (_, i) {
                final r = _availableRoutes[i];
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
              : filtered.isEmpty
                  ? _EmptyState(noBuses: _buses.isEmpty)
                  : _view == _ViewMode.map
                      ? _MapView(
                          buses: filtered,
                          mapCtl: _mapCtl,
                          userPos: _userPos,
                          statusColor: _statusColor,
                          onTapBus: (b) => BusDetailSheet.show(context, b),
                        )
                      : _ListView(
                          buses: filtered,
                          statusColor: _statusColor,
                          formatDistance: _formatDistance,
                          formatEta: _formatEta,
                          hasUserGps: _userPos != null,
                          onTapBus: (b) => BusDetailSheet.show(context, b),
                        ),
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
        _segment(_ViewMode.list, Icons.list_rounded, 'Lista'),
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
  final MapController mapCtl;
  final Position? userPos;
  final Color Function(String) statusColor;
  final void Function(BusData) onTapBus;

  const _MapView({
    required this.buses,
    required this.mapCtl,
    required this.userPos,
    required this.statusColor,
    required this.onTapBus,
  });

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
        // Marcadores de buses
        MarkerLayer(
          markers: buses.map((b) {
            final color = statusColor(b.vehicleStatus);
            return Marker(
              point: LatLng(b.lat, b.lng),
              width: 44, height: 44,
              child: GestureDetector(
                onTap: () => onTapBus(b),
                child: Container(
                  decoration: BoxDecoration(
                    color: color,
                    shape: BoxShape.circle,
                    border: Border.all(color: Colors.white, width: 2.5),
                    boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.2), blurRadius: 6)],
                  ),
                  child: const Icon(Icons.directions_bus_rounded, size: 20, color: Colors.white),
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
