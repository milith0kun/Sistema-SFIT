import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_theme.dart';
import '../../data/datasources/inspection_api_service.dart';
import '../../data/models/inspection_model.dart';

/// Lista de inspecciones filtrada por vehículo — para el rol Operador.
class VehicleInspectionsPage extends ConsumerStatefulWidget {
  final String vehicleId;

  const VehicleInspectionsPage({super.key, required this.vehicleId});

  @override
  ConsumerState<VehicleInspectionsPage> createState() =>
      _VehicleInspectionsPageState();
}

class _VehicleInspectionsPageState
    extends ConsumerState<VehicleInspectionsPage> {
  List<InspectionModel> _items = [];
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
      final svc = ref.read(inspectionApiServiceProvider);
      final items = await svc.getInspections(
          vehicleId: widget.vehicleId, limit: 50);
      if (mounted) setState(() { _items = items; _loading = false; });
    } catch (_) {
      if (mounted) {
        setState(() {
          _error = 'No se pudieron cargar las inspecciones.';
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
        title: Text(
          'Inspecciones del vehículo',
          style: AppTheme.inter(fontSize: 15, fontWeight: FontWeight.w700),
        ),
        backgroundColor: AppColors.panel,
        foregroundColor: Colors.white,
      ),
      body: _loading
          ? const Center(
              child: CircularProgressIndicator(color: AppColors.gold))
          : _error != null
              ? _ErrorState(message: _error!, onRetry: _load)
              : _items.isEmpty
                  ? _EmptyState()
                  : RefreshIndicator(
                      onRefresh: _load,
                      color: AppColors.gold,
                      child: ListView.separated(
                        padding:
                            const EdgeInsets.fromLTRB(16, 16, 16, 24),
                        itemCount: _items.length,
                        separatorBuilder: (_, __) =>
                            const SizedBox(height: 8),
                        itemBuilder: (_, i) => _InspectionCard(
                          item: _items[i],
                          onTap: () => context
                              .push('/inspeccion/${_items[i].id}'),
                        ),
                      ),
                    ),
    );
  }
}

class _InspectionCard extends StatelessWidget {
  final InspectionModel item;
  final VoidCallback onTap;

  const _InspectionCard({required this.item, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final (color, bg, border) = switch (item.result) {
      'aprobada' => (AppColors.apto, AppColors.aptoBg, AppColors.aptoBorder),
      'observada' => (
        AppColors.riesgo,
        AppColors.riesgoBg,
        AppColors.riesgoBorder
      ),
      _ => (AppColors.noApto, AppColors.noAptoBg, AppColors.noAptoBorder),
    };

    return InkWell(
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
              width: 52,
              padding: const EdgeInsets.symmetric(vertical: 8),
              decoration: BoxDecoration(
                color: bg,
                border: Border.all(color: border),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Center(
                child: Text(
                  '${item.score}',
                  style: AppTheme.inter(
                    fontSize: 16,
                    fontWeight: FontWeight.w800,
                    color: color,
                    tabular: true,
                  ),
                ),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    _resultLabel(item.result),
                    style: AppTheme.inter(
                      fontSize: 14,
                      fontWeight: FontWeight.w700,
                      color: color,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    _formatDate(item.date),
                    style:
                        AppTheme.inter(fontSize: 12, color: AppColors.ink5),
                  ),
                ],
              ),
            ),
            const Icon(Icons.chevron_right,
                size: 18, color: AppColors.ink3),
          ],
        ),
      ),
    );
  }

  String _resultLabel(String r) => switch (r) {
        'aprobada' => 'Aprobada',
        'observada' => 'Observada',
        _ => 'Rechazada',
      };

  String _formatDate(DateTime d) {
    final now = DateTime.now();
    if (d.day == now.day && d.month == now.month && d.year == now.year) {
      return 'Hoy ${d.hour.toString().padLeft(2, '0')}:${d.minute.toString().padLeft(2, '0')}';
    }
    return '${d.day.toString().padLeft(2, '0')}/${d.month.toString().padLeft(2, '0')}/${d.year}';
  }
}

class _EmptyState extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.assignment_outlined,
                size: 52, color: AppColors.ink3),
            const SizedBox(height: 12),
            Text(
              'Sin inspecciones',
              style: AppTheme.inter(
                fontSize: 16,
                fontWeight: FontWeight.w700,
                color: AppColors.ink7,
              ),
            ),
            const SizedBox(height: 6),
            Text(
              'Este vehículo no tiene inspecciones registradas aún.',
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
            const Icon(Icons.error_outline,
                size: 40, color: AppColors.noApto),
            const SizedBox(height: 10),
            Text(
              message,
              textAlign: TextAlign.center,
              style: AppTheme.inter(fontSize: 13, color: AppColors.ink6),
            ),
            const SizedBox(height: 14),
            TextButton(
                onPressed: onRetry, child: const Text('Reintentar')),
          ],
        ),
      ),
    );
  }
}
