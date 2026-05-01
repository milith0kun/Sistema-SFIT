import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:latlong2/latlong.dart';
import '../../../../core/network/dio_client.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../auth/presentation/providers/auth_provider.dart';

class LiveBusMapPage extends ConsumerStatefulWidget {
  const LiveBusMapPage({super.key});
  @override
  ConsumerState<LiveBusMapPage> createState() => _LiveBusMapPageState();
}

class _LiveBusMapPageState extends ConsumerState<LiveBusMapPage> {
  final _mapCtl = MapController();
  Timer? _timer;
  List<_BusData> _buses = [];
  bool _loading = true;
  String? _selectedBusId;

  @override
  void initState() {
    super.initState();
    _fetch();
    _timer = Timer.periodic(const Duration(seconds: 8), (_) => _fetch());
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
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
      final resp = await dio.get('/public/flota/activas', queryParameters: {'municipalityId': muniId});
      final body = resp.data as Map<String, dynamic>;
      final data = body['data'] as Map<String, dynamic>? ?? body;
      final items = (data['items'] as List? ?? []).map((e) => _BusData.fromJson(e as Map<String, dynamic>)).toList();
      if (mounted) setState(() { _buses = items; _loading = false; });
    } catch (_) {
      if (mounted && _loading) setState(() => _loading = false);
    }
  }

  _BusData? get _selectedBus {
    if (_selectedBusId == null) return null;
    try { return _buses.firstWhere((b) => b.id == _selectedBusId); } catch (_) { return null; }
  }

  Color _statusColor(String s) => switch (s) {
    'apto' => AppColors.apto,
    'riesgo' => AppColors.riesgo,
    _ => AppColors.noApto,
  };

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.paper,
      appBar: AppBar(
        backgroundColor: Colors.white, elevation: 0, surfaceTintColor: Colors.transparent,
        leading: const BackButton(),
        title: Row(children: [
          const Icon(Icons.directions_bus_rounded, size: 20, color: AppColors.gold),
          const SizedBox(width: 8),
          Text('Buses en vivo', style: AppTheme.inter(fontSize: 16, fontWeight: FontWeight.w700, color: AppColors.ink9)),
          const SizedBox(width: 8),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
            decoration: BoxDecoration(color: AppColors.aptoBg, border: Border.all(color: AppColors.aptoBorder), borderRadius: BorderRadius.circular(999)),
            child: Text('${_buses.length}', style: AppTheme.inter(fontSize: 10, fontWeight: FontWeight.w700, color: AppColors.apto, tabular: true)),
          ),
        ]),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator(color: AppColors.gold))
          : Stack(children: [
              FlutterMap(
                mapController: _mapCtl,
                options: MapOptions(
                  initialCenter: _buses.isNotEmpty ? LatLng(_buses.first.lat, _buses.first.lng) : const LatLng(-13.5319, -71.9675),
                  initialZoom: 14,
                  onTap: (_, __) { if (_selectedBusId != null) setState(() => _selectedBusId = null); },
                ),
                children: [
                  TileLayer(
                    urlTemplate: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png',
                    subdomains: const ['a', 'b', 'c', 'd'],
                    userAgentPackageName: 'com.sfit.sfit_app',
                  ),
                  // Polyline del bus seleccionado
                  if (_selectedBus?.waypoints != null && _selectedBus!.waypoints!.length >= 2)
                    PolylineLayer(polylines: [
                      Polyline(points: _selectedBus!.waypoints!.map((w) => LatLng(w['lat'] as double, w['lng'] as double)).toList(), color: AppColors.ink3, strokeWidth: 3),
                    ]),
                  // Paradas del bus seleccionado
                  if (_selectedBus?.waypoints != null)
                    MarkerLayer(markers: _selectedBus!.waypoints!.asMap().entries.map((e) {
                      final w = e.value;
                      return Marker(
                        point: LatLng(w['lat'] as double, w['lng'] as double),
                        width: 22, height: 22,
                        child: Container(width: 22, height: 22,
                          decoration: BoxDecoration(color: Colors.white, shape: BoxShape.circle, border: Border.all(color: AppColors.ink3, width: 1.5)),
                          alignment: Alignment.center,
                          child: Text('${e.key + 1}', style: AppTheme.inter(fontSize: 8, fontWeight: FontWeight.w800, color: AppColors.ink6)),
                        ),
                      );
                    }).toList()),
                  // Marcadores de buses
                  MarkerLayer(markers: _buses.map((b) {
                    final selected = b.id == _selectedBusId;
                    return Marker(
                      point: LatLng(b.lat, b.lng), width: 44, height: 44,
                      child: GestureDetector(
                        onTap: () => setState(() => _selectedBusId = b.id),
                        child: Container(
                          decoration: BoxDecoration(
                            color: selected ? _statusColor(b.vehicleStatus) : Colors.white,
                            shape: BoxShape.circle,
                            border: Border.all(color: _statusColor(b.vehicleStatus), width: 2.5),
                            boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.2), blurRadius: 6)],
                          ),
                          child: Icon(Icons.directions_bus_rounded, size: 20, color: selected ? Colors.white : _statusColor(b.vehicleStatus)),
                        ),
                      ),
                    );
                  }).toList()),
                ],
              ),
              // Empty state
              if (_buses.isEmpty && !_loading)
                Center(child: Container(
                  margin: const EdgeInsets.all(32), padding: const EdgeInsets.all(24),
                  decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(16), border: Border.all(color: AppColors.ink2)),
                  child: Column(mainAxisSize: MainAxisSize.min, children: [
                    Container(width: 56, height: 56, decoration: BoxDecoration(color: AppColors.goldBg, shape: BoxShape.circle, border: Border.all(color: AppColors.goldBorder)), child: const Icon(Icons.directions_bus_outlined, size: 28, color: AppColors.goldDark)),
                    const SizedBox(height: 14),
                    Text('Sin buses activos', style: AppTheme.inter(fontSize: 15, fontWeight: FontWeight.w700, color: AppColors.ink9)),
                    const SizedBox(height: 4),
                    Text('No hay buses con turno activo en tu municipio en este momento.', textAlign: TextAlign.center, style: AppTheme.inter(fontSize: 12, color: AppColors.ink5)),
                  ]),
                )),
              // Bottom sheet del bus seleccionado
              if (_selectedBus != null)
                Positioned(bottom: 16, left: 16, right: 16, child: _BusSheet(bus: _selectedBus!, statusColor: _statusColor(_selectedBus!.vehicleStatus))),
            ]),
    );
  }
}

