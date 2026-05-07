import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:latlong2/latlong.dart';
import '../../../../core/network/dio_client.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_theme.dart';

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

  // Oficiales
  bool _loadingOfficial = true;
  List<_Route> _all = const [];

  // Candidatas
  bool _loadingCandidates = true;
  List<_Candidate> _candidates = const [];

  @override
  void initState() {
    super.initState();
    _tabs = TabController(length: 2, vsync: this);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) {
        _load();
        _loadCandidates();
      }
    });
  }

  @override
  void dispose() {
    _tabs.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() => _loadingOfficial = true);
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
          _loadingOfficial = false;
        });
      }
    } catch (_) {
      if (mounted) {
        setState(() {
          _all = const [];
          _loadingOfficial = false;
        });
      }
    }
  }

  Future<void> _loadCandidates() async {
    setState(() => _loadingCandidates = true);
    try {
      final dio = ref.read(dioClientProvider).dio;
      final resp = await dio.get(
        '/rutas/candidatas',
        queryParameters: {'status': 'candidate'},
      );
      final body = resp.data as Map?;
      final data = (body?['data'] as Map?) ?? body ?? const {};
      final list = (data['items'] as List? ?? const [])
          .map((e) => _Candidate.fromJson(e as Map<String, dynamic>))
          .toList();
      if (mounted) {
        setState(() {
          _candidates = list;
          _loadingCandidates = false;
        });
      }
    } catch (_) {
      if (mounted) {
        setState(() {
          _candidates = const [];
          _loadingCandidates = false;
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
                  if (_candidates.isNotEmpty) ...[
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
                        '${_candidates.length}',
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
            loading: _loadingOfficial,
            routes: _all,
            onRefresh: _load,
          ),
          _CandidatesTab(
            loading: _loadingCandidates,
            items: _candidates,
            onRefresh: _loadCandidates,
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

class _OfficialTab extends StatelessWidget {
  final bool loading;
  final List<_Route> routes;
  final Future<void> Function() onRefresh;

  const _OfficialTab({
    required this.loading,
    required this.routes,
    required this.onRefresh,
  });

  @override
  Widget build(BuildContext context) {
    return RefreshIndicator(
      color: AppColors.primary,
      onRefresh: onRefresh,
      child: loading
          ? const Center(
              child: CircularProgressIndicator(color: AppColors.primary),
            )
          : routes.isEmpty
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
                ),
    );
  }
}

// ── Tab: Candidatas ───────────────────────────────────────────────────────

class _CandidatesTab extends StatelessWidget {
  final bool loading;
  final List<_Candidate> items;
  final Future<void> Function() onRefresh;

  const _CandidatesTab({
    required this.loading,
    required this.items,
    required this.onRefresh,
  });

  @override
  Widget build(BuildContext context) {
    return RefreshIndicator(
      color: AppColors.primary,
      onRefresh: onRefresh,
      child: loading
          ? const Center(
              child: CircularProgressIndicator(color: AppColors.primary),
            )
          : items.isEmpty
              ? ListView(children: [
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
                ])
              : ListView.separated(
                  padding: const EdgeInsets.fromLTRB(12, 10, 12, 96),
                  itemCount: items.length,
                  separatorBuilder: (_, __) => const SizedBox(height: 10),
                  itemBuilder: (_, i) {
                    final c = items[i];
                    return _CandidateCard(
                      candidate: c,
                      onTap: () => context
                          .push('/operador/rutas/candidatas/${c.id}',
                              extra: c)
                          .then((_) => onRefresh()),
                    );
                  },
                ),
    );
  }
}

class _CandidateCard extends StatelessWidget {
  final _Candidate candidate;
  final VoidCallback onTap;
  const _CandidateCard({required this.candidate, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final score = candidate.qualityScore;
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

    return Material(
      color: Colors.white,
      borderRadius: BorderRadius.circular(14),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(14),
        child: Container(
          decoration: BoxDecoration(
            border: Border.all(color: AppColors.ink2),
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
                  child: _MiniMap(samplePolyline: candidate.samplePolyline),
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
                        Icons.person_outline,
                        size: 15,
                        color: AppColors.ink6,
                      ),
                      const SizedBox(width: 4),
                      Expanded(
                        child: Text(
                          candidate.driverName.isEmpty
                              ? 'Conductor —'
                              : candidate.driverName,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: AppTheme.inter(
                            fontSize: 13,
                            fontWeight: FontWeight.w700,
                            color: AppColors.ink9,
                          ),
                        ),
                      ),
                      if (candidate.vehiclePlate.isNotEmpty) ...[
                        const SizedBox(width: 6),
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 6,
                            vertical: 2,
                          ),
                          decoration: BoxDecoration(
                            color: AppColors.ink9,
                            borderRadius: BorderRadius.circular(4),
                          ),
                          child: Text(
                            candidate.vehiclePlate,
                            style: AppTheme.inter(
                              fontSize: 10,
                              fontWeight: FontWeight.w800,
                              color: Colors.white,
                              tabular: true,
                              letterSpacing: 0.4,
                            ),
                          ),
                        ),
                      ],
                    ]),
                    const SizedBox(height: 10),
                    Row(children: [
                      _Pill(
                        icon: Icons.straighten_outlined,
                        label: _formatDistance(candidate.distanceMeters),
                      ),
                      const SizedBox(width: 6),
                      _Pill(
                        icon: Icons.schedule_outlined,
                        label: _formatDuration(candidate.durationSeconds),
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
                        _ago(candidate.createdAt),
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
          TileLayer(
            urlTemplate:
                'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png',
            subdomains: const ['a', 'b', 'c', 'd'],
            userAgentPackageName: 'com.sfit.sfit_app',
          ),
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

// ── Modelo: Candidata ─────────────────────────────────────────────────────

class Candidate {
  final String id;
  final String fleetEntryId;
  final String driverId;
  final String driverName;
  final String vehiclePlate;
  final int distanceMeters;
  final int durationSeconds;
  final int pointCount;
  final int qualityScore;
  final List<LatLng> samplePolyline;
  final DateTime? createdAt;
  final String status;

  const Candidate({
    required this.id,
    required this.fleetEntryId,
    required this.driverId,
    required this.driverName,
    required this.vehiclePlate,
    required this.distanceMeters,
    required this.durationSeconds,
    required this.pointCount,
    required this.qualityScore,
    required this.samplePolyline,
    required this.createdAt,
    required this.status,
  });

  factory Candidate.fromJson(Map<String, dynamic> j) {
    final poly = (j['samplePolyline'] as List? ?? const [])
        .where((e) => e is List && e.length >= 2)
        .map<LatLng?>((e) {
          final lat = (e[0] as num?)?.toDouble();
          final lng = (e[1] as num?)?.toDouble();
          if (lat == null || lng == null) return null;
          if (lat.isNaN || lng.isNaN || lat.isInfinite || lng.isInfinite) {
            return null;
          }
          return LatLng(lat, lng);
        })
        .whereType<LatLng>()
        .toList();
    return Candidate(
      id: (j['id'] ?? j['_id'] ?? '').toString(),
      fleetEntryId: (j['fleetEntryId'] ?? '').toString(),
      driverId: (j['driverId'] ?? '').toString(),
      driverName: (j['driverName'] ?? '').toString(),
      vehiclePlate: (j['vehiclePlate'] ?? '').toString(),
      distanceMeters: (j['distanceMeters'] as num?)?.toInt() ?? 0,
      durationSeconds: (j['durationSeconds'] as num?)?.toInt() ?? 0,
      pointCount: (j['pointCount'] as num?)?.toInt() ?? 0,
      qualityScore: (j['qualityScore'] as num?)?.toInt() ?? 0,
      samplePolyline: poly,
      createdAt: j['createdAt'] is String
          ? DateTime.tryParse(j['createdAt'] as String)
          : null,
      status: (j['status'] ?? 'candidate').toString(),
    );
  }
}

// Alias privado para uso interno (sin romper la API pública).
typedef _Candidate = Candidate;

// ── Helpers de formato ────────────────────────────────────────────────────

String _formatDistance(int meters) {
  if (meters >= 1000) {
    final km = meters / 1000.0;
    return '${km.toStringAsFixed(km >= 10 ? 0 : 1)} km';
  }
  return '$meters m';
}

String _formatDuration(int seconds) {
  if (seconds < 60) return '${seconds}s';
  final m = seconds ~/ 60;
  if (m < 60) return '$m min';
  final h = m ~/ 60;
  final rem = m % 60;
  return rem == 0 ? '${h}h' : '${h}h ${rem}m';
}

String _ago(DateTime? dt) {
  if (dt == null) return '';
  final diff = DateTime.now().difference(dt);
  if (diff.inSeconds < 60) return 'hace un momento';
  if (diff.inMinutes < 60) return 'hace ${diff.inMinutes} min';
  if (diff.inHours < 24) return 'hace ${diff.inHours} h';
  if (diff.inDays < 7) return 'hace ${diff.inDays} d';
  return '${dt.day}/${dt.month}/${dt.year}';
}
