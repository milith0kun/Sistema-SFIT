import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../trips/data/datasources/trips_api_service.dart';

/// Catálogo PULL: viajes en pendiente_aceptacion sin driver asignado.
/// El conductor puede reclamar uno con `claimTrip()`. Atómico anti-race
/// en backend (dos conductores que toquen "Tomar" al mismo tiempo, solo
/// uno gana; el otro recibe 409 y se refresca).
class AvailableTripsPage extends ConsumerStatefulWidget {
  const AvailableTripsPage({super.key});

  @override
  ConsumerState<AvailableTripsPage> createState() => _AvailableTripsPageState();
}

class _AvailableTripsPageState extends ConsumerState<AvailableTripsPage> {
  List<Map<String, dynamic>> _items = [];
  bool _loading = true;
  String? _error;
  String? _busyId;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() { _loading = true; _error = null; });
    try {
      final svc = ref.read(tripsApiServiceProvider);
      final items = await svc.getAvailableTrips();
      if (mounted) setState(() { _items = items; _loading = false; });
    } catch (e) {
      if (mounted) setState(() { _error = 'No se pudieron cargar los viajes disponibles.'; _loading = false; });
    }
  }

  Future<void> _claim(String tripId, {String? direction}) async {
    setState(() => _busyId = tripId);
    try {
      final svc = ref.read(tripsApiServiceProvider);
      await svc.claimTrip(tripId, direction: direction);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Viaje tomado'), behavior: SnackBarBehavior.floating, backgroundColor: AppColors.apto),
        );
      }
      await _load();
    } catch (e) {
      // 409 = otro conductor lo tomó primero. Refrescamos lista.
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('No se pudo tomar el viaje (puede que otro lo haya reclamado).'), backgroundColor: AppColors.riesgo),
        );
        await _load();
      }
    } finally {
      if (mounted) setState(() => _busyId = null);
    }
  }

  Future<String?> _askDirection(Map<String, dynamic>? route) async {
    final hasSibling = route != null && route['siblingRouteId'] != null;
    if (!hasSibling) return null; // sin par ida/vuelta, no preguntamos
    return showDialog<String>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text('¿En qué sentido?', style: AppTheme.inter(fontSize: 15, fontWeight: FontWeight.w700)),
        content: Text('Esta ruta tiene ida y vuelta. Elige el sentido del viaje.',
          style: AppTheme.inter(fontSize: 13, color: AppColors.ink6)),
        actions: [
          TextButton(onPressed: () => Navigator.of(ctx).pop(), child: const Text('Cancelar')),
          TextButton(onPressed: () => Navigator.of(ctx).pop('ida'), child: const Text('Ida')),
          FilledButton(
            onPressed: () => Navigator.of(ctx).pop('vuelta'),
            style: FilledButton.styleFrom(backgroundColor: AppColors.gold),
            child: const Text('Vuelta'),
          ),
        ],
      ),
    );
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
        title: Text('Viajes disponibles',
          style: AppTheme.inter(fontSize: 16, fontWeight: FontWeight.w700, color: AppColors.ink9)),
        actions: [
          IconButton(
            onPressed: _loading ? null : _load,
            icon: const Icon(Icons.refresh_rounded, size: 20, color: AppColors.ink6),
            tooltip: 'Refrescar',
          ),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator(color: AppColors.gold))
          : _error != null
              ? _ErrorState(message: _error!, onRetry: _load)
              : _items.isEmpty
                  ? const _EmptyState()
                  : RefreshIndicator(
                      onRefresh: _load,
                      child: ListView.separated(
                        padding: const EdgeInsets.all(16),
                        itemCount: _items.length,
                        separatorBuilder: (_, __) => const SizedBox(height: 10),
                        itemBuilder: (_, i) {
                          final t = _items[i];
                          return _AvailableCard(
                            trip: t,
                            isBusy: _busyId == (t['id'] as String?),
                            onTake: () async {
                              final dir = await _askDirection(t['route'] as Map<String, dynamic>?);
                              if (!mounted) return;
                              final id = t['id'] as String? ?? '';
                              await _claim(id, direction: dir);
                            },
                          );
                        },
                      ),
                    ),
    );
  }
}

