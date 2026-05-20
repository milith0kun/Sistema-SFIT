import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'dart:async';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/widgets/sfit_brand_loading.dart';
import '../../../../shared/widgets/sfit_loading.dart';
import '../../data/datasources/operator_api_service.dart';
import '../../data/models/vehicle_model.dart';

/// Lista de vehículos del operador — rol OPERADOR.
class VehiculosTabPage extends ConsumerStatefulWidget {
  const VehiculosTabPage({super.key});

  @override
  ConsumerState<VehiculosTabPage> createState() => _VehiculosTabPageState();
}

class _VehiculosTabPageState extends ConsumerState<VehiculosTabPage> {
  List<VehicleModel> _items = [];
  bool _loading = true;
  String? _error;
  String _statusFilter = 'todos';
  String _typeFilter = 'todos';
  String _search = '';
  final _searchCtrl = TextEditingController();
  Timer? _debounce;

  static const _statusFilters = [
    ('todos',          'Todos'),
    ('disponible',     'Disponible'),
    ('en_ruta',        'En ruta'),
    ('mantenimiento',  'Mantenimiento'),
  ];

  static const _typeFilters = [
    ('todos',                     'Todos'),
    ('transporte_urbano',         'Urbano'),
    ('transporte_interprovincial', 'Interprovincial'),
  ];

  @override
  void initState() {
    super.initState();
    _searchCtrl.addListener(_onSearchChanged);
    WidgetsBinding.instance.addPostFrameCallback((_) { if (mounted) _load(); });
  }

  @override
  void dispose() {
    _searchCtrl.removeListener(_onSearchChanged);
    _searchCtrl.dispose();
    _debounce?.cancel();
    super.dispose();
  }

