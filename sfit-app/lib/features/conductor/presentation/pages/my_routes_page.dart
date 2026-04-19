import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/network/dio_client.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../auth/presentation/providers/auth_provider.dart';

/// Rutas del día para el rol Conductor — RF-10.
class MyRoutesPage extends ConsumerStatefulWidget {
  const MyRoutesPage({super.key});

  @override
  ConsumerState<MyRoutesPage> createState() => _MyRoutesPageState();
}

class _MyRoutesPageState extends ConsumerState<MyRoutesPage> {
  List<Map<String, dynamic>> _entries = [];
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
      final resp = await dio.get('/flota', queryParameters: {'limit': 20});
      final data = (resp.data as Map)['data'] as Map;
      if (mounted) {
        setState(() {
          _entries = List<Map<String, dynamic>>.from(data['items'] as List);
          _loading = false;
        });
      }
    } catch (e) {
      if (mounted) setState(() { _loading = false; _error = e.toString(); });
    }
  }

  // ── Cálculos del resumen diario ─────────────────────────────
  double get _totalKm {
    return _entries.fold<double>(0.0, (sum, e) {
      final km = e['km'];
      if (km == null) return sum;
      return sum + (km as num).toDouble();
    });
  }

  double get _totalHours {
    double total = 0.0;
    for (final e in _entries) {
      final dep = e['departureTime'] as String?;
      final ret = e['returnTime'] as String?;
      if (dep != null && ret != null) {
        try {
          final d = DateTime.parse(dep);
          final r = DateTime.parse(ret);
          total += r.difference(d).inMinutes / 60.0;
        } catch (_) {}
      } else if (dep != null) {
        try {
          final d = DateTime.parse(dep);
          total += DateTime.now().difference(d).inMinutes / 60.0;
        } catch (_) {}
      }
    }
    return total;
  }

  int get _completedTrips =>
      _entries.where((e) {
        final s = e['status'] as String? ?? '';
        return s == 'cerrado' || s == 'auto_cierre';
      }).length;

  @override
  Widget build(BuildContext context) {
    final user = ref.watch(authProvider).user;
    return SafeArea(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // ── Encabezado ────────────────────────────────────────
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 20, 16, 4),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Rutas del día',
                    style: AppTheme.inter(
                      fontSize: 20, fontWeight: FontWeight.w800,
                      color: AppColors.ink9, letterSpacing: -0.5)),
                if (user != null)
                  Text(user.name,
                      style: AppTheme.inter(fontSize: 13, color: AppColors.ink4)),
              ],
            ),
          ),
          const SizedBox(height: 10),

          // ── Resumen de hoy (mini-cards) ───────────────────────
          if (!_loading && _entries.isNotEmpty)
            _DailySummaryRow(
              totalKm: _totalKm,
              totalHours: _totalHours,
              completed: _completedTrips,
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
                            Text('Error al cargar rutas.',
                                style: AppTheme.inter(
                                  fontSize: 14, color: AppColors.ink6)),
                            const SizedBox(height: 12),
                            TextButton(
                                onPressed: _load,
                                child: const Text('Reintentar')),
                          ],
                        ),
                      )
                    : _entries.isEmpty
                        ? Center(
                            child: Column(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                const Icon(Icons.route_outlined,
                                    size: 48, color: AppColors.ink2),
                                const SizedBox(height: 12),
                                Text('Sin rutas asignadas hoy.',
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
                              itemCount: _entries.length,
                              separatorBuilder: (_, __) =>
                                  const SizedBox(height: 8),
                              itemBuilder: (_, i) =>
                                  _RouteCard(entry: _entries[i]),
                            ),
                          ),
          ),
        ],
      ),
    );
  }
}

// ── Widget: Resumen de hoy ────────────────────────────────────────
class _DailySummaryRow extends StatelessWidget {
  final double totalKm;
  final double totalHours;
  final int completed;