class _AvailableCard extends StatelessWidget {
  final Map<String, dynamic> trip;
  final bool isBusy;
  final Future<void> Function() onTake;

  const _AvailableCard({required this.trip, required this.isBusy, required this.onTake});

  @override
  Widget build(BuildContext context) {
    final vehicle = trip['vehicle'] as Map<String, dynamic>?;
    final route = trip['route'] as Map<String, dynamic>?;
    final plate = vehicle?['plate'] as String? ?? '—';
    final routeName = route?['name'] as String? ?? 'Sin ruta';
    final routeCode = route?['code'] as String?;
    final direction = trip['direction'] as String?;

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
              width: 40, height: 40,
              decoration: BoxDecoration(
                color: AppColors.aptoBg, shape: BoxShape.circle,
                border: Border.all(color: AppColors.aptoBorder),
              ),
              child: const Icon(Icons.directions_bus_rounded, size: 20, color: AppColors.apto),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(children: [
                    Text(plate,
                      style: AppTheme.inter(fontSize: 15, fontWeight: FontWeight.w800, color: AppColors.ink9, tabular: true)),
                    if (routeCode != null) ...[
                      const SizedBox(width: 8),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                        decoration: BoxDecoration(color: AppColors.ink1, borderRadius: BorderRadius.circular(4)),
                        child: Text(routeCode,
                          style: AppTheme.inter(fontSize: 10, fontWeight: FontWeight.w700, color: AppColors.ink6)),
                      ),
                    ],
                    if (direction != null) ...[
                      const SizedBox(width: 6),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                        decoration: BoxDecoration(color: AppColors.goldBg, borderRadius: BorderRadius.circular(4), border: Border.all(color: AppColors.goldBorder)),
                        child: Text(direction.toUpperCase(),
                          style: AppTheme.inter(fontSize: 10, fontWeight: FontWeight.w700, color: AppColors.goldDark)),
                      ),
                    ],
                  ]),
                  const SizedBox(height: 2),
                  Text(routeName,
                    style: AppTheme.inter(fontSize: 12, color: AppColors.ink6),
                    maxLines: 1, overflow: TextOverflow.ellipsis),
                ],
              ),
            ),
          ]),
          const SizedBox(height: 12),
          SizedBox(
            width: double.infinity,
            height: 42,
            child: FilledButton.icon(
              onPressed: isBusy ? null : onTake,
              icon: isBusy
                  ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                  : const Icon(Icons.add_rounded, size: 18),
              label: Text(isBusy ? 'Reclamando...' : 'Tomar este viaje',
                style: AppTheme.inter(fontSize: 13, fontWeight: FontWeight.w700, color: Colors.white)),
              style: FilledButton.styleFrom(
                backgroundColor: AppColors.gold,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
              ),
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
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 64, height: 64,
              decoration: BoxDecoration(
                color: AppColors.ink1, shape: BoxShape.circle,
                border: Border.all(color: AppColors.ink2),
              ),
              child: const Icon(Icons.list_alt_rounded, size: 30, color: AppColors.ink5),
            ),
            const SizedBox(height: 14),
            Text('Sin viajes disponibles',
              style: AppTheme.inter(fontSize: 15, fontWeight: FontWeight.w700, color: AppColors.ink9)),
            const SizedBox(height: 4),
            Text('Cuando el operador publique viajes sin asignar específicamente, los verás aquí.',
              textAlign: TextAlign.center,
              style: AppTheme.inter(fontSize: 12, color: AppColors.ink5, height: 1.4)),
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
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.error_outline, size: 36, color: AppColors.noApto),
            const SizedBox(height: 12),
            Text(message,
              textAlign: TextAlign.center,
              style: AppTheme.inter(fontSize: 13, color: AppColors.ink7)),
            const SizedBox(height: 12),
            OutlinedButton(onPressed: onRetry, child: const Text('Reintentar')),
          ],
        ),
      ),
    );
  }
}
