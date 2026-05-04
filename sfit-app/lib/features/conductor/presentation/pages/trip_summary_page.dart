import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:latlong2/latlong.dart';
import '../../../../core/network/dio_client.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_theme.dart';

/// Pantalla de resumen al cerrar un FleetEntry. Llamada con
/// `context.push('/conductor/trip-summary/<entryId>')` desde
/// `MyRoutesPage._endTrip` o `TripCheckoutPage`.
///
/// Consulta GET /api/flota/[id] (que incluye trackPoints y métricas
/// calculadas al cerrar: distanceMeters, durationSeconds,
/// routeCompliancePercentage, visitedStops).
class TripSummaryPage extends ConsumerStatefulWidget {
  final String entryId;
  const TripSummaryPage({super.key, required this.entryId});

  @override
  ConsumerState<TripSummaryPage> createState() => _TripSummaryPageState();
}

class _TripSummaryPageState extends ConsumerState<TripSummaryPage> {
  Map<String, dynamic>? _entry;
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() { _loading = true; _error = null; });
    try {
      final dio = ref.read(dioClientProvider).dio;
      final resp = await dio.get('/flota/${widget.entryId}');
      final body = resp.data as Map<String, dynamic>;
      final data = body['data'] as Map<String, dynamic>;
      if (mounted) setState(() { _entry = data; _loading = false; });
    } catch (e) {
      if (mounted) setState(() { _error = 'No se pudo cargar el resumen: $e'; _loading = false; });
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
    final totalStops = waypoints.length;
    final visitedCount = visitedStops.length;

    final tpLatLng = trackPoints
        .where((p) => p['lat'] != null && p['lng'] != null)
        .map((p) => LatLng((p['lat'] as num).toDouble(), (p['lng'] as num).toDouble()))
        .toList();

    return Scaffold(
      backgroundColor: AppColors.paper,
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(20, 24, 20, 24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // ── Hero celebrante ──────────────────────────────
              Center(
                child: Container(
                  width: 84, height: 84,
                  decoration: BoxDecoration(
                    color: AppColors.aptoBg,
                    shape: BoxShape.circle,
                    border: Border.all(color: AppColors.aptoBorder, width: 2),
                  ),
                  child: const Icon(Icons.check_rounded, size: 48, color: AppColors.apto),
                ),
              ),
              const SizedBox(height: 16),
              Center(
                child: Text(
                  '¡Viaje completado!',
                  style: AppTheme.inter(fontSize: 22, fontWeight: FontWeight.w800, color: AppColors.ink9),
                ),
              ),
              const SizedBox(height: 4),
              Center(
                child: Text(
                  plate + (route?['name'] != null ? ' · ${route!['name']}' : ''),
                  textAlign: TextAlign.center,
                  style: AppTheme.inter(fontSize: 13, color: AppColors.ink6),
                ),
              ),
              const SizedBox(height: 24),

              // ── Grid de métricas ──────────────────────────────
              Row(children: [
                Expanded(child: _MetricCard(
                  icon: Icons.straighten_rounded,
                  label: 'Distancia',
                  value: _formatDistance(distanceMeters),
                )),
                const SizedBox(width: 10),
                Expanded(child: _MetricCard(
                  icon: Icons.schedule_rounded,
                  label: 'Duración',
                  value: _formatDuration(durationSeconds),
                )),
              ]),
              const SizedBox(height: 10),
              Row(children: [
                Expanded(child: _MetricCard(
                  icon: Icons.place_outlined,
                  label: 'Paraderos',
                  value: totalStops > 0 ? '$visitedCount / $totalStops' : '$visitedCount',
                )),
                const SizedBox(width: 10),
                Expanded(child: _MetricCard(
                  icon: Icons.verified_outlined,
                  label: 'Cumplimiento',
                  value: compliance != null ? '${compliance.round()}%' : '—',
                  accent: _complianceColor(compliance),
                )),
              ]),
              const SizedBox(height: 20),

              // ── Mapa con trazado real ─────────────────────────
              if (tpLatLng.length >= 2) ...[
                Text('TRAZADO RECORRIDO',
                  style: AppTheme.inter(fontSize: 11, fontWeight: FontWeight.w700, color: AppColors.ink5, letterSpacing: 1.2)),
                const SizedBox(height: 8),
                ClipRRect(
                  borderRadius: BorderRadius.circular(12),
                  child: SizedBox(
                    height: 220,
                    child: FlutterMap(
                      options: MapOptions(
                        initialCenter: tpLatLng[tpLatLng.length ~/ 2],
                        initialZoom: 13,
                        interactionOptions: const InteractionOptions(flags: InteractiveFlag.all),
                      ),
                      children: [
                        TileLayer(
                          urlTemplate: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png',
                          subdomains: const ['a', 'b', 'c', 'd'],
                          userAgentPackageName: 'com.sfit.sfit_app',
                        ),
                        PolylineLayer(polylines: [
                          Polyline(points: tpLatLng, color: AppColors.gold, strokeWidth: 4),
                        ]),
                        // Inicio + fin
                        MarkerLayer(markers: [
                          Marker(
                            point: tpLatLng.first, width: 22, height: 22,
                            child: Container(
                              decoration: BoxDecoration(color: AppColors.apto, shape: BoxShape.circle, border: Border.all(color: Colors.white, width: 2)),
                              alignment: Alignment.center,
                              child: const Icon(Icons.play_arrow_rounded, size: 12, color: Colors.white),
                            ),
                          ),
                          Marker(
                            point: tpLatLng.last, width: 22, height: 22,
                            child: Container(
                              decoration: BoxDecoration(color: AppColors.noApto, shape: BoxShape.circle, border: Border.all(color: Colors.white, width: 2)),
                              alignment: Alignment.center,
                              child: const Icon(Icons.stop_rounded, size: 12, color: Colors.white),
                            ),
                          ),
                          // Paraderos visitados (verdes)
                          ...visitedStops.map((s) => Marker(
                                point: LatLng((s['lat'] as num).toDouble(), (s['lng'] as num).toDouble()),
                                width: 18, height: 18,
                                child: Container(
                                  decoration: BoxDecoration(color: AppColors.apto, shape: BoxShape.circle, border: Border.all(color: Colors.white, width: 2)),
                                ),
                              )),
                        ]),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 20),
              ],

              // ── Lista de paraderos visitados ──────────────────
              if (visitedStops.isNotEmpty) ...[
                Text('PARADEROS VISITADOS',
                  style: AppTheme.inter(fontSize: 11, fontWeight: FontWeight.w700, color: AppColors.ink5, letterSpacing: 1.2)),
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
                        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                        decoration: BoxDecoration(
                          border: Border(bottom: isLast ? BorderSide.none : const BorderSide(color: AppColors.ink1)),
                        ),
                        child: Row(children: [
                          Container(
                            width: 24, height: 24,
                            decoration: const BoxDecoration(color: AppColors.aptoBg, shape: BoxShape.circle),
                            child: const Icon(Icons.check_rounded, size: 14, color: AppColors.apto),
                          ),
                          const SizedBox(width: 10),
                          Expanded(
                            child: Text(
                              s['label'] as String? ?? 'Paradero ${(s['stopIndex'] as num? ?? 0).toInt() + 1}',
                              style: AppTheme.inter(fontSize: 13, fontWeight: FontWeight.w600, color: AppColors.ink9),
                            ),
                          ),
                          Text(
                            _formatTime(s['visitedAt'] as String?),
                            style: AppTheme.inter(fontSize: 12, color: AppColors.ink5, tabular: true),
                          ),
                        ]),
                      );
                    }).toList(),
                  ),
                ),
                const SizedBox(height: 20),
              ],

              // ── Botón Listo ───────────────────────────────────
              SizedBox(
                width: double.infinity,
                height: 52,
                child: FilledButton(
                  onPressed: () => context.go('/home'),
                  style: FilledButton.styleFrom(
                    backgroundColor: AppColors.ink9,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                  child: Text('Listo', style: AppTheme.inter(fontSize: 15, fontWeight: FontWeight.w700, color: Colors.white)),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Color _complianceColor(num? c) {
    if (c == null) return AppColors.ink6;
    if (c >= 80) return AppColors.apto;
    if (c >= 50) return AppColors.riesgo;
    return AppColors.noApto;
  }
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
