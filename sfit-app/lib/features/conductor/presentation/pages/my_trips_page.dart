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

  // ── Métricas rápidas del período seleccionado ──
  int get _enCurso => _trips.where((t) => t['status'] == 'en_curso').length;
  int get _completados => _trips.where((t) => t['status'] == 'completado').length;
  double get _kmTotal => _trips.fold(0.0, (s, t) => s + ((t['km'] as num?)?.toDouble() ?? 0));
  int get _autoCierres => _trips.where((t) =>
      t['status'] == 'auto_cierre' || t['status'] == 'cerrado_automatico').length;

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: Column(
        children: [
          // ── Selector de período (segmented sobrio) ──
          _PeriodTabs(
            current: _period,
            onChange: (p) {
              setState(() => _period = p);
              _load();
            },
          ),

          // ── Stats rápidas (solo si hay datos) ──
          if (!_loading && _trips.isNotEmpty)
            Padding(
              padding: const EdgeInsets.fromLTRB(12, 4, 12, 8),
              child: _StatsStrip(
                total: _trips.length,
                enCurso: _enCurso,
                completados: _completados,
                kmTotal: _kmTotal,
                autoCierres: _autoCierres,
              ),
            ),

          Expanded(
            child: _loading
                ? const _LoadingState()
                : _error != null
                    ? _ErrorState(onRetry: _load)
                    : _trips.isEmpty
                        ? const _EmptyState()
                        : RefreshIndicator(
                            onRefresh: _load,
                            color: AppColors.ink9,
                            child: ListView.separated(
                              padding: const EdgeInsets.fromLTRB(12, 4, 12, 24),
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

// ── Selector de período ──────────────────────────────────────────────────────
class _PeriodTabs extends StatelessWidget {
  final String current;
  final ValueChanged<String> onChange;

  const _PeriodTabs({required this.current, required this.onChange});

  static const _items = [
    ('hoy', 'Hoy'),
    ('semana', 'Semana'),
    ('mes', 'Mes'),
    ('historico', 'Histórico'),
  ];

  @override
  Widget build(BuildContext context) {
    return Container(
      color: AppColors.paper,
      padding: const EdgeInsets.fromLTRB(12, 12, 12, 4),
      child: Row(
        children: [
          Text('PERÍODO',
              style: AppTheme.inter(
                fontSize: 10, fontWeight: FontWeight.w700,
                color: AppColors.ink5, letterSpacing: 0.8)),
          const SizedBox(width: 10),
          Expanded(
            child: SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: Row(
                children: [
                  for (final (val, label) in _items) ...[
                    _PeriodChip(
                      label: label,
                      active: current == val,
                      onTap: () => onChange(val),
                    ),
                    const SizedBox(width: 6),
                  ],
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _PeriodChip extends StatelessWidget {
  final String label;
  final bool active;
  final VoidCallback onTap;

  const _PeriodChip({required this.label, required this.active, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(7),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 120),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
        decoration: BoxDecoration(
          color: active ? AppColors.ink9 : Colors.white,
          border: Border.all(color: active ? AppColors.ink9 : AppColors.ink2),
          borderRadius: BorderRadius.circular(7),
        ),
        child: Text(label,
            style: AppTheme.inter(
              fontSize: 12,
              fontWeight: active ? FontWeight.w700 : FontWeight.w600,
              color: active ? Colors.white : AppColors.ink6)),
      ),
    );
  }
}

// ── Stats strip ──────────────────────────────────────────────────────────────
class _StatsStrip extends StatelessWidget {
  final int total;
  final int enCurso;
  final int completados;
  final double kmTotal;
  final int autoCierres;

  const _StatsStrip({
    required this.total, required this.enCurso, required this.completados,
    required this.kmTotal, required this.autoCierres,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      decoration: BoxDecoration(
        color: Colors.white,
        border: Border.all(color: AppColors.ink2),
        borderRadius: BorderRadius.circular(10),
      ),
      child: Row(
        children: [
          _Stat(label: 'Total', value: '$total'),
          _Divider(),
          _Stat(label: 'En curso', value: '$enCurso',
              accent: enCurso > 0 ? const Color(0xFF1E40AF) : null),
          _Divider(),
          _Stat(label: 'Completados', value: '$completados',
              accent: completados > 0 ? AppColors.apto : null),
          _Divider(),
          _Stat(label: 'Km', value: kmTotal.toStringAsFixed(1)),
          if (autoCierres > 0) ...[
            _Divider(),
            _Stat(label: 'Auto-cierre', value: '$autoCierres',
                accent: const Color(0xFFB45309)),
          ],
        ],
      ),
    );
  }
}

class _Stat extends StatelessWidget {
  final String label;
  final String value;
  final Color? accent;

  const _Stat({required this.label, required this.value, this.accent});

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label.toUpperCase(),
              style: AppTheme.inter(
                fontSize: 9, fontWeight: FontWeight.w700,
                color: AppColors.ink5, letterSpacing: 0.5)),
          const SizedBox(height: 2),
          Text(value,
              style: AppTheme.inter(
                fontSize: 16, fontWeight: FontWeight.w800,
                color: accent ?? AppColors.ink9)),
        ],
      ),
    );
  }
}

class _Divider extends StatelessWidget {
  @override
  Widget build(BuildContext context) =>
      Container(width: 1, height: 28,
          color: AppColors.ink1, margin: const EdgeInsets.symmetric(horizontal: 10));
}

// ── Estados base ─────────────────────────────────────────────────────────────
class _LoadingState extends StatelessWidget {
  const _LoadingState();
  @override
  Widget build(BuildContext context) =>
      const Center(child: CircularProgressIndicator(color: AppColors.ink9));
}

class _ErrorState extends StatelessWidget {
  final VoidCallback onRetry;
  const _ErrorState({required this.onRetry});

  @override
  Widget build(BuildContext context) => Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.error_outline, color: AppColors.noApto, size: 36),
            const SizedBox(height: 10),
            Text('No se pudieron cargar los viajes',
                style: AppTheme.inter(
                  fontSize: 14, color: AppColors.ink6, fontWeight: FontWeight.w600)),
            const SizedBox(height: 12),
            OutlinedButton.icon(
              onPressed: onRetry,
              icon: const Icon(Icons.refresh, size: 16),
              label: const Text('Reintentar'),
              style: OutlinedButton.styleFrom(
                foregroundColor: AppColors.ink8,
                side: const BorderSide(color: AppColors.ink2),
              ),
            ),
          ],
        ),
      );
}

class _EmptyState extends StatelessWidget {
  const _EmptyState();

  @override
  Widget build(BuildContext context) => Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 56, height: 56,
              decoration: BoxDecoration(
                color: AppColors.ink1,
                borderRadius: BorderRadius.circular(14),
              ),
              child: const Icon(Icons.timeline_outlined,
                  size: 26, color: AppColors.ink5),
            ),
            const SizedBox(height: 14),
            Text('Sin viajes en este período',
                style: AppTheme.inter(
                  fontSize: 14, fontWeight: FontWeight.w700,
                  color: AppColors.ink9)),
            const SizedBox(height: 4),
            Text('Cuando inicies un viaje, aparecerá aquí.',
                style: AppTheme.inter(
                  fontSize: 12, color: AppColors.ink5)),
          ],
        ),
      );
}

