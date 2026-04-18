import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_theme.dart';
import '../../data/datasources/driver_api_service.dart';

/// Tab de conductores para el rol Operador — RF-05.
class DriversListPage extends ConsumerStatefulWidget {
  const DriversListPage({super.key});

  @override
  ConsumerState<DriversListPage> createState() => _DriversListPageState();
}

class _DriversListPageState extends ConsumerState<DriversListPage> {
  List<Map<String, dynamic>> _drivers = [];
  bool _loading = true;
  String? _error;
  String? _statusFilter;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() { _loading = true; _error = null; });
    try {
      final svc = ref.read(driverApiServiceProvider);
      final data = await svc.getDrivers(status: _statusFilter);
      if (mounted) {
        setState(() {
          _drivers = List<Map<String, dynamic>>.from(data['items'] as List);
          _loading = false;
        });
      }
    } catch (e) {
      if (mounted) setState(() { _loading = false; _error = e.toString(); });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        // ── Filtros ──────────────────────────────────────────────
        _FilterBar(
          selected: _statusFilter,
          onChanged: (v) { setState(() => _statusFilter = v); _load(); },
        ),
        // ── Lista ────────────────────────────────────────────────
        Expanded(
          child: _loading
              ? const Center(child: CircularProgressIndicator(color: AppColors.gold))
              : _error != null
                  ? _ErrorView(onRetry: _load)
                  : _drivers.isEmpty
                      ? const _EmptyView()
                      : RefreshIndicator(
                          onRefresh: _load,
                          color: AppColors.gold,
                          child: ListView.separated(
                            padding: const EdgeInsets.all(12),
                            itemCount: _drivers.length,
                            separatorBuilder: (_, __) => const SizedBox(height: 8),
                            itemBuilder: (_, i) => _DriverCard(driver: _drivers[i]),
                          ),
                        ),
        ),
      ],
    );
  }
}

class _FilterBar extends StatelessWidget {
  final String? selected;
  final ValueChanged<String?> onChanged;
  const _FilterBar({required this.selected, required this.onChanged});

  @override
  Widget build(BuildContext context) {
    const filters = [
      (null, 'Todos'),
      ('apto', 'Aptos'),
      ('riesgo', 'En riesgo'),
      ('no_apto', 'No aptos'),
    ];
    return Container(
      color: AppColors.paper,
      padding: const EdgeInsets.fromLTRB(12, 8, 12, 8),
      child: SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        child: Row(
          children: filters.map((f) {
            final isSelected = selected == f.$1;
            return Padding(
              padding: const EdgeInsets.only(right: 8),
              child: FilterChip(
                label: Text(f.$2,
                    style: AppTheme.inter(
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                      color: isSelected ? Colors.white : AppColors.ink6,
                    )),
                selected: isSelected,
                onSelected: (_) => onChanged(f.$1),
                backgroundColor: Colors.white,
                selectedColor: AppColors.panel,
                checkmarkColor: Colors.white,
                side: BorderSide(
                  color: isSelected ? AppColors.panel : AppColors.ink2,
                ),
                padding: const EdgeInsets.symmetric(horizontal: 4),
                visualDensity: VisualDensity.compact,
              ),
            );
          }).toList(),
        ),
      ),
    );
  }
}

class _DriverCard extends StatelessWidget {
  final Map<String, dynamic> driver;
  const _DriverCard({required this.driver});

  @override
  Widget build(BuildContext context) {
    final status = driver['status'] as String? ?? 'apto';
    final ch = (driver['continuousHours'] as num?)?.toDouble() ?? 0;
    final rh = (driver['restHours'] as num?)?.toDouble() ?? 0;
    final rep = (driver['reputationScore'] as num?)?.toInt() ?? 100;

    final (statusColor, statusBg, statusLabel) = switch (status) {
      'apto'    => (AppColors.apto,    AppColors.aptoBg,    'APTO'),
      'riesgo'  => (AppColors.riesgo,  AppColors.riesgoBg,  'RIESGO'),
      'no_apto' => (AppColors.noApto,  AppColors.noAptoBg,  'NO APTO'),
      _         => (AppColors.ink5,    AppColors.ink1,      status.toUpperCase()),
    };

    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.ink1),
      ),
      padding: const EdgeInsets.all(14),
      child: Row(
        children: [
          CircleAvatar(
            radius: 22,
            backgroundColor: statusBg,
            child: Text(
              (driver['name'] as String? ?? 'X')[0].toUpperCase(),
              style: AppTheme.inter(
                fontSize: 16, fontWeight: FontWeight.w700, color: statusColor),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(driver['name'] as String? ?? '—',
                    style: AppTheme.inter(
                      fontSize: 14, fontWeight: FontWeight.w600, color: AppColors.ink9)),
                const SizedBox(height: 2),
                Text(
                  'Lic. ${driver['licenseCategory'] ?? '—'}  ·  DNI ${driver['dni'] ?? '—'}',
                  style: AppTheme.inter(fontSize: 12, color: AppColors.ink5),
                ),
                const SizedBox(height: 6),
                Row(children: [
                  _Chip(label: '${ch.toStringAsFixed(0)}h conducción',
                      color: ch >= 8 ? AppColors.riesgo : AppColors.ink5),
                  const SizedBox(width: 6),
                  _Chip(label: '${rh.toStringAsFixed(0)}h descanso',
                      color: AppColors.ink5),
                  const SizedBox(width: 6),
                  _Chip(label: '⭐ $rep', color: AppColors.goldDark),
                ]),
              ],
            ),
          ),
          const SizedBox(width: 8),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
            decoration: BoxDecoration(
              color: statusBg,
              borderRadius: BorderRadius.circular(6),
            ),
            child: Text(statusLabel,
                style: AppTheme.inter(
                  fontSize: 10, fontWeight: FontWeight.w700, color: statusColor)),
          ),
        ],
      ),
    );
  }
}

class _Chip extends StatelessWidget {
  final String label;
  final Color color;
  const _Chip({required this.label, required this.color});

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.08),
          borderRadius: BorderRadius.circular(4),
        ),
        child: Text(label,
            style: AppTheme.inter(fontSize: 11, color: color, fontWeight: FontWeight.w600)),
      );
}

class _EmptyView extends StatelessWidget {
  const _EmptyView();
  @override
  Widget build(BuildContext context) => Center(
        child: Text('Sin conductores registrados.',
            style: AppTheme.inter(fontSize: 14, color: AppColors.ink4)),
      );
}

class _ErrorView extends StatelessWidget {
  final VoidCallback onRetry;
  const _ErrorView({required this.onRetry});
  @override
  Widget build(BuildContext context) => Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.error_outline, color: AppColors.noApto, size: 32),
            const SizedBox(height: 8),
            Text('Error al cargar conductores.',
                style: AppTheme.inter(fontSize: 14, color: AppColors.ink6)),
            const SizedBox(height: 12),
            TextButton(onPressed: onRetry, child: const Text('Reintentar')),
          ],
        ),
      );
}
