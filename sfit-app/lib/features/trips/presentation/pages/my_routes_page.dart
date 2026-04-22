import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_theme.dart';
import '../../data/datasources/trips_api_service.dart';

/// Lista de rutas asignadas al conductor — RF-conductor.
class MyRoutesPage extends ConsumerStatefulWidget {
  const MyRoutesPage({super.key});

  @override
  ConsumerState<MyRoutesPage> createState() => _MyRoutesPageState();
}

class _MyRoutesPageState extends ConsumerState<MyRoutesPage> {
  List<Map<String, dynamic>> _items = [];
  bool _loading = true;
  String? _error;

  // Estado del turno activo del conductor
  Map<String, dynamic>? _activeEntry;
  bool _loadingEntry = true;

  // Todos los FleetEntry del día (para calcular resumen)
  List<Map<String, dynamic>> _allEntries = [];

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _loadingEntry = true;
      _error = null;
    });
    await Future.wait([_loadRoutes(), _loadActiveEntry()]);
  }

  Future<void> _loadRoutes() async {
    try {
      final svc = ref.read(tripsApiServiceProvider);
      final items = await svc.getMyRoutes(limit: 20);
      if (mounted) setState(() { _items = items; _loading = false; });
    } catch (_) {
      if (mounted) {
        setState(() {
          _error = 'No se pudieron cargar las rutas.';
          _loading = false;
        });
      }
    }
  }

  Future<void> _loadActiveEntry() async {
    try {
      final svc = ref.read(tripsApiServiceProvider);
      final entries = await svc.getMyFleetEntries();
      final active = entries.where((e) => e['status'] == 'en_ruta').toList();
      if (mounted) {
        setState(() {
          _allEntries = entries;
          _activeEntry = active.isNotEmpty ? active.first : null;
          _loadingEntry = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() { _allEntries = []; _activeEntry = null; _loadingEntry = false; });
    }
  }

  // ── Cálculos del resumen diario ─────────────────────────────
  double get _totalKm => _allEntries.fold<double>(
    0.0,
    (sum, e) => sum + ((e['km'] as num?)?.toDouble() ?? 0.0),
  );

  double get _totalHours {
    double total = 0.0;
    for (final e in _allEntries) {
      final dep = e['departureTime'] as String?;
      final ret = e['returnTime'] as String?;
      if (dep == null) continue;
      try {
        final d = DateTime.parse(dep);
        final end = ret != null ? DateTime.parse(ret) : DateTime.now();
        total += end.difference(d).inMinutes / 60.0;
      } catch (_) {}
    }
    return total;
  }

  int get _completedTrips => _allEntries
      .where((e) {
        final s = e['status'] as String? ?? '';
        return s == 'cerrado' || s == 'auto_cierre';
      })
      .length;

  @override
  Widget build(BuildContext context) {
    final hasActiveTrip = _activeEntry != null;

    return SafeArea(
      child: Stack(
        children: [
          Column(
            children: [
              // ── Header ────────────────────────────────────────────
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 16, 16, 4),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Mis rutas',
                      style: AppTheme.inter(
                        fontSize: 18,
                        fontWeight: FontWeight.w800,
                        color: AppColors.ink9,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      'Rutas y zonas del día',
                      style: AppTheme.inter(fontSize: 13, color: AppColors.ink5),
                    ),
                  ],
                ),
              ),

              // ── Banner turno activo ──────────────────────────────
              if (_loadingEntry)
                const Padding(
                  padding: EdgeInsets.symmetric(horizontal: 16, vertical: 6),
                  child: LinearProgressIndicator(color: AppColors.gold),
                )
              else if (hasActiveTrip)
                Padding(
                  padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
                  child: _ActiveTripBanner(
                    entry: _activeEntry!,
                    onClose: () {
                      final id = _activeEntry!['id'] as String? ?? '';
                      final vehicle = _activeEntry!['vehicle'] as Map<String, dynamic>?;
                      final plate = vehicle?['plate'] as String? ?? '—';
                      final departure = _activeEntry!['departureTime'] as String? ?? '';
                      final km = (_activeEntry!['km'] as num?)?.toDouble();
                      context.push(
                        '/viaje-checkout/$id',
                        extra: {
                          'vehiclePlate': plate,
                          'departureTime': departure,
                          'estimatedKm': km,
                        },
                      );
                    },
                  ),
                ),

              // ── Resumen de hoy ───────────────────────────────────
              if (!_loadingEntry && _allEntries.isNotEmpty)
                Padding(
                  padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
                  child: _DailySummaryRow(
                    totalKm: _totalKm,
                    totalHours: _totalHours,
                    completed: _completedTrips,
                  ),
                ),

              const SizedBox(height: 8),

              // ── Lista de rutas ──────────────────────────────────
              Expanded(
                child: _loading
                    ? const Center(
                        child: CircularProgressIndicator(color: AppColors.gold))
                    : _error != null
                        ? _ErrorState(message: _error!, onRetry: _load)
                        : _items.isEmpty
                            ? _EmptyState(hasActiveTrip: hasActiveTrip)
                            : RefreshIndicator(
                                onRefresh: _load,
                                color: AppColors.gold,
                                child: ListView.separated(
                                  // Padding extra al fondo para que el FAB no tape el último ítem
                                  padding: EdgeInsets.fromLTRB(
                                    16, 4, 16,
                                    hasActiveTrip ? 24 : 90,
                                  ),
                                  itemCount: _items.length,
                                  separatorBuilder: (_, __) =>
                                      const SizedBox(height: 8),
                                  itemBuilder: (_, i) =>
                                      _RouteCard(
                                        data: _items[i],
                                        onTap: () {
                                          final route = _items[i];
                                          context.push(
                                            '/ruta-detalle',
                                            extra: {
                                              'routeId': route['_id'] ?? route['id'] ?? '',
                                              'routeName': route['name'] ?? 'Ruta',
                                            },
                                          );
                                        },
                                      ),
                                ),
                              ),
              ),
            ],
          ),

          // ── FAB — sólo cuando NO hay turno activo ────────────────
          if (!_loadingEntry && !hasActiveTrip)
            Positioned(
              bottom: 16,
              right: 16,
              child: FloatingActionButton.extended(
                onPressed: () => context.push('/viaje-checkin'),
                backgroundColor: AppColors.gold,
                foregroundColor: Colors.white,
                icon: const Icon(Icons.play_circle_outline),
                label: Text(
                  'Iniciar turno',
                  style: AppTheme.inter(
                    fontSize: 14,
                    fontWeight: FontWeight.w700,
                    color: Colors.white,
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

// ── Resumen de hoy ─────────────────────────────────────────────────────────────
class _DailySummaryRow extends StatelessWidget {
  final double totalKm;
  final double totalHours;
  final int completed;

  const _DailySummaryRow({
    required this.totalKm,
    required this.totalHours,
    required this.completed,
  });

  String _formatHours(double h) {
    final hrs  = h.floor();
    final mins = ((h - hrs) * 60).round();
    if (hrs == 0) return '${mins}m';
    return '${hrs}h ${mins.toString().padLeft(2, '0')}m';
  }

  @override
  Widget build(BuildContext context) {
    return Row(
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
    );
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
                style: AppTheme.inter(
                    fontSize: 10, color: color.withValues(alpha: 0.75)),
                textAlign: TextAlign.center),
          ],
        ),
      ),
    );
  }
}

// ── Banner turno activo ────────────────────────────────────────────────────────
class _ActiveTripBanner extends StatelessWidget {
  final Map<String, dynamic> entry;
  final VoidCallback onClose;

  const _ActiveTripBanner({required this.entry, required this.onClose});

  String _formatTime(String? iso) {
    if (iso == null) return '—';
    try {
      final dt = DateTime.parse(iso).toLocal();
      return '${dt.hour.toString().padLeft(2, '0')}:${dt.minute.toString().padLeft(2, '0')}';
    } catch (_) {
      return iso;
    }
  }

  @override
  Widget build(BuildContext context) {
    final vehicle = entry['vehicle'] as Map<String, dynamic>?;
    final plate = vehicle?['plate'] as String? ?? '—';
    final departureTime = entry['departureTime'] as String?;

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.panel,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.goldBorder, width: 1.5),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Container(
                width: 8,
                height: 8,
                decoration: const BoxDecoration(
                  color: AppColors.apto,
                  shape: BoxShape.circle,
                ),
              ),
              const SizedBox(width: 6),
              Text(
                'TURNO ACTIVO',
                style: AppTheme.inter(
                  fontSize: 10,
                  fontWeight: FontWeight.w700,
                  color: AppColors.goldLight,
                  letterSpacing: 1.4,
                ),
              ),
              const Spacer(),
              if (departureTime != null)
                Text(
                  'Salida ${_formatTime(departureTime)}',
                  style: AppTheme.inter(fontSize: 11, color: Colors.white54),
                ),
            ],
          ),
          const SizedBox(height: 8),
          Row(
            children: [
              const Icon(Icons.directions_car, color: Colors.white, size: 20),
              const SizedBox(width: 8),
              Text(
                plate,
                style: AppTheme.inter(
                  fontSize: 18,
                  fontWeight: FontWeight.w800,
                  color: Colors.white,
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          FilledButton.icon(
            onPressed: onClose,
            icon: const Icon(Icons.stop_circle_outlined, size: 18),
            label: const Text('Cerrar turno'),
            style: FilledButton.styleFrom(
              backgroundColor: AppColors.noApto,
              foregroundColor: Colors.white,
              minimumSize: const Size(double.infinity, 42),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(8),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// ── Tarjeta de ruta ────────────────────────────────────────────────────────────
class _RouteCard extends StatelessWidget {
  final Map<String, dynamic> data;
  final VoidCallback? onTap;
  const _RouteCard({required this.data, this.onTap});

  @override
  Widget build(BuildContext context) {
    final name = data['name'] as String? ?? '—';
    final active = (data['active'] as bool?) ?? true;
    final origin = data['origin'] as String?;
    final destination = data['destination'] as String?;
    final zone = data['zone'] as String?;

    String subLabel = '';
    if (origin != null && destination != null) {
      subLabel = '$origin → $destination';
    } else if (origin != null) {
      subLabel = origin;
    } else if (zone != null) {
      subLabel = zone;
    }

    final (badgeColor, badgeBg, badgeBorder, badgeLabel) = active
        ? (AppColors.gold, AppColors.goldBg, AppColors.goldBorder, 'Activa')
        : (AppColors.ink4, AppColors.ink1, AppColors.ink3, 'Inactiva');

    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(10),
        child: Container(
          decoration: BoxDecoration(
            color: Colors.white,
            border: Border.all(color: AppColors.ink2),
            borderRadius: BorderRadius.circular(10),
          ),
          padding: const EdgeInsets.all(12),
          child: Row(
            children: [
              Container(
                width: 4,
                height: 40,
                decoration: BoxDecoration(
                  color: active ? AppColors.gold : AppColors.ink3,
                  borderRadius: BorderRadius.circular(4),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      name,
                      style: AppTheme.inter(
                        fontSize: 14,
                        fontWeight: FontWeight.w700,
                        color: AppColors.ink9,
                      ),
                    ),
                    if (subLabel.isNotEmpty) ...[
                      const SizedBox(height: 2),
                      Text(
                        subLabel,
                        style: AppTheme.inter(fontSize: 12, color: AppColors.ink5),
                      ),
                    ],
                  ],
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: badgeBg,
                  border: Border.all(color: badgeBorder),
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Text(
                  badgeLabel,
                  style: AppTheme.inter(
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                    color: badgeColor,
                  ),
                ),
              ),
              const SizedBox(width: 6),
              const Icon(Icons.chevron_right, size: 16, color: AppColors.ink4),
            ],
          ),
        ),
      ),
    );
  }
}

// ── Estados auxiliares ─────────────────────────────────────────────────────────
class _EmptyState extends StatelessWidget {
  final bool hasActiveTrip;
  const _EmptyState({required this.hasActiveTrip});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.route_outlined, size: 52, color: AppColors.ink3),
            const SizedBox(height: 12),
            Text(
              'Sin rutas asignadas',
              style: AppTheme.inter(
                fontSize: 16,
                fontWeight: FontWeight.w700,
                color: AppColors.ink7,
              ),
            ),
            const SizedBox(height: 6),
            Text(
              hasActiveTrip
                  ? 'No tienes rutas asignadas hoy, pero tu turno está activo.'
                  : 'No tienes rutas asignadas para hoy',
              textAlign: TextAlign.center,
              style: AppTheme.inter(fontSize: 13, color: AppColors.ink5),
            ),
          ],
        ),
      ),
    );
  }
}

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
            const Icon(Icons.error_outline, size: 40, color: AppColors.noApto),
            const SizedBox(height: 10),
            Text(
              message,
              textAlign: TextAlign.center,
              style: AppTheme.inter(fontSize: 13, color: AppColors.ink6),
            ),
            const SizedBox(height: 14),
            TextButton(onPressed: onRetry, child: const Text('Reintentar')),
          ],
        ),
      ),
    );
  }
}
