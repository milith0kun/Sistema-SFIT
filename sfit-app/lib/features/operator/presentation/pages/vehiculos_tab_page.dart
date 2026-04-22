import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/widgets/sfit_loading.dart';
import '../../data/datasources/operator_api_service.dart';
import '../../data/models/vehicle_model.dart';

/// Lista de vehículos del operador — rol OPERADOR.
class VehiculosTabPage extends ConsumerStatefulWidget {
  const VehiculosTabPage({super.key});

  @override
  ConsumerState<VehiculosTabPage> createState() => _VehiculosTabPageState();
}

class _VehiculosTabPageState extends ConsumerState<VehiculosTabPage> {
  List<VehicleModel> _all = [];
  List<VehicleModel> _filtered = [];
  bool _loading = true;
  String? _error;
  String _filter = 'todos';

  static const _filters = [
    ('todos',          'Todos'),
    ('disponible',     'Disponible'),
    ('en_ruta',        'En ruta'),
    ('mantenimiento',  'Mantenimiento'),
  ];

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() { _loading = true; _error = null; });
    try {
      final svc = ref.read(operatorApiServiceProvider);
      final items = await svc.getVehiculos(limit: 50);
      if (mounted) {
        setState(() {
          _all = items;
          _applyFilter();
          _loading = false;
        });
      }
    } catch (_) {
      if (mounted) {
        setState(() {
          _error = 'No se pudieron cargar los vehículos.';
          _loading = false;
        });
      }
    }
  }

  void _applyFilter() {
    _filtered = _filter == 'todos'
        ? List.of(_all)
        : _all.where((v) => v.status == _filter).toList();
  }

  void _setFilter(String value) {
    setState(() {
      _filter = value;
      _applyFilter();
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.paper,
      floatingActionButton: FloatingActionButton(
        onPressed: () async {
          final added = await context.push<bool>('/nuevo-vehiculo');
          if (added == true && mounted) _load();
        },
        backgroundColor: AppColors.gold,
        foregroundColor: Colors.white,
        tooltip: 'Registrar vehículo',
        child: const Icon(Icons.add_box_outlined),
      ),
      body: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
          // ── Header ───────────────────────────────────────────────
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
            child: Row(
              children: [
                Text(
                  'Vehículos',
                  style: AppTheme.inter(
                    fontSize: 18,
                    fontWeight: FontWeight.w700,
                    color: AppColors.ink9,
                    letterSpacing: -0.015,
                  ),
                ),
                const SizedBox(width: 8),
                if (!_loading && _error == null)
                  _CountBadge(count: _all.length),
              ],
            ),
          ),

          // ── Filtros ───────────────────────────────────────────────
          if (!_loading && _error == null)
            SizedBox(
              height: 36,
              child: ListView(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                scrollDirection: Axis.horizontal,
                children: _filters.map((f) {
                  final (key, label) = f;
                  final selected = _filter == key;
                  return Padding(
                    padding: const EdgeInsets.only(right: 8),
                    child: FilterChip(
                      label: Text(label),
                      selected: selected,
                      onSelected: (_) => _setFilter(key),
                      showCheckmark: false,
                      selectedColor: AppColors.panel,
                      backgroundColor: Colors.white,
                      side: BorderSide(
                        color: selected ? AppColors.panel : AppColors.ink3,
                      ),
                      labelStyle: AppTheme.inter(
                        fontSize: 12.5,
                        fontWeight: FontWeight.w600,
                        color: selected ? Colors.white : AppColors.ink7,
                      ),
                      padding: const EdgeInsets.symmetric(horizontal: 4),
                    ),
                  );
                }).toList(),
              ),
            ),

          const SizedBox(height: 4),

          // ── Contenido ────────────────────────────────────────────
          Expanded(
            child: _loading
                ? const SfitLoading()
                : _error != null
                    ? _ErrorState(message: _error!, onRetry: _load)
                    : _filtered.isEmpty
                        ? _EmptyState(filter: _filter)
                        : RefreshIndicator(
                            onRefresh: _load,
                            color: AppColors.gold,
                            child: ListView.separated(
                              padding:
                                  const EdgeInsets.fromLTRB(16, 4, 16, 24),
                              itemCount: _filtered.length,
                              separatorBuilder: (_, __) =>
                                  const SizedBox(height: 8),
                              itemBuilder: (_, i) => _VehicleCard(
                                    item: _filtered[i],
                                    onTap: () => context.push(
                                        '/inspecciones?vehicleId=${_filtered[i].id}'),
                                    onQrTap: () => context.push(
                                      '/vehiculo-qr',
                                      extra: {
                                        'id':    _filtered[i].id,
                                        'plate': _filtered[i].plate,
                                      },
                                    ),
                                  ),
                            ),
                          ),
          ),
        ],
      ),
      ),
    );
  }
}

