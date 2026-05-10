import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import '../../../../shared/widgets/map/sfit_map_tiles.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:latlong2/latlong.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../shared/models/route_candidate_model.dart';
import '../../../../shared/models/route_model.dart';
import '../../data/datasources/operator_api_service.dart';
import '../widgets/department_filter_chip.dart';

/// Tipo público usado por GoRouter como `extra` para navegar al detalle y
/// formulario de validación de una captura GPS candidata.
typedef Candidate = RouteCandidateModel;

/// Listado de rutas asociadas a la empresa del operador — RF-09 mobile.
///
/// Tiene dos tabs:
/// - **Oficiales**: rutas formales con paraderos y horarios.
/// - **Candidatas**: capturas GPS pendientes de validar (cuando un conductor
///   cierra turno sin asociar una ruta oficial, queda como candidata).
class OperatorRoutesPage extends ConsumerStatefulWidget {
  const OperatorRoutesPage({super.key});

  @override
  ConsumerState<OperatorRoutesPage> createState() =>
      _OperatorRoutesPageState();
}

class _OperatorRoutesPageState extends ConsumerState<OperatorRoutesPage>
    with SingleTickerProviderStateMixin {
  late final TabController _tabs;

  @override
  void initState() {
    super.initState();
    _tabs = TabController(length: 2, vsync: this);
  }

  @override
  void dispose() {
    _tabs.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final routesAsync = ref.watch(operadorRoutesProvider);
    final candidatesAsync = ref.watch(routeCandidatesProvider);
    final candidatesCount =
        candidatesAsync.maybeWhen(data: (it) => it.length, orElse: () => 0);

    return Scaffold(
      backgroundColor: AppColors.paper,
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        surfaceTintColor: Colors.transparent,
        title: Text(
          'Mis rutas',
          style: AppTheme.inter(
            fontSize: 16,
            fontWeight: FontWeight.w700,
            color: AppColors.ink9,
          ),
        ),
        bottom: TabBar(
          controller: _tabs,
          labelColor: AppColors.primary,
          unselectedLabelColor: AppColors.ink5,
          indicatorColor: AppColors.primary,
          labelStyle:
              AppTheme.inter(fontSize: 12.5, fontWeight: FontWeight.w700),
          unselectedLabelStyle:
              AppTheme.inter(fontSize: 12.5, fontWeight: FontWeight.w500),
          tabs: [
            const Tab(text: 'Oficiales'),
            Tab(
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Text('Candidatas'),
                  if (candidatesCount > 0) ...[
                    const SizedBox(width: 6),
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 6,
                        vertical: 2,
                      ),
                      decoration: BoxDecoration(
                        color: AppColors.primary,
                        borderRadius: BorderRadius.circular(999),
                      ),
                      child: Text(
                        '$candidatesCount',
                        style: AppTheme.inter(
                          fontSize: 10,
                          fontWeight: FontWeight.w800,
                          color: Colors.white,
                          tabular: true,
                        ),
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ],
        ),
      ),
      body: TabBarView(
        controller: _tabs,
        children: [
          _OfficialTab(
            routesAsync: routesAsync,
            onRefresh: () => ref.refresh(operadorRoutesProvider.future),
          ),
          _CandidatesTab(
            candidatesAsync: candidatesAsync,
            onRefresh: () => ref.refresh(routeCandidatesProvider.future),
          ),
        ],
      ),
      floatingActionButton: AnimatedBuilder(
        animation: _tabs,
        builder: (_, __) => _tabs.index == 0
            ? FloatingActionButton.extended(
                onPressed: () {
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(
                      content: const Text(
                        'Crea la ruta desde el panel web. Aquí podrás editarla.',
                      ),
                      behavior: SnackBarBehavior.floating,
                      backgroundColor: AppColors.ink9,
                      action: SnackBarAction(
                        label: 'OK',
                        textColor: Colors.white,
                        onPressed: () {},
                      ),
                    ),
                  );
                },
                backgroundColor: AppColors.primary,
                foregroundColor: Colors.white,
                icon: const Icon(Icons.add, size: 18),
                label: Text(
                  'Nueva ruta',
                  style: AppTheme.inter(
                    fontSize: 13,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              )
            : const SizedBox.shrink(),
      ),
    );
  }
}

// ── Tab: Oficiales ────────────────────────────────────────────────────────

class _OfficialTab extends ConsumerWidget {
  final AsyncValue<List<RouteModel>> routesAsync;
  final Future<void> Function() onRefresh;

  const _OfficialTab({
    required this.routesAsync,
    required this.onRefresh,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    // Construye opciones del filtro a partir de los departamentos de la
    // empresa del operador. Si la empresa cubre 1 solo depto, el widget
    // DepartmentFilterChip se oculta automáticamente.
    final dashboard = ref.watch(operatorDashboardProvider);
    final deptOptions = dashboard.maybeWhen(
      data: (s) => (s.company?.departmentCodes ?? const <String>[])
          .map((c) => DepartmentOption(
                code: c,
                label: kPeruDepartments[c] ?? c,
              ))
          .toList(),
      orElse: () => const <DepartmentOption>[],
    );
    final selectedDept = ref.watch(selectedRoutesDepartmentProvider);

    return Column(
      children: [
        if (deptOptions.length >= 2)
          DepartmentFilterChip(
            options: deptOptions,
            selectedCode: selectedDept,
            onChanged: (code) {
              ref.read(selectedRoutesDepartmentProvider.notifier).state = code;
            },
          ),
        Expanded(
          child: _buildList(context, ref),
        ),
      ],
    );
  }

  Widget _buildList(BuildContext context, WidgetRef ref) {
    return RefreshIndicator(
      color: AppColors.primary,
      onRefresh: onRefresh,
      child: routesAsync.when(
        loading: () => const Center(
          child: CircularProgressIndicator(color: AppColors.primary),
        ),
        error: (_, __) => ListView(children: [
          const SizedBox(height: 80),
          Center(
            child: Padding(
              padding: const EdgeInsets.all(24),
              child: Column(children: [
                const Icon(
                  Icons.route_outlined,
                  size: 36,
                  color: AppColors.ink4,
                ),
                const SizedBox(height: 10),
                Text(
                  'Sin rutas',
                  style: AppTheme.inter(
                    fontSize: 14,
                    fontWeight: FontWeight.w700,
                    color: AppColors.ink8,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  'Crea una ruta desde el panel web.',
                  textAlign: TextAlign.center,
                  style: AppTheme.inter(
                    fontSize: 12,
                    color: AppColors.ink5,
                  ),
                ),
              ]),
            ),
          ),
        ]),
        data: (routes) {
          if (routes.isEmpty) {
            return ListView(children: [
              const SizedBox(height: 80),
              Center(
                child: Padding(
                  padding: const EdgeInsets.all(24),
                  child: Column(children: [
                    const Icon(
                      Icons.route_outlined,
                      size: 36,
                      color: AppColors.ink4,
                    ),
                    const SizedBox(height: 10),
                    Text(
                      'Sin rutas',
                      style: AppTheme.inter(
                        fontSize: 14,
                        fontWeight: FontWeight.w700,
                        color: AppColors.ink8,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      'Crea una ruta desde el panel web.',
                      textAlign: TextAlign.center,
                      style: AppTheme.inter(
                        fontSize: 12,
                        color: AppColors.ink5,
                      ),
                    ),
                  ]),
                ),
              ),
            ]);
          }
          return ListView.separated(
            padding: const EdgeInsets.fromLTRB(12, 10, 12, 96),
            itemCount: routes.length,
            separatorBuilder: (_, __) => const SizedBox(height: 8),
            itemBuilder: (_, i) {
              final r = routes[i];
              return _RouteCard(
                route: r,
                onTap: () => context
                    .push('/operador/rutas/${r.id}/editar')
                    .then((_) => onRefresh()),
              );
            },
          );
        },
      ),
    );
  }
}

// ── Tab: Candidatas ───────────────────────────────────────────────────────

class _CandidatesTab extends ConsumerStatefulWidget {
  final AsyncValue<List<RouteCandidateModel>> candidatesAsync;
  final Future<void> Function() onRefresh;

  const _CandidatesTab({
    required this.candidatesAsync,
    required this.onRefresh,
  });

  @override
  ConsumerState<_CandidatesTab> createState() => _CandidatesTabState();
}

class _CandidatesTabState extends ConsumerState<_CandidatesTab> {
  // IDs seleccionados para comparativa side-by-side. Limitado a 3 — más
  // columnas en pantallas móviles encogen los mini-mapas a tamaño inútil.
  final Set<String> _selected = {};
  static const int _maxSelectable = 3;

  void _toggleSelection(String id) {
    setState(() {
      if (_selected.contains(id)) {
        _selected.remove(id);
      } else if (_selected.length < _maxSelectable) {
        _selected.add(id);
      } else {
        // Reemplaza la primera selección — patrón común en pickers de N.
        _selected.remove(_selected.first);
        _selected.add(id);
      }
    });
  }

  void _clearSelection() => setState(() => _selected.clear());

  void _openCompare(List<RouteCandidateModel> all) {
    final picks = all.where((c) => _selected.contains(c.id)).toList();
    if (picks.length < 2) return;
    context.push('/operador/candidatas/comparar', extra: picks);
  }

  @override
  Widget build(BuildContext context) {
    return Stack(children: [
      RefreshIndicator(
        color: AppColors.primary,
        onRefresh: widget.onRefresh,
        child: widget.candidatesAsync.when(
          loading: () => const Center(
            child: CircularProgressIndicator(color: AppColors.primary),
          ),
          error: (_, __) => _emptyCandidates(),
          data: (items) {
            if (items.isEmpty) return _emptyCandidates();
            return ListView.separated(
              padding: const EdgeInsets.fromLTRB(12, 10, 12, 96),
              itemCount: items.length,
              separatorBuilder: (_, __) => const SizedBox(height: 10),
              itemBuilder: (_, i) {
                final c = items[i];
                final isSelected = _selected.contains(c.id);
                return _CandidateCard(
                  candidate: c,
                  selected: isSelected,
                  selectionActive: _selected.isNotEmpty,
                  onTap: () {
                    if (_selected.isNotEmpty) {
                      _toggleSelection(c.id);
                    } else {
                      context
                          .push('/operador/rutas/candidatas/${c.id}', extra: c)
                          .then((_) => widget.onRefresh());
                    }
                  },
                  onLongPress: () => _toggleSelection(c.id),
                );
              },
            );
          },
        ),
      ),
      // Floating "Comparar (N)" — solo visible cuando hay ≥2 seleccionadas.
      // Pulsación abre la pantalla side-by-side; la X cancela la selección.
      if (_selected.length >= 2)
        Positioned(
          right: 14,
          bottom: 14,
          child: widget.candidatesAsync.maybeWhen(
            data: (items) => Row(children: [
              FloatingActionButton.small(
                heroTag: 'cancel_compare',
                backgroundColor: AppColors.ink2,
                onPressed: _clearSelection,
                child: const Icon(Icons.close, color: AppColors.ink8),
              ),
              const SizedBox(width: 8),
              FloatingActionButton.extended(
                heroTag: 'open_compare',
                backgroundColor: AppColors.primary,
                onPressed: () => _openCompare(items),
                icon: const Icon(Icons.compare_arrows, color: Colors.white),
                label: Text(
                  'Comparar (${_selected.length})',
                  style: AppTheme.inter(
                    fontSize: 13,
                    fontWeight: FontWeight.w700,
                    color: Colors.white,
                  ),
                ),
              ),
            ]),
            orElse: () => const SizedBox.shrink(),
          ),
        ),
    ]);
  }

  Widget _emptyCandidates() => ListView(children: [
        const SizedBox(height: 80),
        Center(
          child: Padding(
            padding: const EdgeInsets.all(28),
            child: Column(children: [
              const Icon(
                Icons.timeline_outlined,
                size: 40,
                color: AppColors.ink4,
              ),
              const SizedBox(height: 12),
              Text(
                'Aún no hay rutas candidatas',
                style: AppTheme.inter(
                  fontSize: 14,
                  fontWeight: FontWeight.w700,
                  color: AppColors.ink8,
                ),
              ),
              const SizedBox(height: 6),
              Text(
                'Cuando un conductor cierre turno sin asociar ruta, la captura aparecerá acá para que la valides.',
                textAlign: TextAlign.center,
                style: AppTheme.inter(
                  fontSize: 12,
                  color: AppColors.ink5,
                  height: 1.4,
                ),
              ),
            ]),
          ),
        ),
      ]);
}

class _CandidateCard extends StatelessWidget {
  final RouteCandidateModel candidate;
  final VoidCallback onTap;
  final VoidCallback? onLongPress;
  /// `true` cuando esta tarjeta está marcada para la comparativa.
  final bool selected;
  /// `true` mientras hay alguna selección activa: cambia el affordance del
  /// tap (selecciona/deselecciona en vez de abrir detalle).
  final bool selectionActive;
  const _CandidateCard({
    required this.candidate,
    required this.onTap,
    this.onLongPress,
    this.selected = false,
    this.selectionActive = false,
  });

  @override
  Widget build(BuildContext context) {
    final score = ((candidate.avgConfidence ?? 0) * 100).round();
    final scoreColor = score >= 80
        ? AppColors.apto
        : score >= 60
            ? AppColors.riesgo
            : AppColors.noApto;
    final scoreBg = score >= 80
        ? AppColors.aptoBg
        : score >= 60
            ? AppColors.riesgoBg
            : AppColors.noAptoBg;
    final scoreBorder = score >= 80
        ? AppColors.aptoBorder
        : score >= 60
            ? AppColors.riesgoBorder
            : AppColors.noAptoBorder;
    final poly = pointsToLatLng(candidate.points);
    final title = candidate.suggestedName?.trim().isNotEmpty == true
        ? candidate.suggestedName!
        : 'Captura GPS';
    final distance = (candidate.distanceMeters ?? 0).round();

    return Material(
      color: selected ? AppColors.primary.withValues(alpha: 0.05) : Colors.white,
      borderRadius: BorderRadius.circular(14),
      child: InkWell(
        onTap: onTap,
        onLongPress: onLongPress,
        borderRadius: BorderRadius.circular(14),
        child: Container(
          decoration: BoxDecoration(
            border: Border.all(
              color: selected ? AppColors.primary : AppColors.ink2,
              width: selected ? 2 : 1,
            ),
            borderRadius: BorderRadius.circular(14),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // ── Mini-mapa ────────────────────────────────────────
              ClipRRect(
                borderRadius: const BorderRadius.vertical(
                  top: Radius.circular(14),
                ),
                child: SizedBox(
                  height: 130,
                  child: _MiniMap(samplePolyline: poly),
                ),
              ),
              // ── Datos ────────────────────────────────────────────
              Padding(
                padding: const EdgeInsets.all(12),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(children: [
                      const Icon(
                        Icons.timeline_outlined,
                        size: 15,
                        color: AppColors.ink6,
                      ),
                      const SizedBox(width: 4),
                      Expanded(
                        child: Text(
                          title,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: AppTheme.inter(
                            fontSize: 13,
                            fontWeight: FontWeight.w700,
                            color: AppColors.ink9,
                          ),
                        ),
                      ),
                    ]),
                    const SizedBox(height: 10),
                    Row(children: [
                      _Pill(
                        icon: Icons.straighten_outlined,
                        label: formatDistance(distance),
                      ),
                      const SizedBox(width: 6),
                      _Pill(
                        icon: Icons.timeline_outlined,
                        label: '${candidate.sampleCount ?? 0} pts',
                      ),
                      const SizedBox(width: 6),
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 8,
                          vertical: 4,
                        ),
                        decoration: BoxDecoration(
                          color: scoreBg,
                          border: Border.all(color: scoreBorder),
                          borderRadius: BorderRadius.circular(999),
                        ),
                        child: Text(
                          'Score $score',
                          style: AppTheme.inter(
                            fontSize: 10.5,
                            fontWeight: FontWeight.w800,
                            color: scoreColor,
                            tabular: true,
                          ),
                        ),
                      ),
                      const Spacer(),
                      Text(
                        ago(candidate.createdAt),
                        style: AppTheme.inter(
                          fontSize: 11,
                          color: AppColors.ink5,
                        ),
                      ),
                    ]),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _MiniMap extends StatelessWidget {
  final List<LatLng> samplePolyline;
  const _MiniMap({required this.samplePolyline});

  @override
  Widget build(BuildContext context) {
    if (samplePolyline.length < 2) {
      return Container(
        color: AppColors.ink1,
        alignment: Alignment.center,
        child: Icon(
          Icons.map_outlined,
          size: 28,
          color: AppColors.ink4.withValues(alpha: 0.7),
        ),
      );
    }
    final bounds = LatLngBounds.fromPoints(samplePolyline);
    return AbsorbPointer(
      child: FlutterMap(
        options: MapOptions(
          initialCameraFit: CameraFit.bounds(
            bounds: bounds,
            padding: const EdgeInsets.all(18),
          ),
          interactionOptions: const InteractionOptions(
            flags: InteractiveFlag.none,
          ),
        ),
        children: [
          sfitCartoVoyagerTile(),
          PolylineLayer(polylines: [
            Polyline(
              points: samplePolyline,
              color: AppColors.primary,
              strokeWidth: 3.5,
            ),
          ]),
          MarkerLayer(markers: [
            Marker(
              point: samplePolyline.first,
              width: 14,
              height: 14,
              child: Container(
                decoration: BoxDecoration(
                  color: AppColors.apto,
                  shape: BoxShape.circle,
                  border: Border.all(color: Colors.white, width: 2),
                ),
              ),
            ),
            Marker(
              point: samplePolyline.last,
              width: 14,
              height: 14,
              child: Container(
                decoration: BoxDecoration(
                  color: AppColors.noApto,
                  shape: BoxShape.circle,
                  border: Border.all(color: Colors.white, width: 2),
                ),
              ),
            ),
          ]),
        ],
      ),
    );
  }
}

class _Pill extends StatelessWidget {
  final IconData icon;
  final String label;
  const _Pill({required this.icon, required this.label});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: AppColors.ink1,
        border: Border.all(color: AppColors.ink2),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Row(mainAxisSize: MainAxisSize.min, children: [
        Icon(icon, size: 12, color: AppColors.ink6),
        const SizedBox(width: 4),
        Text(
          label,
          style: AppTheme.inter(
            fontSize: 10.5,
            fontWeight: FontWeight.w700,
            color: AppColors.ink7,
            tabular: true,
          ),
        ),
      ]),
    );
  }
}

// ── Tarjeta de ruta oficial (igual al diseño previo) ─────────────────────

class _RouteCard extends StatelessWidget {
  final RouteModel route;
  final VoidCallback onTap;
  const _RouteCard({required this.route, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final scope = route.type ?? 'urbano_distrital';
    final scopeInfo = _scopeInfo(scope);
    final code = route.code ?? '';
    final name = route.name ?? '';
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: Colors.white,
          border: Border.all(color: AppColors.ink2),
          borderRadius: BorderRadius.circular(12),
        ),
        child: Row(children: [
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              color: scopeInfo.bg,
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: scopeInfo.border),
            ),
            alignment: Alignment.center,
            child: Icon(scopeInfo.icon, size: 22, color: scopeInfo.fg),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(children: [
                  if (code.isNotEmpty) ...[
                    Container(
                      padding:
                          const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                      decoration: BoxDecoration(
                        color: AppColors.ink1,
                        borderRadius: BorderRadius.circular(4),
                      ),
                      child: Text(
                        code,
                        style: AppTheme.inter(
                          fontSize: 10,
                          fontWeight: FontWeight.w700,
                          color: AppColors.ink7,
                        ),
                      ),
                    ),
                    const SizedBox(width: 6),
                  ],
                  Expanded(
                    child: Text(
                      name,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: AppTheme.inter(
                        fontSize: 14,
                        fontWeight: FontWeight.w700,
                        color: AppColors.ink9,
                      ),
                    ),
                  ),
                ]),
                const SizedBox(height: 4),
                Wrap(spacing: 8, runSpacing: 4, children: [
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 6,
                      vertical: 2,
                    ),
                    decoration: BoxDecoration(
                      color: scopeInfo.bg,
                      border: Border.all(color: scopeInfo.border),
                      borderRadius: BorderRadius.circular(999),
                    ),
                    child: Text(
                      scopeInfo.label,
                      style: AppTheme.inter(
                        fontSize: 9.5,
                        fontWeight: FontWeight.w700,
                        color: scopeInfo.fg,
                        letterSpacing: 0.4,
                      ),
                    ),
                  ),
                  Text(
                    _isUrbano(scope)
                        ? '${route.waypoints.length} paraderos'
                        : '${route.stops ?? 0} paradas',
                    style: AppTheme.inter(
                      fontSize: 11.5,
                      color: AppColors.ink5,
                    ),
                  ),
                ]),
              ],
            ),
          ),
          const Icon(
            Icons.chevron_right,
            size: 18,
            color: AppColors.ink4,
          ),
        ]),
      ),
    );
  }
}