// ── Trip card ────────────────────────────────────────────────────────────────
class _TripCard extends StatelessWidget {
  final Map<String, dynamic> trip;
  const _TripCard({required this.trip});

  static const _statusMeta = {
    'en_curso':           (color: Color(0xFF1E40AF), bd: Color(0xFFBFDBFE), label: 'En curso'),
    'completado':         (color: AppColors.apto,    bd: AppColors.aptoBorder, label: 'Completado'),
    'auto_cierre':        (color: Color(0xFFB45309), bd: Color(0xFFFDE68A), label: 'Auto-cierre'),
    'cerrado_automatico': (color: Color(0xFFB45309), bd: Color(0xFFFDE68A), label: 'Auto-cierre'),
    'cancelado':          (color: AppColors.noApto,  bd: AppColors.noAptoBorder, label: 'Cancelado'),
  };

  @override
  Widget build(BuildContext context) {
    final status = (trip['status'] as String?) ?? 'completado';
    final vehicle = trip['vehicleId'] as Map?;
    final route = trip['routeId'] as Map?;
    final km = (trip['km'] as num?)?.toDouble() ?? 0;
    final passengers = trip['passengers'] as int? ?? 0;
    final start = trip['startTime'] as String?;
    final end = trip['endTime'] as String?;
    final dur = _durationMinutes(start, end);

    final meta = _statusMeta[status] ??
        (color: AppColors.ink5, bd: AppColors.ink2, label: status);

    final plate = (vehicle?['plate'] as String?) ?? '—';
    final routeText = route != null
        ? '${route['code']} · ${route['name']}'
        : 'Sin ruta asignada';

    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.ink2),
      ),
      padding: const EdgeInsets.fromLTRB(14, 12, 14, 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header: placa + status badge
          Row(
            children: [
              // Placa pill negra
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: AppColors.ink9,
                  borderRadius: BorderRadius.circular(5),
                ),
                child: Text(plate,
                    style: AppTheme.inter(
                      fontSize: 11, fontWeight: FontWeight.w700,
                      color: Colors.white, letterSpacing: 0.5)),
              ),
              const Spacer(),
              // Status badge
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 3),
                decoration: BoxDecoration(
                  color: Colors.white,
                  border: Border.all(color: meta.bd),
                  borderRadius: BorderRadius.circular(999),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Container(
                      width: 5, height: 5,
                      decoration: BoxDecoration(
                        color: meta.color, shape: BoxShape.circle),
                    ),
                    const SizedBox(width: 5),
                    Text(meta.label.toUpperCase(),
                        style: AppTheme.inter(
                          fontSize: 9, fontWeight: FontWeight.w700,
                          color: meta.color, letterSpacing: 0.5)),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),

          // Ruta
          Row(
            children: [
              const Icon(Icons.alt_route, size: 14, color: AppColors.ink5),
              const SizedBox(width: 6),
              Expanded(
                child: Text(routeText,
                    style: AppTheme.inter(
                      fontSize: 13, fontWeight: FontWeight.w600,
                      color: route != null ? AppColors.ink9 : AppColors.ink5),
                    overflow: TextOverflow.ellipsis),
              ),
            ],
          ),

          const SizedBox(height: 8),
          Container(height: 1, color: AppColors.ink1),
          const SizedBox(height: 8),

          // Métricas en fila
          Row(
            children: [
              _Metric(
                icon: Icons.access_time,
                label: 'Inicio',
                value: _fmtTime(start),
              ),
              const SizedBox(width: 12),
              _Metric(
                icon: Icons.flag_outlined,
                label: 'Fin',
                value: _fmtTime(end),
                muted: end == null,
              ),
              if (dur != null) ...[
                const SizedBox(width: 12),
                _Metric(
                  icon: Icons.timer_outlined,
                  label: 'Duración',
                  value: _fmtDuration(dur),
                ),
              ],
              const Spacer(),
              if (km > 0)
                Padding(
                  padding: const EdgeInsets.only(right: 10),
                  child: _InlineStat(
                      icon: Icons.speed, value: '${km.toStringAsFixed(1)} km'),
                ),
              if (passengers > 0)
                _InlineStat(
                    icon: Icons.people_outline, value: '$passengers'),
            ],
          ),
        ],
      ),
    );
  }

  static String _fmtTime(String? iso) {
    if (iso == null) return '—';
    try {
      final dt = DateTime.parse(iso).toLocal();
      return '${dt.hour.toString().padLeft(2, '0')}:${dt.minute.toString().padLeft(2, '0')}';
    } catch (_) { return '—'; }
  }

  static int? _durationMinutes(String? start, String? end) {
    if (start == null || end == null) return null;
    try {
      final s = DateTime.parse(start);
      final e = DateTime.parse(end);
      final diff = e.difference(s).inMinutes;
      return diff < 0 ? null : diff;
    } catch (_) { return null; }
  }

  static String _fmtDuration(int min) {
    final h = min ~/ 60;
    final m = min % 60;
    return h > 0 ? '${h}h ${m}m' : '${m}m';
  }
}

class _Metric extends StatelessWidget {
  final IconData icon;
  final String label;
  final String value;
  final bool muted;

  const _Metric({
    required this.icon, required this.label, required this.value,
    this.muted = false,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(children: [
          Icon(icon, size: 11, color: AppColors.ink5),
          const SizedBox(width: 3),
          Text(label.toUpperCase(),
              style: AppTheme.inter(
                fontSize: 9, fontWeight: FontWeight.w700,
                color: AppColors.ink5, letterSpacing: 0.5)),
        ]),
        const SizedBox(height: 2),
        Text(value,
            style: AppTheme.inter(
              fontSize: 13, fontWeight: FontWeight.w700,
              color: muted ? AppColors.ink5 : AppColors.ink9)),
      ],
    );
  }
}

class _InlineStat extends StatelessWidget {
  final IconData icon;
  final String value;
  const _InlineStat({required this.icon, required this.value});

  @override
  Widget build(BuildContext context) => Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 13, color: AppColors.ink5),
          const SizedBox(width: 4),
          Text(value,
              style: AppTheme.inter(
                fontSize: 12, fontWeight: FontWeight.w700, color: AppColors.ink8)),
        ],
      );
}