class _BusSheet extends StatelessWidget {
  final _BusData bus;
  final Color statusColor;
  const _BusSheet({required this.bus, required this.statusColor});

  String _formatEta(int? s) {
    if (s == null) return '—';
    if (s < 60) return '< 1 min';
    final m = (s / 60).round();
    return '~$m min';
  }

  String _timeAgo(String? iso) {
    if (iso == null) return '—';
    try {
      final dt = DateTime.parse(iso);
      final diff = DateTime.now().difference(dt).inSeconds;
      if (diff < 10) return 'ahora';
      if (diff < 60) return 'hace ${diff}s';
      return 'hace ${(diff / 60).round()} min';
    } catch (_) { return '—'; }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white, borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.ink2),
        boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.12), blurRadius: 16, offset: const Offset(0, -4))],
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: [
        // Header: placa + tipo + estado
        Row(children: [
          Icon(Icons.directions_bus_rounded, size: 22, color: statusColor),
          const SizedBox(width: 8),
          Text(bus.plate, style: AppTheme.inter(fontSize: 16, fontWeight: FontWeight.w800, color: AppColors.ink9)),
          const SizedBox(width: 8),
          Text('· ${bus.vehicleType}', style: AppTheme.inter(fontSize: 12, color: AppColors.ink5)),
          const Spacer(),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
            decoration: BoxDecoration(color: statusColor.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(999), border: Border.all(color: statusColor.withValues(alpha: 0.3))),
            child: Text(bus.vehicleStatus.toUpperCase(), style: AppTheme.inter(fontSize: 9, fontWeight: FontWeight.w700, color: statusColor, letterSpacing: 0.8)),
          ),
        ]),
        if (bus.routeName != null) ...[
          const SizedBox(height: 8),
          Text('Ruta: ${bus.routeName}', style: AppTheme.inter(fontSize: 13, fontWeight: FontWeight.w600, color: AppColors.ink7)),
        ],
        const SizedBox(height: 10),
        Container(height: 1, color: AppColors.ink1),
        const SizedBox(height: 10),
        // ETA + última actualización
        Row(children: [
          const Icon(Icons.place_outlined, size: 16, color: AppColors.gold),
          const SizedBox(width: 6),
          Expanded(child: bus.nextStopLabel != null
              ? RichText(text: TextSpan(style: AppTheme.inter(fontSize: 12, color: AppColors.ink7), children: [
                  TextSpan(text: 'Próximo: ', style: AppTheme.inter(fontSize: 12, color: AppColors.ink5)),
                  TextSpan(text: bus.nextStopLabel!, style: AppTheme.inter(fontSize: 12, fontWeight: FontWeight.w700, color: AppColors.ink9)),
                  TextSpan(text: ' · llega en ${_formatEta(bus.nextStopEta)}', style: AppTheme.inter(fontSize: 12, color: AppColors.gold, fontWeight: FontWeight.w600)),
                ]))
              : Text('Sin paradero próximo', style: AppTheme.inter(fontSize: 12, color: AppColors.ink5))),
        ]),
        const SizedBox(height: 6),
        Row(children: [
          const Icon(Icons.access_time, size: 14, color: AppColors.ink4),
          const SizedBox(width: 6),
          Text('Última actualización: ${_timeAgo(bus.locationUpdatedAt)}', style: AppTheme.inter(fontSize: 11, color: AppColors.ink4)),
        ]),
        const SizedBox(height: 12),
        SizedBox(
          width: double.infinity,
          child: OutlinedButton.icon(
            onPressed: () => context.push('/vehiculo-publico/${bus.plate}'),
            icon: const Icon(Icons.open_in_new_rounded, size: 16),
            label: Text('Ver vehículo', style: AppTheme.inter(fontSize: 13, fontWeight: FontWeight.w600)),
            style: OutlinedButton.styleFrom(foregroundColor: AppColors.gold, side: const BorderSide(color: AppColors.goldBorder), minimumSize: const Size(0, 42), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10))),
          ),
        ),
      ]),
    );
  }
}

