import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/network/dio_client.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_theme.dart';

/// Historial de viajes del conductor — RF-10.
class MyTripsPage extends ConsumerStatefulWidget {
  const MyTripsPage({super.key});

  @override
  ConsumerState<MyTripsPage> createState() => _MyTripsPageState();
}

class _MyTripsPageState extends ConsumerState<MyTripsPage> {
  List<Map<String, dynamic>> _trips = [];
  bool _loading = true;
  String? _error;
  String _period = 'hoy';

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() { _loading = true; _error = null; });
    try {
      final dio = ref.read(dioClientProvider).dio;
      final resp = await dio.get('/viajes', queryParameters: {
        'period': _period,
        'limit': 50,
      });
      final data = (resp.data as Map)['data'] as Map;
      if (mounted) {
        setState(() {
          _trips = List<Map<String, dynamic>>.from(data['items'] as List);
          _loading = false;
        });
      }
    } catch (e) {
      if (mounted) setState(() { _loading = false; _error = e.toString(); });
    }
  }

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: Column(
        children: [
          // ── Selector de período ──────────────────────────────
          Container(
            color: AppColors.paper,
            padding: const EdgeInsets.fromLTRB(12, 12, 12, 8),
            child: SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: Row(
                children: [
                  for (final (val, label) in [
                    ('hoy', 'Hoy'),
                    ('semana', 'Esta semana'),
                    ('mes', 'Este mes'),
                    ('historico', 'Histórico'),
                  ])
                    Padding(
                      padding: const EdgeInsets.only(right: 8),
                      child: FilterChip(
                        label: Text(label,
                            style: AppTheme.inter(
                              fontSize: 12,
                              fontWeight: FontWeight.w600,
                              color: _period == val ? Colors.white : AppColors.ink6,
                            )),
                        selected: _period == val,
                        onSelected: (_) {
                          setState(() => _period = val);
                          _load();
                        },
                        backgroundColor: Colors.white,
                        selectedColor: AppColors.panel,
                        checkmarkColor: Colors.white,
                        side: BorderSide(
                          color: _period == val ? AppColors.panel : AppColors.ink2,
                        ),
                        visualDensity: VisualDensity.compact,
                      ),
                    ),
                ],
              ),
            ),
          ),
          Expanded(
            child: _loading
                ? const Center(child: CircularProgressIndicator(color: AppColors.gold))
                : _error != null
                    ? Center(
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            const Icon(Icons.error_outline,
                                color: AppColors.noApto, size: 32),
                            const SizedBox(height: 8),
                            TextButton(
                                onPressed: _load,
                                child: const Text('Reintentar')),
                          ],
                        ),
                      )
                    : _trips.isEmpty
                        ? Center(
                            child: Column(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                const Icon(Icons.timeline_outlined,
                                    size: 48, color: AppColors.ink2),
                                const SizedBox(height: 12),
                                Text('Sin viajes en este período.',
                                    style: AppTheme.inter(
                                      fontSize: 15, color: AppColors.ink4)),
                              ],
                            ),
                          )
                        : RefreshIndicator(
                            onRefresh: _load,
                            color: AppColors.gold,
                            child: ListView.separated(
                              padding: const EdgeInsets.all(12),
                              itemCount: _trips.length,
                              separatorBuilder: (_, __) =>
                                  const SizedBox(height: 8),
                              itemBuilder: (_, i) =>
                                  _TripCard(trip: _trips[i]),
                            ),
                          ),
          ),
        ],
      ),
    );
  }
}

class _TripCard extends StatelessWidget {
  final Map<String, dynamic> trip;
  const _TripCard({required this.trip});

  @override
  Widget build(BuildContext context) {
    final status = trip['status'] as String? ?? 'completado';
    final vehicle = trip['vehicleId'] as Map?;
    final route = trip['routeId'] as Map?;
    final km = (trip['km'] as num?)?.toDouble() ?? 0;
    final passengers = trip['passengers'] as int? ?? 0;
    final dep = trip['departureTime'] as String?;
    final ret = trip['returnTime'] as String?;

    final (color, bg) = switch (status) {
      'completado' => (AppColors.apto,    AppColors.aptoBg),
      'en_ruta'    => (AppColors.goldDark, AppColors.goldBg),
      'cancelado'  => (AppColors.noApto,  AppColors.noAptoBg),
      _            => (AppColors.ink5,    AppColors.ink1),
    };

    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.ink1),
      ),
      padding: const EdgeInsets.all(14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.route, size: 16, color: AppColors.gold),
              const SizedBox(width: 6),
              Expanded(
                child: Text(
                  route?['name'] as String? ??
                      vehicle?['plate'] as String? ?? '—',
                  style: AppTheme.inter(
                    fontSize: 13, fontWeight: FontWeight.w600,
                    color: AppColors.ink8),
                  overflow: TextOverflow.ellipsis,
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
                decoration: BoxDecoration(
                  color: bg, borderRadius: BorderRadius.circular(5)),
                child: Text(status.toUpperCase(),
                    style: AppTheme.inter(
                      fontSize: 9, fontWeight: FontWeight.w700, color: color)),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Row(children: [
            const Icon(Icons.access_time, size: 13, color: AppColors.ink4),
            const SizedBox(width: 4),
            Text('${_fmtTime(dep)} → ${_fmtTime(ret)}',
                style: AppTheme.inter(fontSize: 12, color: AppColors.ink5)),
            const Spacer(),
            if (km > 0) ...[
              const Icon(Icons.speed, size: 13, color: AppColors.ink4),
              const SizedBox(width: 4),
              Text('${km.toStringAsFixed(1)} km',
                  style: AppTheme.inter(fontSize: 12, color: AppColors.ink5)),
            ],
            if (passengers > 0) ...[
              const SizedBox(width: 10),
              const Icon(Icons.people_outline, size: 13, color: AppColors.ink4),
              const SizedBox(width: 4),
              Text('$passengers',
                  style: AppTheme.inter(fontSize: 12, color: AppColors.ink5)),
            ],
          ]),
        ],
      ),
    );
  }

  String _fmtTime(String? iso) {
    if (iso == null) return '—';
    try {
      final dt = DateTime.parse(iso).toLocal();
      return '${dt.hour.toString().padLeft(2, '0')}:${dt.minute.toString().padLeft(2, '0')}';
    } catch (_) {
      return '—';
    }
  }
}
