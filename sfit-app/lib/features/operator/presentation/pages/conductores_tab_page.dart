import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_theme.dart';
import '../../data/datasources/operator_api_service.dart';
import '../../../../shared/models/conductor_model.dart';

/// Lista de conductores del operador — rol OPERADOR.
class ConductoresTabPage extends ConsumerStatefulWidget {
  const ConductoresTabPage({super.key});

  @override
  ConsumerState<ConductoresTabPage> createState() => _ConductoresTabPageState();
}

class _ConductoresTabPageState extends ConsumerState<ConductoresTabPage> {
  List<ConductorModel> _all = [];
  List<ConductorModel> _filtered = [];
  bool _loading = true;
  String? _error;
  String _filter = 'todos';

  static const _filters = [
    ('todos',    'Todos'),
    ('apto',     'Aptos'),
    ('riesgo',   'En riesgo'),
    ('no_apto',  'No aptos'),
  ];

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) { if (mounted) _load(); });
  }

  Future<void> _load() async {
    setState(() { _loading = true; _error = null; });
    try {
      final svc = ref.read(operatorApiServiceProvider);
      final items = await svc.getConductores(limit: 50);
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
          _error = 'No se pudieron cargar los conductores.';
          _loading = false;
        });
      }
    }
  }

  void _applyFilter() {
    _filtered = _filter == 'todos'
        ? List.of(_all)
        : _all.where((c) => c.status == _filter).toList();
  }

  void _setFilter(String value) {
    setState(() {
      _filter = value;
      _applyFilter();
    });
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
                // Tipografía canónica: headlineSmall (18 / w700 /
                // letterSpacing -0.01). El count badge entra a la
                // derecha del título para refuerzo numérico.
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
                        _CountBadge(count: _all.length),
                    ],
                  ),
                ),

                // ── Filtros ────────────────────────────────────────
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

                // ── Contenido ──────────────────────────────────────
                Expanded(
                  child: _loading
                      ? const Center(
                          child: CircularProgressIndicator(color: AppColors.gold))
                      : _error != null
                          ? _ErrorState(message: _error!, onRetry: _load)
                          : _filtered.isEmpty
                              ? _EmptyState(filter: _filter)
                              : RefreshIndicator(
                                  onRefresh: _load,
                                  color: AppColors.gold,
                                  child: ListView.separated(
                                    padding: const EdgeInsets.fromLTRB(16, 4, 16, 88),
                                    itemCount: _filtered.length,
                                    separatorBuilder: (_, __) =>
                                        const SizedBox(height: 8),
                                    itemBuilder: (_, i) {
                                      final item = _filtered[i];
                                      return _ConductorCard(
                                        item: item,
                                        onTap: () async {
                                          // Navegamos al detalle pasando el
                                          // modelo como seed para mostrar
                                          // datos inmediatamente mientras
                                          // recarga el detalle completo. Si
                                          // el detalle reportó un cambio
                                          // (desasociar, desactivar, editar)
                                          // refrescamos la lista al volver.
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
  final String filter;
  const _EmptyState({required this.filter});

  @override
  Widget build(BuildContext context) {
    final msg = filter == 'todos'
        ? 'No hay conductores registrados'
        : 'No hay conductores con este estado';
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
              filter == 'todos'
                  ? 'Usa "Asociar existente" para vincular conductores '
                      'a tu empresa, o "+" para crear uno nuevo.'
                  : 'Cambia el filtro o actualiza la lista.',
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