  void _onSearchChanged() {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 400), () {
      if (mounted) {
        setState(() => _search = _searchCtrl.text.trim());
        _load();
      }
    });
  }

  Future<void> _load() async {
    setState(() { _loading = true; _error = null; });
    try {
      final svc = ref.read(operatorApiServiceProvider);
      final items = await svc.getVehiculos(
        q: _search.isEmpty ? null : _search,
        status: _statusFilter == 'todos' ? null : _statusFilter,
        type: _typeFilter == 'todos' ? null : _typeFilter,
        limit: 100,
      );
      if (mounted) {
        setState(() {
          _items = items;
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

  void _setStatusFilter(String value) {
    setState(() => _statusFilter = value);
    _load();
  }

  void _setTypeFilter(String value) {
    setState(() => _typeFilter = value);
    _load();
  }

  void _clearSearch() {
    _searchCtrl.clear();
    setState(() => _search = '');
    _load();
  }

  @override
  Widget build(BuildContext context) {
    return ColoredBox(
      color: AppColors.paper,
      child: SafeArea(
        child: Stack(
          fit: StackFit.expand,
          children: [
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // ── Header ─────────────────────────────────────────
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
                        _CountBadge(count: _items.length),
                    ],
                  ),
                ),

                // ── Búsqueda ───────────────────────────────────────
                if (!_loading && _error == null)
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
                    child: TextField(
                      controller: _searchCtrl,
                      decoration: InputDecoration(
                        hintText: 'Buscar por placa, marca o modelo…',
                        prefixIcon: const Icon(Icons.search, size: 18, color: AppColors.ink5),
                        suffixIcon: _searchCtrl.text.isNotEmpty
                            ? IconButton(
                                icon: const Icon(Icons.clear, size: 18),
                                onPressed: _clearSearch,
                              )
                            : null,
                        contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(10),
                          borderSide: const BorderSide(color: AppColors.ink3),
                        ),
                        enabledBorder: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(10),
                          borderSide: const BorderSide(color: AppColors.ink3),
                        ),
                        focusedBorder: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(10),
                          borderSide: const BorderSide(color: AppColors.primary),
                        ),
                        filled: true,
                        fillColor: Colors.white,
                      ),
                      style: AppTheme.inter(fontSize: 13, color: AppColors.ink9),
                    ),
                  ),

                // ── Filtros estado ─────────────────────────────────
                if (!_loading && _error == null)
                  SizedBox(
                    height: 36,
                    child: ListView(
                      padding: const EdgeInsets.symmetric(horizontal: 16),
                      scrollDirection: Axis.horizontal,
                      children: _statusFilters.map((f) {
                        final (key, label) = f;
                        final selected = _statusFilter == key;
                        return Padding(
                          padding: const EdgeInsets.only(right: 6),
                          child: FilterChip(
                            label: Text(label),
                            selected: selected,
                            onSelected: (_) => _setStatusFilter(key),
                            showCheckmark: false,
                            selectedColor: AppColors.panel,
                            backgroundColor: Colors.white,
                            side: BorderSide(
                              color: selected ? AppColors.panel : AppColors.ink3,
                            ),
                            labelStyle: AppTheme.inter(
                              fontSize: 12,
                              fontWeight: FontWeight.w600,
                              color: selected ? Colors.white : AppColors.ink7,
                            ),
                            padding: const EdgeInsets.symmetric(horizontal: 4),
                          ),
                        );
                      }).toList(),
                    ),
                  ),

                // ── Filtros tipo ───────────────────────────────────
                if (!_loading && _error == null)
                  SizedBox(
                    height: 36,
                    child: ListView(
                      padding: const EdgeInsets.symmetric(horizontal: 16),
                      scrollDirection: Axis.horizontal,
                      children: _typeFilters.map((f) {
                        final (key, label) = f;
                        final selected = _typeFilter == key;
                        return Padding(
                          padding: const EdgeInsets.only(right: 6),
                          child: FilterChip(
                            label: Text(label),
                            selected: selected,
                            onSelected: (_) => _setTypeFilter(key),
                            showCheckmark: false,
                            selectedColor: AppColors.gold,
                            backgroundColor: Colors.white,
                            side: BorderSide(
                              color: selected ? AppColors.gold : AppColors.ink3,
                            ),
                            labelStyle: AppTheme.inter(
                              fontSize: 12,
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

                // ── Contenido ──────────────────────────────────────
                Expanded(
                  child: _loading
                      ? const SfitBrandLoading()
                      : _error != null
                          ? _ErrorState(message: _error!, onRetry: _load)
                          : _items.isEmpty
                              ? _EmptyState(
                                  search: _search,
                                  statusFilter: _statusFilter,
                                  typeFilter: _typeFilter,
                                )
                              : RefreshIndicator(
                                  onRefresh: _load,
                                  color: AppColors.gold,
                                  child: ListView.separated(
                                    padding: const EdgeInsets.fromLTRB(16, 4, 16, 88),
                                    itemCount: _items.length,
                                    separatorBuilder: (_, __) =>
                                        const SizedBox(height: 8),
                                    itemBuilder: (_, i) => _VehicleCard(
                                          item: _items[i],
                                          onTap: () => context.push(
                                              '/inspecciones?vehicleId=${_items[i].id}'),
                                          onQrTap: () => context.push(
                                            '/vehiculo-qr',
                                            extra: {
                                              'id':    _items[i].id,
                                              'plate': _items[i].plate,
                                            },
                                          ),
                                        ),
                                  ),
                                ),
                ),
              ],
            ),

            // ── FAB ────────────────────────────────────────────────
            Positioned(
              right: 16,
              bottom: 16,
              child: FloatingActionButton(
                heroTag: 'fab_vehiculos',
                onPressed: () async {
                  final added = await context.push<bool>('/nuevo-vehiculo');
                  if (added == true && mounted) _load();
                },
                backgroundColor: AppColors.gold,
                foregroundColor: Colors.white,
                tooltip: 'Registrar vehículo',
                child: const Icon(Icons.add_box_outlined),
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
        'transporte_urbano'          => 'Transporte urbano',
        'transporte_interprovincial' => 'Transporte interprovincial',
        _                            => k,
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
  final String search;
  final String statusFilter;
  final String typeFilter;
  const _EmptyState({
    required this.search,
    required this.statusFilter,
    required this.typeFilter,
  });

  @override
  Widget build(BuildContext context) {
    String msg;
    if (search.isNotEmpty) {
      msg = 'No se encontraron resultados para "$search"';
    } else if (statusFilter != 'todos' || typeFilter != 'todos') {
      msg = 'No hay vehículos con estos filtros';
    } else {
      msg = 'No hay vehículos registrados';
    }
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
              search.isNotEmpty
                  ? 'Intenta con otro término de búsqueda.'
                  : 'Ajusta los filtros o actualiza la lista',
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
