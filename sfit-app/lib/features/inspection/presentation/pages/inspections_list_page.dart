import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_theme.dart';
import '../../data/datasources/inspection_api_service.dart';
import '../../data/models/inspection_model.dart';

/// Lista de inspecciones del fiscal — RF-11.
class InspectionsListPage extends ConsumerStatefulWidget {
  const InspectionsListPage({super.key});

  @override
  ConsumerState<InspectionsListPage> createState() => _InspectionsListPageState();
}

class _InspectionsListPageState extends ConsumerState<InspectionsListPage> {
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
      final items = await svc.getInspections(limit: 50);
      if (mounted) setState(() { _items = items; _loading = false; });
    } catch (_) {
      if (mounted) setState(() { _error = 'No se pudieron cargar las inspecciones.'; _loading = false; });
    }
  }

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: Column(
        children: [
          // ── Header con botón nueva inspección ───────────────────
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
            child: Row(
              children: [
                Expanded(
                  child: Text('Inspecciones',
                      style: AppTheme.inter(
                        fontSize: 18, fontWeight: FontWeight.w800, color: AppColors.ink9,
                      )),
                ),
                FilledButton.icon(
                  onPressed: () => context.push('/qr').then((_) => _load()),
                  icon: const Icon(Icons.qr_code_scanner, size: 16),
                  label: const Text('Escanear QR'),
                  style: FilledButton.styleFrom(
                    backgroundColor: AppColors.panel,
                    shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(8)),
                  ),
                ),
              ],
            ),
          ),

          // ── Lista ─────────────────────────────────────────────
          Expanded(
            child: _loading
                ? const Center(child: CircularProgressIndicator(color: AppColors.gold))
                : _error != null
                    ? _ErrorState(message: _error!, onRetry: _load)
                    : _items.isEmpty
                        ? _EmptyState(onScan: () => context.push('/qr').then((_) => _load()))
                        : RefreshIndicator(
                            onRefresh: _load,
                            color: AppColors.gold,
                            child: ListView.separated(
                              padding: const EdgeInsets.fromLTRB(16, 4, 16, 24),
                              itemCount: _items.length,
                              separatorBuilder: (_, __) => const SizedBox(height: 8),
                              itemBuilder: (_, i) => _InspectionCard(item: _items[i]),
                            ),
                          ),
          ),
        ],
      ),
    );
  }
}

class _InspectionCard extends StatelessWidget {
  final InspectionModel item;
  const _InspectionCard({required this.item});

  @override
  Widget build(BuildContext context) {
    final (color, bg, border) = switch (item.result) {
      'aprobada'  => (AppColors.apto,   AppColors.aptoBg,   AppColors.aptoBorder),
      'observada' => (AppColors.riesgo, AppColors.riesgoBg, AppColors.riesgoBorder),
      _           => (AppColors.noApto, AppColors.noAptoBg, AppColors.noAptoBorder),
    };

    final plate = item.vehicle?.plate ?? '—';
    final type  = item.vehicle?.vehicleTypeKey ?? item.vehicleTypeKey;

    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        border: Border.all(color: AppColors.ink2),
        borderRadius: BorderRadius.circular(10),
      ),
      padding: const EdgeInsets.all(12),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
            decoration: BoxDecoration(
              color: bg, border: Border.all(color: border),
              borderRadius: BorderRadius.circular(6),
            ),
            child: Text(
              '${item.score}',
              style: AppTheme.inter(
                  fontSize: 16, fontWeight: FontWeight.w800, color: color),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(plate,
                    style: AppTheme.inter(
                        fontSize: 14, fontWeight: FontWeight.w700, color: AppColors.ink9)),
                Text(_vehicleTypeLabel(type),
                    style: AppTheme.inter(fontSize: 12, color: AppColors.ink5)),
              ],
            ),
          ),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(
                _resultLabel(item.result),
                style: AppTheme.inter(
                    fontSize: 12, fontWeight: FontWeight.w700, color: color),
              ),
              Text(
                _formatDate(item.date),
                style: AppTheme.inter(fontSize: 11, color: AppColors.ink4),
              ),
            ],
          ),
        ],
      ),
    );
  }

  String _vehicleTypeLabel(String k) => switch (k) {
        'transporte_publico' => 'Transporte público',
        'limpieza_residuos'  => 'Limpieza',
        'emergencia'         => 'Emergencia',
        'maquinaria'         => 'Maquinaria',
        _                    => 'Municipal',
      };

  String _resultLabel(String r) => switch (r) {
        'aprobada'  => 'Aprobada',
        'observada' => 'Observada',
        _           => 'Rechazada',
      };

  String _formatDate(DateTime d) {
    final now = DateTime.now();
    if (d.day == now.day && d.month == now.month) return 'Hoy';
    return '${d.day}/${d.month}/${d.year}';
  }
}

class _EmptyState extends StatelessWidget {
  final VoidCallback onScan;
  const _EmptyState({required this.onScan});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.assignment_outlined, size: 52, color: AppColors.ink3),
            const SizedBox(height: 12),
            Text('Sin inspecciones hoy',
                style: AppTheme.inter(
                    fontSize: 16, fontWeight: FontWeight.w700, color: AppColors.ink7)),
            const SizedBox(height: 6),
            Text('Escanea el QR de un vehículo para iniciar',
                textAlign: TextAlign.center,
                style: AppTheme.inter(fontSize: 13, color: AppColors.ink5)),
            const SizedBox(height: 18),
            FilledButton.icon(
              onPressed: onScan,
              icon: const Icon(Icons.qr_code_scanner, size: 18),
              label: const Text('Escanear QR'),
              style: FilledButton.styleFrom(
                backgroundColor: AppColors.panel,
                shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(8)),
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
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.error_outline, size: 40, color: AppColors.noApto),
            const SizedBox(height: 10),
            Text(message, textAlign: TextAlign.center,
                style: AppTheme.inter(fontSize: 13, color: AppColors.ink6)),
            const SizedBox(height: 14),
            TextButton(onPressed: onRetry, child: const Text('Reintentar')),
          ],
        ),
      ),
    );
  }
}
