import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'dart:async';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../shared/widgets/sfit_loading.dart';
import '../../data/datasources/operator_api_service.dart';
import '../../../../shared/models/conductor_model.dart';

/// Lista de conductores del operador — rol OPERADOR.
class ConductoresTabPage extends ConsumerStatefulWidget {
  const ConductoresTabPage({super.key});

  @override
  ConsumerState<ConductoresTabPage> createState() => _ConductoresTabPageState();
}

class _ConductoresTabPageState extends ConsumerState<ConductoresTabPage> {
  List<ConductorModel> _items = [];
  bool _loading = true;
  String? _error;
  String _statusFilter = 'todos';
  String _validityFilter = 'all';
  String _search = '';
  final _searchCtrl = TextEditingController();
  Timer? _debounce;

  static const _statusFilters = [
    ('todos',    'Todos'),
    ('apto',     'Aptos'),
    ('riesgo',   'En riesgo'),
    ('no_apto',  'No aptos'),
  ];

  static const _validityFilters = [
    ('all',            'Todas'),
    ('valid',          'Vigente'),
    ('expiring_soon',  'Por vencer'),
    ('expired',        'Vencida'),
    ('missing',        'Sin fecha'),
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
      final items = await svc.getConductores(
        q: _search.isEmpty ? null : _search,
        status: _statusFilter == 'todos' ? null : _statusFilter,
        validity: _validityFilter == 'all' ? null : _validityFilter,
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
          _error = 'No se pudieron cargar los conductores.';
          _loading = false;
        });
      }
    }
  }

  void _setStatusFilter(String value) {
    setState(() => _statusFilter = value);
    _load();
  }

  void _setValidityFilter(String value) {
    setState(() => _validityFilter = value);
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
                  padding: const EdgeInsets.fromLTRB(16, 16, 16, 10),
                  child: Row(
                    children: [
                      Text(
                        'Conductores',
                        style: AppTheme.inter(
                          fontSize: 18,
                          fontWeight: FontWeight.w700,
                          color: AppColors.ink9,
                          letterSpacing: -0.01,
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
                        hintText: 'Buscar por nombre, DNI o licencia…',
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

                // ── Filtros vigencia licencia ─────────────────────
                if (!_loading && _error == null)
                  SizedBox(
                    height: 36,
                    child: ListView(
                      padding: const EdgeInsets.symmetric(horizontal: 16),
                      scrollDirection: Axis.horizontal,
                      children: _validityFilters.map((f) {
                        final (key, label) = f;
                        final selected = _validityFilter == key;
                        return Padding(
                          padding: const EdgeInsets.only(right: 6),
                          child: FilterChip(
                            label: Text(label),
                            selected: selected,
                            onSelected: (_) => _setValidityFilter(key),
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
                      ? const SfitLoading.page(color: AppColors.gold)
                      : _error != null
                          ? _ErrorState(message: _error!, onRetry: _load)
                          : _items.isEmpty
                              ? _EmptyState(
                                  search: _search,
                                  statusFilter: _statusFilter,
                                  validityFilter: _validityFilter,
                                )
                              : RefreshIndicator(
                                  onRefresh: _load,
                                  color: AppColors.gold,
                                  child: ListView.separated(
                                    padding: const EdgeInsets.fromLTRB(16, 4, 16, 88),
                                    itemCount: _items.length,
                                    separatorBuilder: (_, __) =>
                                        const SizedBox(height: 8),
                                    itemBuilder: (_, i) {
                                      final item = _items[i];
                                      return _ConductorCard(
                                        item: item,
                                        onTap: () async {
                                          final changed =
                                              await context.push<bool>(
                                            '/operador/conductores/${item.id}',
                                            extra: item,
                                          );
                                          if (changed == true && mounted) {
                                            _load();
                                          }
                                        },
                                      );
                                    },
                                  ),
                                ),
                ),
              ],
            ),

            // ── FABs (registrar nuevo + asociar existente) ─────────
            Positioned(
              right: 16,
              bottom: 16,
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  FloatingActionButton.extended(
                    heroTag: 'fab_asociar_conductores',
                    onPressed: () async {
                      await context.push('/operador/asociar-conductores');
                      if (mounted) _load();
                    },
                    backgroundColor: Colors.white,
                    foregroundColor: AppColors.ink9,
                    elevation: 2,
                    icon: const Icon(Icons.link_rounded, size: 18),
                    label: Text(
                      'Asociar existente',
                      style: AppTheme.inter(
                        fontSize: 13,
                        fontWeight: FontWeight.w700,
                        color: AppColors.ink9,
                      ),
                    ),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                      side: const BorderSide(color: AppColors.ink2),
                    ),
                  ),
                  const SizedBox(height: 10),
                  FloatingActionButton(
                    heroTag: 'fab_conductores',
                    onPressed: () async {
                      final added = await context.push<bool>('/nuevo-conductor');
                      if (added == true && mounted) _load();
                    },
                    backgroundColor: AppColors.gold,
                    foregroundColor: Colors.white,
                    tooltip: 'Registrar conductor',
                    child: const Icon(Icons.person_add_outlined),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ── Card ─────────────────────────────────────────────────────────────────────

class _ConductorCard extends StatelessWidget {
  final ConductorModel item;
  final VoidCallback? onTap;
  const _ConductorCard({required this.item, this.onTap});

  @override
  Widget build(BuildContext context) {
    final (avatarBg, badgeColor, badgeBg, badgeBorder, badgeLabel) =
        switch (item.status) {
      'apto'    => (AppColors.aptoBg,    AppColors.apto,   AppColors.aptoBg,   AppColors.aptoBorder,  'APTO'),
      'riesgo'  => (AppColors.riesgoBg,  AppColors.riesgo, AppColors.riesgoBg, AppColors.riesgoBorder,'RIESGO'),
      _         => (AppColors.noAptoBg,  AppColors.noApto, AppColors.noAptoBg, AppColors.noAptoBorder,'NO APTO'),
    };

    final initial =
        item.name.isNotEmpty ? item.name[0].toUpperCase() : '?';

    final card = Container(
      decoration: BoxDecoration(
        color: Colors.white,
        border: Border.all(color: AppColors.ink2, width: 1.5),
        borderRadius: BorderRadius.circular(12),
      ),
      padding: const EdgeInsets.fromLTRB(12, 12, 10, 12),
      child: Row(
        children: [
          // Avatar cuadrado con borde — mismo patrón que el header del
          // detalle (operator_driver_detail_page._Header). Más sólido
          // que CircleAvatar y consistente con tiles del operador.
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              color: avatarBg,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: badgeBorder, width: 1.5),
            ),
            alignment: Alignment.center,
            child: Text(
              initial,
              style: AppTheme.inter(
                fontSize: 18,
                fontWeight: FontWeight.w700,
                color: badgeColor,
              ),
            ),
          ),
          const SizedBox(width: 12),

          // Nombre + categoría
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  item.name,
                  style: AppTheme.inter(
                    fontSize: 14,
                    fontWeight: FontWeight.w700,
                    color: AppColors.ink9,
                    letterSpacing: -0.005,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                if (item.licenseCategory != null) ...[
                  const SizedBox(height: 2),
                  Text(
                    'Licencia ${item.licenseCategory}',
                    style: AppTheme.inter(
                      fontSize: 12,
                      color: AppColors.ink5,
                      letterSpacing: -0.005,
                    ),
                  ),
                ],
                if (item.continuousHours != null) ...[
                  const SizedBox(height: 2),
                  Text(
                    '${item.continuousHours!.toStringAsFixed(1)} h acum.',
                    style: AppTheme.inter(
                      fontSize: 11,
                      color: AppColors.ink4,
                      tabular: true,
                    ),
                  ),
                ],
              ],
            ),
          ),

          // Badge estado — letterSpacing 1.2 (kicker-ligero)
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
                letterSpacing: 1.2,
              ),
            ),
          ),
          if (onTap != null) ...[
            const SizedBox(width: 4),
            const Icon(Icons.chevron_right,
                size: 18, color: AppColors.ink4),
          ],
        ],
      ),
    );

    if (onTap == null) return card;
    // Envolvemos en Material+InkWell para conservar el efecto ripple
    // sobre el Container con bordes redondeados. Detrás del Container
    // hay un Material transparente que recibe el splash.
    return Material(
      color: Colors.transparent,
      child: InkWell(
        borderRadius: BorderRadius.circular(10),
        onTap: onTap,
        child: card,
      ),
    );
  }
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
  final String validityFilter;
  const _EmptyState({
    required this.search,
    required this.statusFilter,
    required this.validityFilter,
  });

  @override
  Widget build(BuildContext context) {
    String msg;
    if (search.isNotEmpty) {
      msg = 'No se encontraron resultados para "$search"';
    } else if (statusFilter != 'todos' || validityFilter != 'all') {
      msg = 'No hay conductores con estos filtros';
    } else {
      msg = 'No hay conductores registrados';
    }
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 64,
              height: 64,
              decoration: BoxDecoration(
                color: AppColors.ink1,
                shape: BoxShape.circle,
                border: Border.all(color: AppColors.ink2, width: 1.5),
              ),
              child:
                  const Icon(Icons.people_outline, size: 28, color: AppColors.ink5),
            ),
            const SizedBox(height: 14),
            Text(
              msg,
              textAlign: TextAlign.center,
              style: AppTheme.inter(
                fontSize: 14.5,
                fontWeight: FontWeight.w700,
                color: AppColors.ink9,
                letterSpacing: -0.005,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              search.isNotEmpty
                  ? 'Intenta con otro término de búsqueda.'
                  : 'Usa "Asociar existente" para vincular conductores '
                      'a tu empresa, o "+" para crear uno nuevo.',
              textAlign: TextAlign.center,
              style: AppTheme.inter(
                fontSize: 12.5,
                color: AppColors.ink5,
                height: 1.4,
                letterSpacing: -0.005,
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
            Container(
              width: 64,
              height: 64,
              decoration: BoxDecoration(
                color: AppColors.noAptoBg,
                shape: BoxShape.circle,
                border: Border.all(color: AppColors.noAptoBorder, width: 1.5),
              ),
              child: const Icon(Icons.error_outline,
                  size: 28, color: AppColors.noApto),
            ),
            const SizedBox(height: 14),
            Text(
              message,
              textAlign: TextAlign.center,
              style: AppTheme.inter(
                fontSize: 13,
                color: AppColors.ink6,
                height: 1.4,
                letterSpacing: -0.005,
              ),
            ),
            const SizedBox(height: 14),
            TextButton(onPressed: onRetry, child: const Text('Reintentar')),
          ],
        ),
      ),
    );
  }
}
