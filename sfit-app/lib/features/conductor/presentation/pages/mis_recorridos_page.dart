import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:latlong2/latlong.dart';
import '../../../../core/network/dio_client.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_theme.dart';

/// Pantalla "Mis recorridos" — lista todos los turnos pasados del conductor
/// con un mapa miniatura del trazo recorrido. Es la representación visual
/// de la ruta orgánica que el conductor va construyendo cada día.
class MisRecorridosPage extends ConsumerStatefulWidget {
  const MisRecorridosPage({super.key});

  @override
  ConsumerState<MisRecorridosPage> createState() => _MisRecorridosPageState();
}

class _MisRecorridosPageState extends ConsumerState<MisRecorridosPage> {
  bool _loading = true;
  String? _error;
  List<Map<String, dynamic>> _items = [];

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() { _loading = true; _error = null; });
    try {
      final dio = ref.read(dioClientProvider).dio;
      final resp = await dio.get('/conductor/mis-recorridos', queryParameters: {'limit': 30});
      final body = resp.data as Map<String, dynamic>;
      final data = body['data'] as Map<String, dynamic>? ?? body;
      final items = (data['items'] as List? ?? const []).cast<Map<String, dynamic>>();
      if (!mounted) return;
      setState(() { _items = items; _loading = false; });
    } catch (_) {
      if (mounted) {
        setState(() {
          _error = 'No se pudieron cargar tus recorridos.';
          _loading = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.paper,
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        surfaceTintColor: Colors.transparent,
        leading: const BackButton(),
        title: Text(
          'Mis recorridos',
          style: AppTheme.inter(fontSize: 16, fontWeight: FontWeight.w700, color: AppColors.ink9),
        ),
      ),
      body: RefreshIndicator(
        onRefresh: _load,
        color: AppColors.gold,
        child: _loading
            ? const Center(child: CircularProgressIndicator(color: AppColors.gold))
            : _error != null
                ? _ErrorState(message: _error!, onRetry: _load)
                : _items.isEmpty
                    ? const _EmptyState()
                    : ListView.separated(
                        padding: const EdgeInsets.fromLTRB(14, 14, 14, 24),
                        itemCount: _items.length,
                        separatorBuilder: (_, __) => const SizedBox(height: 10),
                        itemBuilder: (_, i) => _RecorridoCard(
                          data: _items[i],
                          onTap: () {
                            // Próximo: detalle full-screen del recorrido.
                            // Por ahora, abrimos la página del bus en vivo si el turno
                            // sigue en_ruta para reusar el mapa interactivo.
                            final id = _items[i]['id'] as String;
                            final status = _items[i]['status'] as String?;
                            if (status == 'en_ruta') {
                              context.push('/buses-en-vivo/$id');
                            } else {
                              ScaffoldMessenger.of(context).showSnackBar(
                                const SnackBar(
                                  content: Text('Detalle de recorrido cerrado: próximamente'),
                                  behavior: SnackBarBehavior.floating,
                                ),
                              );
                            }
                          },
                        ),
                      ),
      ),
    );
  }
}

class _RecorridoCard extends StatelessWidget {
  final Map<String, dynamic> data;
  final VoidCallback onTap;
  const _RecorridoCard({required this.data, required this.onTap});

  static String _formatDuration(int? secs) {
    if (secs == null || secs < 0) return '—';
    final h = secs ~/ 3600;
    final m = (secs % 3600) ~/ 60;
    if (h > 0) return '${h}h ${m}m';
    return '${m}m';
  }

  static String _formatDistance(num? m) {
    if (m == null) return '—';
    if (m < 1000) return '${m.round()}m';
    return '${(m / 1000).toStringAsFixed(1)}km';
  }

