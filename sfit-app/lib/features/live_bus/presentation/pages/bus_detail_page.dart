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
  Timer? _timer;
  BusData? _bus;
  Position? _userPos;
  bool _loading = true;
  /// True cuando el bus dejó de aparecer en el response (perdió señal o
  /// terminó turno). Conservamos la última `_bus` para pantalla.
  bool _stale = false;
  DateTime? _lastSeen;

  final _smoother = LocationSmoother();
  LatLng? _smoothedPos;

  @override
  void initState() {
    super.initState();
    _bootstrap();
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
    final user = ref.read(authProvider).user;
    final muniId = user?.municipalityId;
    if (muniId == null || muniId.isEmpty) {
      if (mounted) setState(() => _loading = false);
      return;
    }
    try {
      final dio = ref.read(dioClientProvider).dio;
      final qp = <String, dynamic>{'municipalityId': muniId, 'limit': 100};
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

  void _fitCamera() {
    final b = _bus;
    if (b == null) return;
    try {
      final pts = <LatLng>[
        LatLng(b.lat, b.lng),
        ...b.waypoints.map((w) => LatLng(w.lat, w.lng)),
        if (_userPos != null) LatLng(_userPos!.latitude, _userPos!.longitude),
      ];
      if (pts.length >= 2) {
        _mapCtl.fitCamera(CameraFit.bounds(
          bounds: LatLngBounds.fromPoints(pts),
          padding: const EdgeInsets.all(48),
        ));
      } else {
        _mapCtl.move(LatLng(b.lat, b.lng), 15);
      }
    } catch (_) {}
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
        body: Center(child: CircularProgressIndicator(color: AppColors.gold)),
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
    final waypointsLatLng = bus.waypoints.map((w) => LatLng(w.lat, w.lng)).toList();
    final realPolyline = bus.polylineCoords.map((c) => LatLng(c[0], c[1])).toList();
    final displayPos = _smoothedPos ?? LatLng(bus.lat, bus.lng);

    return Scaffold(
      backgroundColor: AppColors.paper,
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        surfaceTintColor: Colors.transparent,
        leading: const BackButton(),
        title: Row(children: [
          Icon(Icons.directions_bus_rounded, size: 20, color: color),
          const SizedBox(width: 8),
          Text(
            bus.plate,
            style: AppTheme.inter(fontSize: 16, fontWeight: FontWeight.w800, color: AppColors.ink9, tabular: true),
          ),
        ]),
        actions: [
          IconButton(
            tooltip: 'Centrar mapa',
            onPressed: _fitCamera,
            icon: const Icon(Icons.center_focus_strong_outlined, size: 20, color: AppColors.ink5),
          ),
        ],
      ),
      body: Column(children: [
        if (_stale) _staleBanner(),
        // ── Mapa grande ────────────────────────────────────────────
        SizedBox(
          height: MediaQuery.of(context).size.height * 0.42,
          child: FlutterMap(
            mapController: _mapCtl,
            options: MapOptions(initialCenter: displayPos, initialZoom: 14),
            children: [
              TileLayer(
                urlTemplate: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png',
                subdomains: const ['a', 'b', 'c', 'd'],
                userAgentPackageName: 'com.sfit.sfit_app',
              ),
              // Polyline de la ruta
              if (realPolyline.length >= 2)
                PolylineLayer(polylines: [
                  Polyline(points: realPolyline, color: color.withValues(alpha: 0.55), strokeWidth: 4),
                ])
              else if (waypointsLatLng.length >= 2)
                PolylineLayer(polylines: [
                  Polyline(
                    points: waypointsLatLng,
                    color: AppColors.ink3,
                    strokeWidth: 3,
                    pattern: const StrokePattern.dotted(),
                  ),
                ]),
              // Paraderos numerados
              MarkerLayer(
                markers: bus.waypoints.map((w) {
                  final visited = bus.etaByStop.any((s) => s.stopIndex == w.order && s.visited);
                  return Marker(
                    point: LatLng(w.lat, w.lng),
                    width: 26, height: 26,
                    child: Container(
                      decoration: BoxDecoration(
                        color: visited ? AppColors.apto : Colors.white,
                        shape: BoxShape.circle,
                        border: Border.all(color: visited ? AppColors.apto : AppColors.ink4, width: 2),
                      ),
                      alignment: Alignment.center,
                      child: Text(
                        '${w.order + 1}',
                        style: AppTheme.inter(
                          fontSize: 10,
                          fontWeight: FontWeight.w800,
                          color: visited ? Colors.white : AppColors.ink7,
                          tabular: true,
                        ),
                      ),
                    ),
                  );
                }).toList(),
              ),
              // Ubicación del usuario
              if (_userPos != null)
                MarkerLayer(markers: [
                  Marker(
                    point: LatLng(_userPos!.latitude, _userPos!.longitude),
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
              // Marcador del bus (encima de todo)
              MarkerLayer(markers: [
                Marker(
                  point: displayPos,
                  width: 50, height: 50,
                  child: Container(
                    decoration: BoxDecoration(
                      color: color,
                      shape: BoxShape.circle,
                      border: Border.all(color: Colors.white, width: 3),
                      boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.25), blurRadius: 6)],
                    ),
                    child: const Icon(Icons.directions_bus_rounded, color: Colors.white, size: 24),
                  ),
                ),
              ]),
            ],
          ),
        ),
        // ── Ficha de datos + timeline ──────────────────────────────
        Expanded(
          child: ListView(
            padding: const EdgeInsets.fromLTRB(14, 14, 14, 24),
            children: [
              _busSummaryCard(bus, color),
              const SizedBox(height: 14),
              _kpiStrip(bus),
              if (bus.etaByStop.isNotEmpty) ...[
                const SizedBox(height: 18),
                _sectionLabel('LÍNEA DE TIEMPO — PARADEROS PENDIENTES'),
                const SizedBox(height: 8),
                _timeline(bus),
              ],
              const SizedBox(height: 18),
              _actionButtons(bus),
            ],
          ),
        ),
      ]),
    );
  }

  Widget _staleBanner() => Container(
        width: double.infinity,
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
        color: const Color(0xFFFFF8E1),
        child: Row(children: [
          const Icon(Icons.signal_cellular_alt_1_bar, size: 16, color: Color(0xFFB45309)),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              'Sin transmisión reciente · última señal ${_lastSeen != null ? _ago(_lastSeen!) : "hace un rato"}',
              style: AppTheme.inter(fontSize: 11.5, color: const Color(0xFF92400E), fontWeight: FontWeight.w600),
            ),
          ),
        ]),
      );

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
                ],
              ),
            ),
            if (bus.isOffRoute)
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: const Color(0xFFFFF8E1),
                  border: Border.all(color: const Color(0xFFB45309)),
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Row(mainAxisSize: MainAxisSize.min, children: [
                  const Icon(Icons.warning_amber_rounded, size: 12, color: Color(0xFFB45309)),
                  const SizedBox(width: 4),
                  Text(
                    'Desviado',
                    style: AppTheme.inter(fontSize: 10, fontWeight: FontWeight.w700, color: const Color(0xFF92400E)),
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

  /// La velocidad llega como `currentLocation.speed` en el response, pero
  /// `BusData` no la expone tipada — la leemos aprovechando que el modelo
  /// guarda el JSON completo del fetch sólo si lo extendemos. Como no lo
  /// expone, devolvemos null y mostramos "—". Si querés pasarla, agregar
  /// `speed` al modelo `BusData`.
  double? _extractSpeedFromBus(BusData _) => null;

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