bool _isUrbano(String s) =>
    s == 'urbano_distrital' || s == 'urbano_provincial';

class _ScopeInfo {
  final String label;
  final IconData icon;
  final Color fg;
  final Color bg;
  final Color border;
  const _ScopeInfo({
    required this.label,
    required this.icon,
    required this.fg,
    required this.bg,
    required this.border,
  });
}

_ScopeInfo _scopeInfo(String s) => switch (s) {
      'urbano_distrital' => const _ScopeInfo(
          label: 'URBANO DISTRITAL',
          icon: Icons.directions_bus_outlined,
          fg: AppColors.info,
          bg: AppColors.infoBg,
          border: AppColors.infoBorder,
        ),
      'urbano_provincial' => const _ScopeInfo(
          label: 'URBANO PROVINCIAL',
          icon: Icons.directions_bus_outlined,
          fg: AppColors.info,
          bg: AppColors.infoBg,
          border: AppColors.infoBorder,
        ),
      'interprovincial_regional' => const _ScopeInfo(
          label: 'INTERPROVINCIAL',
          icon: Icons.airport_shuttle_outlined,
          fg: AppColors.riesgo,
          bg: AppColors.riesgoBg,
          border: AppColors.riesgoBorder,
        ),
      'interregional_nacional' => const _ScopeInfo(
          label: 'INTERREGIONAL',
          icon: Icons.airport_shuttle_outlined,
          fg: AppColors.primary,
          bg: AppColors.primaryBg,
          border: AppColors.primaryBorder,
        ),
      _ => const _ScopeInfo(
          label: 'RUTA',
          icon: Icons.route_outlined,
          fg: AppColors.ink6,
          bg: AppColors.ink1,
          border: AppColors.ink2,
        ),
    };