// ── Card ─────────────────────────────────────────────────────────────────────

class _VehicleCard extends StatelessWidget {
  final VehicleModel item;
  final VoidCallback? onTap;
  final VoidCallback? onQrTap;
  const _VehicleCard({required this.item, this.onTap, this.onQrTap});

  @override
  Widget build(BuildContext context) {
    final (badgeColor, badgeBg, badgeBorder, badgeLabel) =
        switch (item.status) {
      'disponible'     => (AppColors.apto,   AppColors.aptoBg,   AppColors.aptoBorder,   'DISPONIBLE'),
      'en_ruta'        => (AppColors.riesgo,  AppColors.riesgoBg, AppColors.riesgoBorder,  'EN RUTA'),
      'mantenimiento'  => (AppColors.gold,    AppColors.goldBg,   AppColors.goldBorder,    'MANTENIMIENTO'),
      _                => (AppColors.noApto,  AppColors.noAptoBg, AppColors.noAptoBorder,  'FUERA SERVICIO'),
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
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          // Placa prominente
          Container(
            padding:
                const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
            decoration: BoxDecoration(
              color: AppColors.ink1,
              border: Border.all(color: AppColors.ink3),
              borderRadius: BorderRadius.circular(6),
            ),
            child: Text(
              item.plate,
              style: AppTheme.inter(
                fontSize: 15,
                fontWeight: FontWeight.w800,
                color: AppColors.ink9,
                tabular: true,
                letterSpacing: 0.5,
              ),
            ),
          ),
          const SizedBox(width: 12),

          // Marca + modelo + año + tipo
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  '${item.brand} ${item.model}',
                  style: AppTheme.inter(
                    fontSize: 14,
                    fontWeight: FontWeight.w700,
                    color: AppColors.ink9,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  '${item.year} · ${_vehicleTypeLabel(item.vehicleTypeKey)}',
                  style: AppTheme.inter(
                      fontSize: 12, color: AppColors.ink5),
                ),
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
                fontSize: 10,
                fontWeight: FontWeight.w700,
                color: badgeColor,
                letterSpacing: 0.4,
              ),
            ),
          ),
          // Botón Ver QR
          if (onQrTap != null) ...[
            const SizedBox(width: 6),
            GestureDetector(
              onTap: onQrTap,
              child: Container(
                padding: const EdgeInsets.all(6),
                decoration: BoxDecoration(
                  color: AppColors.goldBg,
                  borderRadius: BorderRadius.circular(6),
                  border: Border.all(color: AppColors.goldBorder),
                ),
                child: const Icon(Icons.qr_code_2_outlined,
                    size: 16, color: AppColors.goldDark),
              ),
            ),
          ],
          // Indicador de navegación
          const SizedBox(width: 4),
          const Icon(Icons.chevron_right, size: 18, color: AppColors.ink3),
        ],
      ),
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
}

// ── Auxiliares ────────────────────────────────────────────────────────────────

class _CountBadge extends StatelessWidget {
  final int count;
  const _CountBadge({required this.count});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
      decoration: BoxDecoration(
        color: AppColors.ink1,
        borderRadius: BorderRadius.circular(20),
      ),
      child: Text(
        '$count',
        style: AppTheme.inter(
          fontSize: 12,
          fontWeight: FontWeight.w700,
          color: AppColors.ink6,
          tabular: true,
        ),
      ),
    );
  }
}

class _EmptyState extends StatelessWidget {
  final String filter;
  const _EmptyState({required this.filter});

  @override
  Widget build(BuildContext context) {
    final msg = filter == 'todos'
        ? 'No hay vehículos registrados'
        : 'No hay vehículos con este estado';
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
              msg,
              textAlign: TextAlign.center,
              style: AppTheme.inter(
                fontSize: 15,
                fontWeight: FontWeight.w700,
                color: AppColors.ink7,
              ),
            ),
            const SizedBox(height: 6),
            Text(
              'Ajusta el filtro o actualiza la lista',
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
            TextButton(onPressed: onRetry, child: const Text('Reintentar')),
          ],
        ),
      ),
    );
  }
}
