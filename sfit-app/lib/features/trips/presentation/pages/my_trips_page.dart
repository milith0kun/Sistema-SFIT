import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_theme.dart';
import '../../data/datasources/trips_api_service.dart';
import '../../data/models/trip_model.dart';

/// Historial de viajes del conductor — RF-conductor.
class MyTripsPage extends ConsumerStatefulWidget {
  const MyTripsPage({super.key});

  @override
  ConsumerState<MyTripsPage> createState() => _MyTripsPageState();
}

class _MyTripsPageState extends ConsumerState<MyTripsPage> {
  List<TripModel> _items = [];
  bool _loading = true;
  String? _error;

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
      final svc = ref.read(tripsApiServiceProvider);
      final items = await svc.getMyTrips(limit: 30);
      if (mounted) setState(() { _items = items; _loading = false; });
    } catch (_) {
      if (mounted) {
        setState(() {
          _error = 'No se pudieron cargar los viajes.';
          _loading = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: Column(
        children: [
          // ── Header ──────────────────────────────────────────────
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 4),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Mis viajes',
                  style: AppTheme.inter(
                    fontSize: 18,
                    fontWeight: FontWeight.w800,
                    color: AppColors.ink9,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  'Historial de viajes realizados',
                  style: AppTheme.inter(fontSize: 13, color: AppColors.ink5),
                ),
              ],
            ),
          ),

          const SizedBox(height: 8),

          // ── Lista ─────────────────────────────────────────────
          Expanded(
            child: _loading
                ? const Center(
                    child: CircularProgressIndicator(color: AppColors.gold))
                : _error != null
                    ? _ErrorState(message: _error!, onRetry: _load)
                    : _items.isEmpty
                        ? const _EmptyState()
                        : RefreshIndicator(
                            onRefresh: _load,
                            color: AppColors.gold,
                            child: ListView.separated(
                              padding:
                                  const EdgeInsets.fromLTRB(16, 4, 16, 24),
                              itemCount: _items.length,
                              separatorBuilder: (_, __) =>
                                  const SizedBox(height: 8),
                              itemBuilder: (_, i) =>
                                  _TripCard(item: _items[i]),
                            ),
                          ),
          ),
        ],
      ),
    );
  }
}

// ── Tarjeta de viaje ───────────────────────────────────────────────────────
class _TripCard extends StatelessWidget {
  final TripModel item;
  const _TripCard({required this.item});

  @override
  Widget build(BuildContext context) {
    final (badgeColor, badgeBg, badgeBorder) = switch (item.status) {
      'completado' => (AppColors.apto, AppColors.aptoBg, AppColors.aptoBorder),
      'en_curso'   => (AppColors.gold, AppColors.goldBg, AppColors.goldBorder),
      'cancelado'  => (AppColors.noApto, AppColors.noAptoBg, AppColors.noAptoBorder),
      _            => (AppColors.ink5, AppColors.ink1, AppColors.ink3),
    };

    final plate = item.vehicle?.plate ?? '—';
    final routeName = item.route?.name ?? '—';

    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        border: Border.all(color: AppColors.ink2),
        borderRadius: BorderRadius.circular(10),
      ),
      padding: const EdgeInsets.all(12),
      child: Row(
        children: [
          // Badge de estado
          Container(
            padding:
                const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
            decoration: BoxDecoration(
              color: badgeBg,
              border: Border.all(color: badgeBorder),
              borderRadius: BorderRadius.circular(6),
            ),
            child: Text(
              _statusLabel(item.status),
              style: AppTheme.inter(
                fontSize: 11,
                fontWeight: FontWeight.w700,
                color: badgeColor,
              ),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  plate,
                  style: AppTheme.inter(
                    fontSize: 14,
                    fontWeight: FontWeight.w700,
                    color: AppColors.ink9,
                  ),
                ),
                Text(
                  routeName,
                  style: AppTheme.inter(
                      fontSize: 12, color: AppColors.ink5),
                ),
              ],
            ),
          ),
          // Columna derecha: fecha + km
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(
                _formatDate(item.createdAt),
                style: AppTheme.inter(
                    fontSize: 11, color: AppColors.ink4),
              ),
              if (item.kmRecorridos != null)
                Text(
                  '${item.kmRecorridos!.toStringAsFixed(1)} km',
                  style: AppTheme.inter(
                    fontSize: 11,
                    fontWeight: FontWeight.w600,
                    color: AppColors.ink6,
                    tabular: true,
                  ),
                ),
            ],
          ),
        ],
      ),
    );
  }

  String _statusLabel(String s) => switch (s) {
        'completado' => 'Completado',
        'en_curso'   => 'En curso',
        'cancelado'  => 'Cancelado',
        _            => 'Pendiente',
      };

  String _formatDate(DateTime d) {
    final now = DateTime.now();
    if (d.day == now.day && d.month == now.month && d.year == now.year) {
      return 'Hoy';
    }
    return '${d.day}/${d.month}/${d.year}';
  }
}

// ── Estados auxiliares ─────────────────────────────────────────────────────
class _EmptyState extends StatelessWidget {
  const _EmptyState();

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.directions_bus_outlined,
                size: 52, color: AppColors.ink3),
            const SizedBox(height: 12),
            Text(
              'Sin viajes registrados',
              style: AppTheme.inter(
                fontSize: 16,
                fontWeight: FontWeight.w700,
                color: AppColors.ink7,
              ),
            ),
            const SizedBox(height: 6),
            Text(
              'Aquí aparecerán tus viajes realizados',
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