  @override
  Widget build(BuildContext context) {
    final status = data['status'] as String? ?? '—';
    final track = (data['track'] as List? ?? const [])
        .map((p) => LatLng(
            (p['lat'] as num).toDouble(),
            (p['lng'] as num).toDouble()))
        .toList();
    final route = data['routeName'] as String?;
    final routeCode = data['routeCode'] as String?;
    final plate = data['vehiclePlate'] as String? ?? '—';
    final dateRaw = data['date'] as String?;
    final dateStr = dateRaw != null
        ? DateFormat('EEE, d MMM', 'es').format(DateTime.parse(dateRaw).toLocal())
        : '—';
    final dep = data['departureTime'] as String?;
    final ret = data['returnTime'] as String?;
    final duration = _formatDuration((data['durationSeconds'] as num?)?.toInt());
    final distance = _formatDistance(data['distanceMeters'] as num?);
    final visited = (data['visitedStopsCount'] as num?)?.toInt() ?? 0;
    final compliance = (data['routeCompliancePercentage'] as num?)?.toInt();

    final (statusLabel, statusColor, statusBg, statusBorder) = switch (status) {
      'en_ruta' => ('En ruta', AppColors.gold, AppColors.goldBg, AppColors.goldBorder),
      'cerrado' => ('Cerrado', AppColors.apto, AppColors.aptoBg, AppColors.aptoBorder),
      'auto_cierre' => ('Auto-cierre', AppColors.riesgo, AppColors.riesgoBg, AppColors.riesgoBorder),
      _ => ('—', AppColors.ink5, AppColors.ink1, AppColors.ink2),
    };

    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(14),
      child: Container(
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: AppColors.ink2),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // ── Mini mapa del trazo (aspecto 16:9) ──────────────────
            ClipRRect(
              borderRadius: const BorderRadius.vertical(top: Radius.circular(14)),
              child: AspectRatio(
                aspectRatio: 16 / 9,
                child: track.length >= 2
                    ? Stack(children: [
                        FlutterMap(
                          options: MapOptions(
                            initialCameraFit: CameraFit.bounds(
                              bounds: LatLngBounds.fromPoints(track),
                              padding: const EdgeInsets.all(20),
                            ),
                            interactionOptions: const InteractionOptions(
                              flags: InteractiveFlag.none,
                            ),
                          ),
                          children: [
                            TileLayer(
                              urlTemplate: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png',
                              subdomains: const ['a', 'b', 'c', 'd'],
                              userAgentPackageName: 'com.sfit.sfit_app',
                            ),
                            PolylineLayer(polylines: [
                              Polyline(
                                points: track,
                                color: statusColor.withValues(alpha: 0.85),
                                strokeWidth: 3.5,
                              ),
                            ]),
                            MarkerLayer(markers: [
                              // Inicio (verde) y fin (rojo) del recorrido
                              Marker(
                                point: track.first,
                                width: 14, height: 14,
                                child: Container(
                                  decoration: BoxDecoration(
                                    color: AppColors.apto,
                                    shape: BoxShape.circle,
                                    border: Border.all(color: Colors.white, width: 2),
                                  ),
                                ),
                              ),
                              Marker(
                                point: track.last,
                                width: 14, height: 14,
                                child: Container(
                                  decoration: BoxDecoration(
                                    color: AppColors.noApto,
                                    shape: BoxShape.circle,
                                    border: Border.all(color: Colors.white, width: 2),
                                  ),
                                ),
                              ),
                            ]),
                          ],
                        ),
                        Positioned(
                          top: 8, right: 8,
                          child: _StatusPill(
                            label: statusLabel,
                            color: statusColor,
                            bg: statusBg,
                            border: statusBorder,
                          ),
                        ),
                      ])
                    : Container(
                        color: AppColors.ink1,
                        alignment: Alignment.center,
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            const Icon(Icons.route_outlined, size: 32, color: AppColors.ink4),
                            const SizedBox(height: 4),
                            Text(
                              'Sin trazo registrado',
                              style: AppTheme.inter(fontSize: 11.5, color: AppColors.ink5),
                            ),
                          ],
                        ),
                      ),
              ),
            ),
            // ── Info del turno ──────────────────────────────────────
            Padding(
              padding: const EdgeInsets.fromLTRB(14, 12, 14, 12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(children: [
                    Text(
                      plate,
                      style: AppTheme.inter(
                        fontSize: 15, fontWeight: FontWeight.w800,
                        color: AppColors.ink9, tabular: true),
                    ),
                    if (routeCode != null) ...[
                      const SizedBox(width: 8),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                        decoration: BoxDecoration(
                          color: AppColors.ink9,
                          borderRadius: BorderRadius.circular(4),
                        ),
                        child: Text(
                          routeCode,
                          style: AppTheme.inter(
                            fontSize: 10, fontWeight: FontWeight.w800,
                            color: Colors.white, letterSpacing: 0.4),
                        ),
                      ),
                    ],
                    const Spacer(),
                    Text(
                      dateStr,
                      style: AppTheme.inter(fontSize: 11.5, color: AppColors.ink5),
                    ),
                  ]),
                  if (route != null) ...[
                    const SizedBox(height: 2),
                    Text(
                      route,
                      style: AppTheme.inter(fontSize: 12.5, color: AppColors.ink6),
                      maxLines: 1, overflow: TextOverflow.ellipsis,
                    ),
                  ],
                  const SizedBox(height: 10),
                  Row(children: [
                    _MetricChip(icon: Icons.access_time, value: '${dep ?? "—"}${ret != null ? " → $ret" : ""}'),
                    const SizedBox(width: 6),
                    _MetricChip(icon: Icons.timelapse, value: duration),
                    const SizedBox(width: 6),
                    _MetricChip(icon: Icons.straighten, value: distance),
                    if (visited > 0) ...[
                      const SizedBox(width: 6),
                      _MetricChip(icon: Icons.place_outlined, value: '$visited paradas'),
                    ],
                    if (compliance != null) ...[
                      const Spacer(),
                      Text(
                        '$compliance%',
                        style: AppTheme.inter(
                          fontSize: 12.5, fontWeight: FontWeight.w800,
                          color: compliance >= 80 ? AppColors.apto
                              : compliance >= 50 ? AppColors.riesgo
                              : AppColors.noApto,
                          tabular: true),
                      ),
                    ],
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

class _StatusPill extends StatelessWidget {
  final String label;
  final Color color;
  final Color bg;
  final Color border;
  const _StatusPill({required this.label, required this.color, required this.bg, required this.border});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: bg,
        border: Border.all(color: border),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        label,
        style: AppTheme.inter(
          fontSize: 10.5, fontWeight: FontWeight.w800, color: color, letterSpacing: 0.4),
      ),
    );
  }
}