// ── Helpers compartidos con detail/validate ──────────────────────────────

/// Convierte la lista de puntos `[{lat, lng}, ...]` del backend a `LatLng`.
List<LatLng> pointsToLatLng(List<Map<String, dynamic>> points) {
  return points
      .map<LatLng?>((m) {
        final lat = (m['lat'] as num?)?.toDouble();
        final lng = (m['lng'] as num?)?.toDouble();
        if (lat == null || lng == null) return null;
        if (lat.isNaN || lng.isNaN || lat.isInfinite || lng.isInfinite) {
          return null;
        }
        return LatLng(lat, lng);
      })
      .whereType<LatLng>()
      .toList();
}

String formatDistance(int meters) {
  if (meters >= 1000) {
    final km = meters / 1000.0;
    return '${km.toStringAsFixed(km >= 10 ? 0 : 1)} km';
  }
  return '$meters m';
}

String formatDuration(int seconds) {
  if (seconds < 60) return '${seconds}s';
  final m = seconds ~/ 60;
  if (m < 60) return '$m min';
  final h = m ~/ 60;
  final rem = m % 60;
  return rem == 0 ? '${h}h' : '${h}h ${rem}m';
}

String ago(DateTime? dt) {
  if (dt == null) return '';
  final diff = DateTime.now().difference(dt);
  if (diff.inSeconds < 60) return 'hace un momento';
  if (diff.inMinutes < 60) return 'hace ${diff.inMinutes} min';
  if (diff.inHours < 24) return 'hace ${diff.inHours} h';
  if (diff.inDays < 7) return 'hace ${diff.inDays} d';
  return '${dt.day}/${dt.month}/${dt.year}';
}
