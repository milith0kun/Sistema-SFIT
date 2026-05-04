import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../trips/data/datasources/trips_api_service.dart';

/// Bandeja de viajes pendientes de aceptación (flujo PUSH).
///
/// El operador asigna un viaje desde el dashboard → backend pone status
/// `pendiente_aceptacion` y dispara FCM. Esta pantalla lista esos viajes
/// y permite al conductor aceptarlos o rechazarlos con motivo.
class PendingTripsPage extends ConsumerStatefulWidget {
  const PendingTripsPage({super.key});

  @override
  ConsumerState<PendingTripsPage> createState() => _PendingTripsPageState();
}

class _PendingTripsPageState extends ConsumerState<PendingTripsPage> {
  List<Map<String, dynamic>> _items = [];
  bool _loading = true;
  String? _error;
  String? _busyId; // id del viaje en proceso (accept/reject)

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() { _loading = true; _error = null; });
    try {
      final svc = ref.read(tripsApiServiceProvider);
      final items = await svc.getPendingTrips();
      if (mounted) setState(() { _items = items; _loading = false; });
    } catch (e) {
      if (mounted) setState(() { _error = 'No se pudieron cargar los viajes.'; _loading = false; });
    }
  }

  Future<void> _accept(String tripId) async {
    setState(() => _busyId = tripId);
    try {
      final svc = ref.read(tripsApiServiceProvider);
      await svc.acceptTrip(tripId);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Viaje aceptado'), behavior: SnackBarBehavior.floating),
        );
      }
      await _load();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('No se pudo aceptar: $e'), backgroundColor: AppColors.noApto),
        );
      }
    } finally {
      if (mounted) setState(() => _busyId = null);
    }
  }

  Future<void> _reject(String tripId) async {
    final reason = await _askReason();
    if (reason == null || reason.trim().length < 5) return;
    setState(() => _busyId = tripId);
    try {
      final svc = ref.read(tripsApiServiceProvider);
      await svc.rejectTrip(tripId, reason: reason.trim());
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Viaje rechazado'), behavior: SnackBarBehavior.floating),
        );
      }
      await _load();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('No se pudo rechazar: $e'), backgroundColor: AppColors.noApto),
        );
      }
    } finally {
      if (mounted) setState(() => _busyId = null);
    }
  }

  Future<String?> _askReason() async {
    final ctrl = TextEditingController();
    return showDialog<String>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text('Motivo del rechazo', style: AppTheme.inter(fontSize: 16, fontWeight: FontWeight.w700)),
        content: TextField(
          controller: ctrl,
          maxLines: 3,
          minLines: 2,
          autofocus: true,
          textCapitalization: TextCapitalization.sentences,
          decoration: const InputDecoration(
            hintText: 'Mínimo 5 caracteres. Ej: vehículo en mantenimiento.',
            border: OutlineInputBorder(),
          ),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.of(ctx).pop(), child: const Text('Cancelar')),
          FilledButton(
            onPressed: () => Navigator.of(ctx).pop(ctrl.text),
            style: FilledButton.styleFrom(backgroundColor: AppColors.noApto),
            child: const Text('Rechazar'),
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
        title: Text('Viajes pendientes',
          style: AppTheme.inter(fontSize: 16, fontWeight: FontWeight.w700, color: AppColors.ink9)),
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
                        itemBuilder: (_, i) => _PendingCard(
                          trip: _items[i],
                          isBusy: _busyId == (_items[i]['id'] as String?),
                          onAccept: _accept,
                          onReject: _reject,
                        ),
                      ),
                    ),
    );
  }
}

class _PendingCard extends StatelessWidget {
  final Map<String, dynamic> trip;
  final bool isBusy;
  final Future<void> Function(String) onAccept;
  final Future<void> Function(String) onReject;

  const _PendingCard({
    required this.trip,
    required this.isBusy,
    required this.onAccept,
    required this.onReject,
  });

