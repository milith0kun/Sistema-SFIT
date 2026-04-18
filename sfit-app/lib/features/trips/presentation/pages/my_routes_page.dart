import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
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
                                  _RouteCard(data: _items[i]),
                            ),
                          ),
          ),
        ],
      ),
    );
  }
}

// ── Tarjeta de ruta ────────────────────────────────────────────────────────
class _RouteCard extends StatelessWidget {
  final Map<String, dynamic> data;
  const _RouteCard({required this.data});

  @override
  Widget build(BuildContext context) {
    final name = data['name'] as String? ?? '—';
    final active = (data['active'] as bool?) ?? true;
    final origin = data['origin'] as String?;
    final destination = data['destination'] as String?;
    final zone = data['zone'] as String?;

    // Sub-label: origen→destino si existe, o zona
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

    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        border: Border.all(color: AppColors.ink2),
        borderRadius: BorderRadius.circular(10),
      ),
      padding: const EdgeInsets.all(12),
      child: Row(
        children: [
          // Indicador lateral
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
                    style: AppTheme.inter(
                        fontSize: 12, color: AppColors.ink5),
                  ),
                ],
              ],
            ),
          ),
          // Badge estado
          Container(
            padding:
                const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
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
        ],
      ),
    );
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
              'No tienes rutas asignadas para hoy',
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