class _MetricChip extends StatelessWidget {
  final IconData icon;
  final String value;
  const _MetricChip({required this.icon, required this.value});

  @override
  Widget build(BuildContext context) {
    return Flexible(
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 12, color: AppColors.ink5),
          const SizedBox(width: 3),
          Flexible(
            child: Text(
              value,
              style: AppTheme.inter(fontSize: 11, color: AppColors.ink7, fontWeight: FontWeight.w600, tabular: true),
              maxLines: 1, overflow: TextOverflow.ellipsis,
            ),
          ),
        ],
      ),
    );
  }
}

class _EmptyState extends StatelessWidget {
  const _EmptyState();
  @override
  Widget build(BuildContext context) {
    return ListView(children: [
      const SizedBox(height: 80),
      Center(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(
            children: [
              Container(
                width: 64, height: 64,
                decoration: BoxDecoration(
                  color: AppColors.goldBg,
                  shape: BoxShape.circle,
                  border: Border.all(color: AppColors.goldBorder),
                ),
                child: const Icon(Icons.route_outlined, size: 30, color: AppColors.goldDark),
              ),
              const SizedBox(height: 16),
              Text(
                'Aún no tenés recorridos',
                style: AppTheme.inter(fontSize: 15, fontWeight: FontWeight.w800, color: AppColors.ink9),
              ),
              const SizedBox(height: 4),
              Text(
                'Iniciá tu primer turno desde "Mis rutas". Tu recorrido se va a guardar acá automáticamente.',
                textAlign: TextAlign.center,
                style: AppTheme.inter(fontSize: 12.5, color: AppColors.ink6, height: 1.4),
              ),
            ],
          ),
        ),
      ),
    ]);
  }
}

class _ErrorState extends StatelessWidget {
  final String message;
  final VoidCallback onRetry;
  const _ErrorState({required this.message, required this.onRetry});
  @override
  Widget build(BuildContext context) {
    return ListView(children: [
      const SizedBox(height: 80),
      Center(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(
            children: [
              const Icon(Icons.error_outline, size: 40, color: AppColors.noApto),
              const SizedBox(height: 12),
              Text(message, style: AppTheme.inter(fontSize: 13, color: AppColors.ink7)),
              const SizedBox(height: 16),
              FilledButton.tonal(onPressed: onRetry, child: const Text('Reintentar')),
            ],
          ),
        ),
      ),
    ]);
  }
}