  @override
  Widget build(BuildContext context) {
    final id = trip['id'] as String? ?? '';
    final vehicle = trip['vehicle'] as Map<String, dynamic>?;
    final route = trip['route'] as Map<String, dynamic>?;
    final plate = vehicle?['plate'] as String? ?? '—';
    final routeName = route?['name'] as String? ?? 'Sin ruta';
    final direction = trip['direction'] as String?;
    final assignedAt = trip['assignedAt'] as String?;

    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.ink2),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.all(14),
            child: Row(children: [
              Container(
                width: 44, height: 44,
                decoration: BoxDecoration(
                  color: AppColors.goldBg,
                  shape: BoxShape.circle,
                  border: Border.all(color: AppColors.goldBorder),
                ),
                child: const Icon(Icons.directions_bus_rounded, size: 22, color: AppColors.goldDark),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(children: [
                      Text(plate,
                        style: AppTheme.inter(fontSize: 16, fontWeight: FontWeight.w800, color: AppColors.ink9, tabular: true)),
                      if (direction != null) ...[
                        const SizedBox(width: 8),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                          decoration: BoxDecoration(
                            color: AppColors.ink1,
                            borderRadius: BorderRadius.circular(4),
                          ),
                          child: Text(direction.toUpperCase(),
                            style: AppTheme.inter(fontSize: 10, fontWeight: FontWeight.w700, color: AppColors.ink6, letterSpacing: 0.5)),
                        ),
                      ],
                    ]),
                    const SizedBox(height: 2),
                    Text(routeName,
                      style: AppTheme.inter(fontSize: 13, color: AppColors.ink6),
                      maxLines: 1, overflow: TextOverflow.ellipsis),
                    if (assignedAt != null) ...[
                      const SizedBox(height: 4),
                      Text('Asignado: ${_timeAgo(assignedAt)}',
                        style: AppTheme.inter(fontSize: 11, color: AppColors.ink5)),
                    ],
                  ],
                ),
              ),
            ]),
          ),
          const Divider(height: 1, color: AppColors.ink1),
          Row(children: [
            Expanded(
              child: TextButton(
                onPressed: isBusy ? null : () => onReject(id),
                style: TextButton.styleFrom(
                  foregroundColor: AppColors.noApto,
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  shape: const RoundedRectangleBorder(
                    borderRadius: BorderRadius.only(bottomLeft: Radius.circular(12)),
                  ),
                ),
                child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                  const Icon(Icons.close, size: 16),
                  const SizedBox(width: 6),
                  Text('Rechazar', style: AppTheme.inter(fontSize: 13, fontWeight: FontWeight.w700)),
                ]),
              ),
            ),
            Container(width: 1, height: 44, color: AppColors.ink1),
            Expanded(
              child: TextButton(
                onPressed: isBusy ? null : () => onAccept(id),
                style: TextButton.styleFrom(
                  foregroundColor: AppColors.apto,
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  shape: const RoundedRectangleBorder(
                    borderRadius: BorderRadius.only(bottomRight: Radius.circular(12)),
                  ),
                ),
                child: isBusy
                    ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.apto))
                    : Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                        const Icon(Icons.check_rounded, size: 18),
                        const SizedBox(width: 6),
                        Text('Aceptar', style: AppTheme.inter(fontSize: 13, fontWeight: FontWeight.w700)),
                      ]),
              ),
            ),
          ]),
        ],
      ),
    );
  }

  static String _timeAgo(String iso) {
    try {
      final dt = DateTime.parse(iso).toLocal();
      final diff = DateTime.now().difference(dt);
      if (diff.inMinutes < 1) return 'ahora';
      if (diff.inMinutes < 60) return 'hace ${diff.inMinutes} min';
      if (diff.inHours < 24) return 'hace ${diff.inHours} h';
      return 'hace ${diff.inDays} d';
    } catch (_) {
      return '—';
    }
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
              child: const Icon(Icons.inbox_outlined, size: 30, color: AppColors.ink5),
            ),
            const SizedBox(height: 14),
            Text('Sin viajes pendientes',
              style: AppTheme.inter(fontSize: 15, fontWeight: FontWeight.w700, color: AppColors.ink9)),
            const SizedBox(height: 4),
            Text('Cuando un operador te asigne un viaje aparecerá aquí.\nTambién puedes ver los disponibles en el catálogo.',
              textAlign: TextAlign.center,
              style: AppTheme.inter(fontSize: 12, color: AppColors.ink5, height: 1.4)),
            const SizedBox(height: 16),
            OutlinedButton.icon(
              onPressed: () => context.push('/conductor/viajes-disponibles'),
              icon: const Icon(Icons.list_alt_rounded, size: 16),
              label: Text('Ver catálogo',
                style: AppTheme.inter(fontSize: 13, fontWeight: FontWeight.w700)),
              style: OutlinedButton.styleFrom(
                foregroundColor: AppColors.gold,
                side: const BorderSide(color: AppColors.goldBorder),
              ),
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
            OutlinedButton(
              onPressed: onRetry,
              child: const Text('Reintentar'),
            ),
          ],
        ),
      ),
    );
  }
}
