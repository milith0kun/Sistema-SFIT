import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../../core/network/dio_client.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_theme.dart';

/// Listado de rutas asociadas a la empresa del operador — RF-09 mobile.
class OperatorRoutesPage extends ConsumerStatefulWidget {
  const OperatorRoutesPage({super.key});

  @override
  ConsumerState<OperatorRoutesPage> createState() =>
      _OperatorRoutesPageState();
}

class _OperatorRoutesPageState extends ConsumerState<OperatorRoutesPage> {
  bool _loading = true;
  List<_Route> _all = const [];

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) _load();
    });
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final dio = ref.read(dioClientProvider).dio;
      // Backend filtra por la empresa del operador a partir del JWT.
      // Si no soporta el query, igual debería retornar las rutas
      // accesibles para el rol — el manejo es defensivo.
      final resp = await dio.get(
        '/rutas',
        queryParameters: {'companyId': 'mine', 'limit': 100},
      );
      final body = resp.data as Map?;
      final data = (body?['data'] as Map?) ?? body ?? const {};
      final list = (data['items'] as List? ?? const [])
          .map((e) => _Route.fromJson(e as Map<String, dynamic>))
          .toList();
      if (mounted) {
        setState(() {
          _all = list;
          _loading = false;
        });
      }
    } catch (_) {
      if (mounted) {
        setState(() {
          _all = const [];
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
      ),
      body: RefreshIndicator(
        color: AppColors.primary,
        onRefresh: _load,
        child: _loading
            ? const Center(
                child: CircularProgressIndicator(color: AppColors.primary),
              )
            : _all.isEmpty
                ? ListView(children: [
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
                  ])
                : ListView.separated(
                    padding: const EdgeInsets.fromLTRB(12, 10, 12, 96),
                    itemCount: _all.length,
                    separatorBuilder: (_, __) => const SizedBox(height: 8),
                    itemBuilder: (_, i) {
                      final r = _all[i];
                      return _RouteCard(
                        route: r,
                        onTap: () => context
                            .push('/operador/rutas/${r.id}/editar')
                            .then((_) => _load()),
                      );
                    },
                  ),
      ),
      floatingActionButton: FloatingActionButton.extended(
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
          style: AppTheme.inter(fontSize: 13, fontWeight: FontWeight.w700),
        ),
      ),
    );
  }
}

class _RouteCard extends StatelessWidget {
  final _Route route;
  final VoidCallback onTap;
  const _RouteCard({required this.route, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final scopeInfo = _scopeInfo(route.serviceScope);
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
                  if (route.code.isNotEmpty) ...[
                    Container(
                      padding:
                          const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                      decoration: BoxDecoration(
                        color: AppColors.ink1,
                        borderRadius: BorderRadius.circular(4),
                      ),
                      child: Text(
                        route.code,
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
                      route.name,
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
                    _isUrbano(route.serviceScope)
                        ? '${route.waypointsCount} paraderos'
                        : '${route.frequenciesCount} horarios',
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

class _Route {
  final String id;
  final String code;
  final String name;
  final String serviceScope;
  final int waypointsCount;
  final int frequenciesCount;

  const _Route({
    required this.id,
    required this.code,
    required this.name,
    required this.serviceScope,
    this.waypointsCount = 0,
    this.frequenciesCount = 0,
  });

  factory _Route.fromJson(Map<String, dynamic> j) {
    final waypoints = j['waypoints'] as List? ?? const [];
    final freq = (j['departureTimes'] as List? ??
        j['frequencies'] as List? ??
        j['horariosSalida'] as List? ??
        const []);
    return _Route(
      id: (j['_id'] ?? j['id'] ?? '').toString(),
      code: (j['code'] ?? '').toString(),
      name: (j['name'] ?? '').toString(),
      serviceScope:
          (j['serviceScope'] ?? 'urbano_distrital').toString(),
      waypointsCount: waypoints.length,
      frequenciesCount: freq.length,
    );
  }
}