  const _DailySummaryRow({
    required this.totalKm,
    required this.totalHours,
    required this.completed,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(12, 0, 12, 10),
      child: Row(
        children: [
          _MiniCard(
            icon: Icons.route,
            value: '${totalKm.toStringAsFixed(0)} km',
            label: 'Recorridos',
            color: AppColors.info,
            bg: AppColors.infoBg,
          ),
          const SizedBox(width: 8),
          _MiniCard(
            icon: Icons.timer_outlined,
            value: _formatHours(totalHours),
            label: 'En ruta',
            color: AppColors.riesgo,
            bg: AppColors.riesgoBg,
          ),
          const SizedBox(width: 8),
          _MiniCard(
            icon: Icons.check_circle_outline,
            value: '$completed',
            label: 'Completados',
            color: AppColors.apto,
            bg: AppColors.aptoBg,
          ),
        ],
      ),
    );
  }

  String _formatHours(double h) {
    final hrs  = h.floor();
    final mins = ((h - hrs) * 60).round();
    if (hrs == 0) return '${mins}m';
    return '${hrs}h ${mins.toString().padLeft(2, '0')}m';
  }
}

class _MiniCard extends StatelessWidget {
  final IconData icon;
  final String value;
  final String label;
  final Color color;
  final Color bg;

  const _MiniCard({
    required this.icon,
    required this.value,
    required this.label,
    required this.color,
    required this.bg,
  });

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 8),
        decoration: BoxDecoration(
          color: bg,
          border: Border.all(color: color.withValues(alpha: 0.25)),
          borderRadius: BorderRadius.circular(10),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 16, color: color),
            const SizedBox(height: 4),
            Text(value,
                style: AppTheme.inter(
                    fontSize: 14, fontWeight: FontWeight.w800,
                    color: color, tabular: true)),
            Text(label,
                style: AppTheme.inter(fontSize: 10, color: color.withValues(alpha: 0.75)),
                textAlign: TextAlign.center),
          ],
        ),
      ),
    );
  }
}

// ── Tarjeta de ruta ───────────────────────────────────────────────
class _RouteCard extends StatelessWidget {
  final Map<String, dynamic> entry;
  const _RouteCard({required this.entry});

  @override
  Widget build(BuildContext context) {
    final status = entry['status'] as String? ?? 'en_ruta';
    final vehicle = entry['vehicleId'] as Map? ?? {};
    final route = entry['routeId'] as Map?;
    final dep = entry['departureTime'] as String?;
    final ret = entry['returnTime'] as String?;

    final (statusColor, statusBg, statusLabel) = switch (status) {
      'en_ruta'    => (AppColors.goldDark, AppColors.goldBg, 'EN RUTA'),
      'cerrado'    => (AppColors.apto,     AppColors.aptoBg, 'CERRADO'),
      'auto_cierre' => (AppColors.ink5,   AppColors.ink1,   'AUTO-CIERRE'),
      _             => (AppColors.ink5,   AppColors.ink1,    status.toUpperCase()),
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
              const Icon(Icons.directions_bus, size: 18, color: AppColors.gold),
              const SizedBox(width: 6),
              Text(vehicle['plate'] as String? ?? '—',
                  style: AppTheme.inter(
                    fontSize: 14, fontWeight: FontWeight.w700,
                    color: AppColors.ink9)),
              const Spacer(),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: statusBg,
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Text(statusLabel,
                    style: AppTheme.inter(
                      fontSize: 10, fontWeight: FontWeight.w700,
                      color: statusColor)),
              ),
            ],
          ),
          if (route != null) ...[
            const SizedBox(height: 6),
            Text(route['name'] as String? ?? '—',
                style: AppTheme.inter(
                  fontSize: 13, color: AppColors.ink6, fontWeight: FontWeight.w500)),
          ],
          const SizedBox(height: 8),
          Row(children: [
            const Icon(Icons.login, size: 14, color: AppColors.ink4),
            const SizedBox(width: 4),
            Text(_fmtTime(dep), style: AppTheme.inter(fontSize: 12, color: AppColors.ink5)),
            const SizedBox(width: 14),
            if (ret != null) ...[
              const Icon(Icons.logout, size: 14, color: AppColors.ink4),
              const SizedBox(width: 4),
              Text(_fmtTime(ret), style: AppTheme.inter(fontSize: 12, color: AppColors.ink5)),
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
      final h = dt.hour.toString().padLeft(2, '0');
      final m = dt.minute.toString().padLeft(2, '0');
      return '$h:$m';
    } catch (_) {
      return '—';
    }
  }
}