class _BusData {
  final String id, plate, vehicleType, vehicleStatus;
  final double lat, lng;
  final String? routeName, nextStopLabel, locationUpdatedAt;
  final int? nextStopEta;
  final List<Map<String, dynamic>>? waypoints;

  _BusData({required this.id, required this.plate, required this.vehicleType, required this.vehicleStatus, required this.lat, required this.lng, this.routeName, this.nextStopLabel, this.nextStopEta, this.locationUpdatedAt, this.waypoints});

  factory _BusData.fromJson(Map<String, dynamic> j) {
    final loc = j['currentLocation'] as Map<String, dynamic>? ?? {};
    final route = j['route'] as Map<String, dynamic>?;
    final ns = j['nextStop'] as Map<String, dynamic>?;
    return _BusData(
      id: j['id'] as String? ?? '',
      plate: j['plate'] as String? ?? '—',
      vehicleType: j['vehicleType'] as String? ?? 'omnibus',
      vehicleStatus: j['vehicleStatus'] as String? ?? 'apto',
      lat: (loc['lat'] as num?)?.toDouble() ?? 0,
      lng: (loc['lng'] as num?)?.toDouble() ?? 0,
      locationUpdatedAt: loc['updatedAt']?.toString(),
      routeName: route?['name'] as String?,
      waypoints: (route?['waypoints'] as List?)?.cast<Map<String, dynamic>>(),
      nextStopLabel: ns?['label'] as String?,
      nextStopEta: ns?['etaSeconds'] as int?,
    );
  }
}
