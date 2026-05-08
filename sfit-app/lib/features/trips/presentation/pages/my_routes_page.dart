import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:latlong2/latlong.dart';
import '../../../../core/network/dio_client.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_theme.dart';

/// Pantalla "Mis rutas" del Conductor — RF-conductor.
///
/// Diseño:
///   1. EN CURSO: si hay un turno `en_ruta`, card grande con preview del
///      trazo en vivo y CTA "Ver mapa".
///   2. MIS RUTAS: agrupadas por ruta. Cada grupo es expandible y al
///      abrirlo lista las pasadas (fecha, duración, compliance) con badge
///      "MEJOR" en la pasada con mejor score (calculado server-side).
///
/// Datos: GET /conductor/mis-recorridos (devuelve `routes[]` + `activeEntry`).
class MyRoutesPage extends ConsumerStatefulWidget {
  const MyRoutesPage({super.key});

  @override
  ConsumerState<MyRoutesPage> createState() => _MyRoutesPageState();
}

class _MyRoutesPageState extends ConsumerState<MyRoutesPage> {
  Future<void> _refresh() async {
    ref.invalidate(misRecorridosProvider);
    await ref.read(misRecorridosProvider.future);
  }

  /// Abre el wizard de inicio de turno y refresca al volver. Si el conductor
  /// completa el wizard, `TripCheckinPage` navega a `/home?tab=mapa` con
  /// `context.go`, así que este `await` retorna sin cambios visibles. Cuando
  /// el usuario regrese al tab "Mis rutas" el provider ya estará invalidado.
  Future<void> _startNewShift() async {
    await context.push('/viaje-checkin');
    if (mounted) ref.invalidate(misRecorridosProvider);
  }

  Future<void> _closeActiveShift(PassData entry) async {
    await context.push(
      '/viaje-checkout/${entry.id}',
      extra: {
        'vehiclePlate': entry.vehiclePlate,
        'departureTime': entry.departureTime ?? '',
        'estimatedKm': null,
      },
    );
    if (mounted) ref.invalidate(misRecorridosProvider);
  }

  @override
  Widget build(BuildContext context) {
    final async = ref.watch(misRecorridosProvider);

    return SafeArea(
      child: Column(
        children: [
          // ── Subtítulo (el AppBar ya muestra "Mis rutas") ────────
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
            child: Align(
              alignment: Alignment.centerLeft,
              child: Text(
                'Inicia un turno o revisa tus pasadas anteriores.',
                style: AppTheme.inter(
                  fontSize: 12.5,
                  color: AppColors.ink5,
                  fontWeight: FontWeight.w500,
                ),
              ),
            ),
          ),

          // ── Cuerpo ──────────────────────────────────────────────
          Expanded(
            child: async.when(
              loading: () => const _RoutesLoadingSkeleton(),
              error: (_, __) => _ErrorState(onRetry: _refresh),
              data: (data) {
                final hasActive = data.activeEntry != null;
                final hasRoutes = data.routes.isNotEmpty;
                if (!hasActive && !hasRoutes) {
                  return RefreshIndicator(
                    onRefresh: _refresh,
                    color: AppColors.gold,
                    child: ListView(children: [
                      const SizedBox(height: 40),
                      _EmptyState(onStart: _startNewShift),
                    ]),
                  );
                }
                final featured = _findFeaturedPass(data);
                return RefreshIndicator(
                  onRefresh: _refresh,
                  color: AppColors.gold,
                  child: ListView(
                    padding: const EdgeInsets.fromLTRB(16, 4, 16, 90),
                    children: [
                      if (hasActive) ...[
                        const _SectionHeader(label: 'EN CURSO'),
                        const SizedBox(height: 6),
                        _ActiveEntryCard(
                          entry: data.activeEntry!,
                          onClose: () => _closeActiveShift(data.activeEntry!),
                          onSeeMap: () {
                            context.push('/buses-en-vivo/${data.activeEntry!.id}');
                          },
                        ),
                        const SizedBox(height: 18),
                      ] else ...[
                        _StartShiftCard(onTap: _startNewShift),
                        const SizedBox(height: 18),
                      ],
                      // ── PASADA DESTACADA — la mejor pasada con trazo válido,
                      // mostrada de forma prominente con mini-mapa para que el
                      // conductor vea de un vistazo cuál es su mejor recorrido
                      // sin tener que abrir el grupo. ──────────────────────
                      if (featured != null) ...[
                        const _SectionHeader(label: 'PASADA DESTACADA'),
                        const SizedBox(height: 6),
                        _FeaturedPassCard(
                          pass: featured,
                          onTap: () => context.push(
                              '/conductor/trip-summary/${featured.id}'),
                        ),
                        const SizedBox(height: 18),
                      ],
                      if (hasRoutes) ...[
                        _SectionHeader(
                          label: 'MIS RUTAS',
                          trailing: '${data.routes.length}',
                        ),
                        const SizedBox(height: 6),
                        for (final route in data.routes)
                          Padding(
                            padding: const EdgeInsets.only(bottom: 10),
                            child: _RouteGroupTile(
                              group: route,
                              // Auto-expandir si solo hay un grupo: típicamente
                              // un conductor que aún no tiene ruta asignada y
                              // todas sus pasadas viven bajo "Sin ruta".
                              initiallyExpanded: data.routes.length == 1,
                            ),
                          ),
                      ],
                    ],
                  ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}

/// Card de invitación a iniciar un nuevo turno cuando no hay `activeEntry`.
/// Se muestra arriba del listado de pasadas históricas para que el conductor
/// siempre tenga el CTA principal a la vista.
class _StartShiftCard extends StatelessWidget {
  final VoidCallback onTap;
  const _StartShiftCard({required this.onTap});

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(14),
        child: Container(
          padding: const EdgeInsets.fromLTRB(16, 16, 14, 16),
          decoration: BoxDecoration(
            color: AppColors.goldBg,
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: AppColors.goldBorder, width: 1.2),
          ),
          child: Row(
            children: [
              Container(
                width: 44,
                height: 44,
                decoration: const BoxDecoration(
                  color: AppColors.gold,
                  shape: BoxShape.circle,
                ),
                child: const Icon(Icons.play_arrow_rounded,
                    color: Colors.white, size: 26),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Iniciar nuevo turno',
                      style: AppTheme.inter(
                        fontSize: 15,
                        fontWeight: FontWeight.w800,
                        color: AppColors.ink9,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      'Selecciona vehículo y ruta. Empezamos a registrar tu trazo.',
                      style: AppTheme.inter(
                        fontSize: 12,
                        color: AppColors.ink6,
                        height: 1.35,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 4),
              const Icon(Icons.arrow_forward_rounded,
                  size: 20, color: AppColors.goldDark),
            ],
          ),
        ),
      ),
    );
  }
}

// ── Provider ────────────────────────────────────────────────────────────────

/// Carga el endpoint `/conductor/mis-recorridos` parseado a `MisRecorridosData`.
/// Invalidable con `ref.invalidate(misRecorridosProvider)`.
final misRecorridosProvider =
    FutureProvider.autoDispose<MisRecorridosData>((ref) async {
  final dio = ref.watch(dioClientProvider).dio;
  final resp = await dio.get('/conductor/mis-recorridos',
      queryParameters: {'limit': 80, 'perRoute': 10});
  final body = resp.data as Map<String, dynamic>;
  final data = body['data'] as Map<String, dynamic>? ?? body;
  return MisRecorridosData.fromJson(data);
});

// ── Modelos ────────────────────────────────────────────────────────────────

class MisRecorridosData {
  final List<RouteGroup> routes;
  final PassData? activeEntry;
  final int total;

  const MisRecorridosData({
    required this.routes,
    required this.activeEntry,
    required this.total,
  });

  factory MisRecorridosData.fromJson(Map<String, dynamic> j) {
    final routes = (j['routes'] as List? ?? const [])
        .map((r) => RouteGroup.fromJson(r as Map<String, dynamic>))
        .toList();
    final active = j['activeEntry'] != null
        ? PassData.fromJson(j['activeEntry'] as Map<String, dynamic>)
        : null;
    return MisRecorridosData(
      routes: routes,
      activeEntry: active,
      total: (j['total'] as num?)?.toInt() ?? 0,
    );
  }
}

class RouteGroup {
  final String? routeId;
  final String? code;
  final String? name;
  final List<Map<String, dynamic>>? waypoints;
  final List<PassData> passes;
  final String? bestPassId;
  final int totalPasses;

  const RouteGroup({
    required this.routeId,
    required this.code,
    required this.name,
    required this.waypoints,
    required this.passes,
    required this.bestPassId,
    required this.totalPasses,
  });

  factory RouteGroup.fromJson(Map<String, dynamic> j) {
    final wps = j['waypoints'] as List?;
    return RouteGroup(
      routeId: j['routeId'] as String?,
      code: j['code'] as String?,
      name: j['name'] as String?,
      waypoints: wps?.map((w) => Map<String, dynamic>.from(w as Map)).toList(),
      passes: (j['passes'] as List? ?? const [])
          .map((p) => PassData.fromJson(p as Map<String, dynamic>))
          .toList(),
      bestPassId: j['bestPassId'] as String?,
      totalPasses: (j['totalPasses'] as num?)?.toInt() ?? 0,
    );
  }
}

class PassData {
  final String id;
  final DateTime? date;
  final String status;
  final String? departureTime;
  final String? returnTime;
  final String vehiclePlate;
  final String? routeName;
  final String? routeCode;
  final double km;
  final num? distanceMeters;
  final int? durationSeconds;
  final int? routeCompliancePercentage;
  final int visitedStopsCount;
  final int trackPointsTotal;
  final double? score;
  final bool isBest;
  final List<LatLng>? track;
  /// Estado de la `RouteCapture` asociada al turno cerrado:
  ///   - `"raw"`: el turno tenía routeId; la captura alimenta convergencia.
  ///   - `"candidate"`: turno sin ruta; el operador puede validarla.
  ///   - `"validated"`: la candidata fue promovida a Route oficial.
  ///   - `"merged"` / `"rejected"`: estados terminales menos relevantes.
  ///   - `null`: el turno aún no generó captura (en_ruta o <20 pings).
  final String? captureStatus;
  final int? captureQualityScore;

  const PassData({
    required this.id,
    required this.date,
    required this.status,
    required this.departureTime,
    required this.returnTime,
    required this.vehiclePlate,
    required this.routeName,
    required this.routeCode,
    required this.km,
    required this.distanceMeters,
    required this.durationSeconds,
    required this.routeCompliancePercentage,
    required this.visitedStopsCount,
    required this.trackPointsTotal,
    required this.score,
    required this.isBest,
    required this.track,
    this.captureStatus,
    this.captureQualityScore,
  });

  factory PassData.fromJson(Map<String, dynamic> j) {
    final rawDate = j['date'];
    DateTime? parsed;
    if (rawDate is String) {
      try { parsed = DateTime.parse(rawDate); } catch (_) {}
    }
    final track = (j['track'] as List?)
        ?.map((p) => LatLng(
              ((p as Map)['lat'] as num).toDouble(),
              (p['lng'] as num).toDouble(),
            ))
        .toList();
    return PassData(
      id: j['id'] as String,
      date: parsed,
      status: j['status'] as String? ?? '—',
      departureTime: j['departureTime'] as String?,
      returnTime: j['returnTime'] as String?,
      vehiclePlate: j['vehiclePlate'] as String? ?? '—',
      routeName: j['routeName'] as String?,
      routeCode: j['routeCode'] as String?,
      km: ((j['km'] as num?) ?? 0).toDouble(),
      distanceMeters: j['distanceMeters'] as num?,
      durationSeconds: (j['durationSeconds'] as num?)?.toInt(),
      routeCompliancePercentage:
          (j['routeCompliancePercentage'] as num?)?.toInt(),
      visitedStopsCount: (j['visitedStopsCount'] as num?)?.toInt() ?? 0,
      trackPointsTotal: (j['trackPointsTotal'] as num?)?.toInt() ?? 0,
      score: (j['score'] as num?)?.toDouble(),
      isBest: j['isBest'] as bool? ?? false,
      track: track,
      captureStatus: j['captureStatus'] as String?,
      captureQualityScore: (j['captureQualityScore'] as num?)?.toInt(),
    );
  }
}

// ── Section header ──────────────────────────────────────────────────────────

class _SectionHeader extends StatelessWidget {
  final String label;
  final String? trailing;
  const _SectionHeader({required this.label, this.trailing});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        children: [
          Text(
            label,
            style: AppTheme.inter(
              fontSize: 11, fontWeight: FontWeight.w800,
              color: AppColors.ink5, letterSpacing: 1.2),
          ),
          if (trailing != null) ...[
            const SizedBox(width: 6),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
              decoration: BoxDecoration(
                color: AppColors.ink1,
                borderRadius: BorderRadius.circular(99),
              ),
              child: Text(trailing!,
                  style: AppTheme.inter(
                      fontSize: 10.5, fontWeight: FontWeight.w800,
                      color: AppColors.ink7, tabular: true)),
            ),
          ],
        ],
      ),
    );
  }
}

// ── Card del turno EN CURSO ────────────────────────────────────────────────

class _ActiveEntryCard extends StatelessWidget {
  final PassData entry;
  final VoidCallback onClose;
  final VoidCallback onSeeMap;

  const _ActiveEntryCard({
    required this.entry,
    required this.onClose,
    required this.onSeeMap,
  });

  String _fmtTime(String? raw) {
    if (raw == null) return '—';
    if (RegExp(r'^\d{2}:\d{2}').hasMatch(raw)) return raw.substring(0, 5);
    try {
      final dt = DateTime.parse(raw).toLocal();
      return '${dt.hour.toString().padLeft(2, '0')}:${dt.minute.toString().padLeft(2, '0')}';
    } catch (_) { return raw; }
  }

  @override
  Widget build(BuildContext context) {
    final track = entry.track ?? const <LatLng>[];
    return Container(
      decoration: BoxDecoration(
        color: AppColors.panel,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.goldBorder, width: 1.5),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // ── Mini-mapa del trazo en vivo ───────────────────────
          if (track.length >= 2)
            ClipRRect(
              borderRadius:
                  const BorderRadius.vertical(top: Radius.circular(13)),
              child: AspectRatio(
                aspectRatio: 16 / 7.5,
                child: Stack(children: [
                  FlutterMap(
                    options: MapOptions(
                      initialCameraFit: CameraFit.bounds(
                        bounds: LatLngBounds.fromPoints(track),
                        padding: const EdgeInsets.all(20),
                      ),
                      interactionOptions: const InteractionOptions(
                          flags: InteractiveFlag.none),
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
                          points: track,
                          color: AppColors.gold.withValues(alpha: 0.9),
                          strokeWidth: 4,
                        ),
                      ]),
                      MarkerLayer(markers: [
                        Marker(
                          point: track.first,
                          width: 14, height: 14,
                          child: Container(
                            decoration: BoxDecoration(
                              color: AppColors.apto,
                              shape: BoxShape.circle,
                              border: Border.all(color: Colors.white, width: 2),
                            ),
                          ),
                        ),
                        Marker(
                          point: track.last,
                          width: 16, height: 16,
                          child: Container(
                            decoration: BoxDecoration(
                              color: AppColors.gold,
                              shape: BoxShape.circle,
                              border: Border.all(color: Colors.white, width: 2.5),
                            ),
                          ),
                        ),
                      ]),
                    ],
                  ),
                  Positioned(
                    top: 8, left: 8,
                    child: Container(
                      padding:
                          const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                      decoration: BoxDecoration(
                        color: Colors.black.withValues(alpha: 0.6),
                        borderRadius: BorderRadius.circular(99),
                      ),
                      child: Row(mainAxisSize: MainAxisSize.min, children: [
                        Container(
                          width: 6, height: 6,
                          decoration: const BoxDecoration(
                              color: AppColors.apto, shape: BoxShape.circle),
                        ),
                        const SizedBox(width: 5),
                        Text('EN VIVO',
                            style: AppTheme.inter(
                                fontSize: 9.5,
                                fontWeight: FontWeight.w800,
                                color: Colors.white,
                                letterSpacing: 1)),
                      ]),
                    ),
                  ),
                ]),
              ),
            ),

          // ── Info + acciones ───────────────────────────────────
          Padding(
            padding: const EdgeInsets.fromLTRB(14, 12, 14, 14),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(children: [
                  const Icon(Icons.directions_bus_rounded,
                      size: 18, color: Colors.white),
                  const SizedBox(width: 6),
                  Text(entry.vehiclePlate,
                      style: AppTheme.inter(
                          fontSize: 17,
                          fontWeight: FontWeight.w800,
                          color: Colors.white,
                          tabular: true)),
                  const Spacer(),
                  if (entry.departureTime != null)
                    Text('Salida ${_fmtTime(entry.departureTime)}',
                        style: AppTheme.inter(
                            fontSize: 11, color: Colors.white70, tabular: true)),
                ]),
                if (entry.routeCode != null || entry.routeName != null) ...[
                  const SizedBox(height: 6),
                  Row(children: [
                    if (entry.routeCode != null) ...[
                      Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 6, vertical: 2),
                        decoration: BoxDecoration(
                          color: Colors.white.withValues(alpha: 0.12),
                          borderRadius: BorderRadius.circular(4),
                        ),
                        child: Text(entry.routeCode!,
                            style: AppTheme.inter(
                                fontSize: 10,
                                fontWeight: FontWeight.w800,
                                color: Colors.white,
                                letterSpacing: 0.5)),
                      ),
                      const SizedBox(width: 6),
                    ],
                    if (entry.routeName != null)
                      Expanded(
                        child: Text(entry.routeName!,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: AppTheme.inter(
                                fontSize: 12, color: Colors.white70)),
                      ),
                  ]),
                ],
                const SizedBox(height: 12),
                Row(children: [
                  Expanded(
                    child: FilledButton.tonalIcon(
                      onPressed: onSeeMap,
                      icon: const Icon(Icons.map_outlined, size: 18),
                      label: const Text('Ver mapa'),
                      style: FilledButton.styleFrom(
                        backgroundColor: Colors.white.withValues(alpha: 0.12),
                        foregroundColor: Colors.white,
                        minimumSize: const Size(0, 42),
                        shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(8)),
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: FilledButton.icon(
                      onPressed: onClose,
                      icon:
                          const Icon(Icons.stop_circle_outlined, size: 18),
                      label: const Text('Cerrar turno'),
                      style: FilledButton.styleFrom(
                        backgroundColor: AppColors.noApto,
                        foregroundColor: Colors.white,
                        minimumSize: const Size(0, 42),
                        shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(8)),
                      ),
                    ),
                  ),
                ]),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

// ── Tile de grupo de ruta (expandible) ─────────────────────────────────────

class _RouteGroupTile extends StatefulWidget {
  final RouteGroup group;
  /// Si true, arranca expandido. El padre lo usa cuando solo hay un grupo
  /// para que las pasadas se vean sin que el conductor tenga que tocar.
  final bool initiallyExpanded;
  const _RouteGroupTile({required this.group, this.initiallyExpanded = false});

  @override
  State<_RouteGroupTile> createState() => _RouteGroupTileState();
}

class _RouteGroupTileState extends State<_RouteGroupTile> {
  late bool _expanded = widget.initiallyExpanded;

  @override
  Widget build(BuildContext context) {
    final g = widget.group;
    final code = g.code ?? '—';
    final hasNoRoute = g.routeId == null;
    final name = g.name ?? (hasNoRoute ? 'Recorridos sin ruta asignada' : 'Sin nombre');

    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.ink2),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // ── Cabecera clickable ──────────────────────────────
          InkWell(
            onTap: () => setState(() => _expanded = !_expanded),
            borderRadius: BorderRadius.circular(12),
            child: Padding(
              padding: const EdgeInsets.fromLTRB(14, 12, 12, 12),
              child: Row(
                children: [
                  // Bandita lateral
                  Container(
                    width: 4, height: 38,
                    decoration: BoxDecoration(
                      color: hasNoRoute ? AppColors.ink3 : AppColors.gold,
                      borderRadius: BorderRadius.circular(4),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(children: [
                          if (!hasNoRoute) ...[
                            Container(
                              padding: const EdgeInsets.symmetric(
                                  horizontal: 7, vertical: 2),
                              decoration: BoxDecoration(
                                color: AppColors.ink9,
                                borderRadius: BorderRadius.circular(4),
                              ),
                              child: Text(code,
                                  style: AppTheme.inter(
                                      fontSize: 10.5,
                                      fontWeight: FontWeight.w800,
                                      color: Colors.white,
                                      letterSpacing: 0.4)),
                            ),
                            const SizedBox(width: 8),
                          ],
                          Expanded(
                            child: Text(name,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: AppTheme.inter(
                                    fontSize: 14,
                                    fontWeight: FontWeight.w700,
                                    color: AppColors.ink9)),
                          ),
                        ]),
                        const SizedBox(height: 4),
                        Row(children: [
                          Icon(
                            hasNoRoute ? Icons.help_outline : Icons.repeat,
                            size: 12, color: AppColors.ink5),
                          const SizedBox(width: 4),
                          Text(
                            g.totalPasses == 1
                                ? '1 pasada'
                                : '${g.totalPasses} pasadas',
                            style: AppTheme.inter(
                                fontSize: 12,
                                color: AppColors.ink5,
                                tabular: true),
                          ),
                          if (g.bestPassId != null) ...[
                            const SizedBox(width: 8),
                            const Icon(Icons.workspace_premium,
                                size: 13, color: AppColors.gold),
                            const SizedBox(width: 2),
                            Text('mejor destacada',
                                style: AppTheme.inter(
                                    fontSize: 11.5,
                                    fontWeight: FontWeight.w600,
                                    color: AppColors.gold)),
                          ],
                        ]),
                      ],
                    ),
                  ),
                  const SizedBox(width: 6),
                  AnimatedRotation(
                    turns: _expanded ? 0.5 : 0,
                    duration: const Duration(milliseconds: 180),
                    child: const Icon(Icons.expand_more,
                        size: 22, color: AppColors.ink5),
                  ),
                ],
              ),
            ),
          ),

          // ── Lista de pasadas ────────────────────────────────
          AnimatedCrossFade(
            firstChild: const SizedBox.shrink(),
            secondChild: Column(
              children: [
                Container(height: 1, color: AppColors.ink1),
                for (int i = 0; i < g.passes.length; i++) ...[
                  _PassRow(
                    pass: g.passes[i],
                    onTap: () {
                      context.push(
                          '/conductor/trip-summary/${g.passes[i].id}');
                    },
                  ),
                  if (i < g.passes.length - 1)
                    Container(
                      height: 1,
                      color: AppColors.ink1,
                      margin: const EdgeInsets.symmetric(horizontal: 12),
                    ),
                ],
                if (g.totalPasses > g.passes.length)
                  Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 14, vertical: 10),
                    decoration: const BoxDecoration(
                      color: AppColors.ink1,
                      borderRadius: BorderRadius.vertical(
                          bottom: Radius.circular(11)),
                    ),
                    child: Row(
                      children: [
                        const Icon(Icons.history,
                            size: 14, color: AppColors.ink5),
                        const SizedBox(width: 6),
                        Text(
                          '+${g.totalPasses - g.passes.length} pasadas más antiguas',
                          style: AppTheme.inter(
                              fontSize: 11.5, color: AppColors.ink6),
                        ),
                      ],
                    ),
                  ),
              ],
            ),
            crossFadeState: _expanded
                ? CrossFadeState.showSecond
                : CrossFadeState.showFirst,
            duration: const Duration(milliseconds: 220),
          ),
        ],
      ),
    );
  }
}

// ── Fila de una pasada ─────────────────────────────────────────────────────

class _PassRow extends StatelessWidget {
  final PassData pass;
  final VoidCallback onTap;
  const _PassRow({required this.pass, required this.onTap});

  String _fmtDate(DateTime? d) {
    if (d == null) return '—';
    return DateFormat('EEE d MMM', 'es').format(d.toLocal());
  }

  String _fmtDuration(int? secs) {
    if (secs == null || secs <= 0) return '—';
    final h = secs ~/ 3600;
    final m = (secs % 3600) ~/ 60;
    if (h > 0) return '${h}h ${m}m';
    return '${m}m';
  }

  String _fmtTime(String? raw) {
    if (raw == null) return '—';
    if (RegExp(r'^\d{2}:\d{2}').hasMatch(raw)) return raw.substring(0, 5);
    try {
      final dt = DateTime.parse(raw).toLocal();
      return '${dt.hour.toString().padLeft(2, '0')}:${dt.minute.toString().padLeft(2, '0')}';
    } catch (_) { return raw; }
  }

  Color _complianceColor(int? c) {
    if (c == null) return AppColors.ink5;
    if (c >= 80) return AppColors.apto;
    if (c >= 50) return AppColors.riesgo;
    return AppColors.noApto;
  }

  @override
  Widget build(BuildContext context) {
    final compliance = pass.routeCompliancePercentage;
    final cColor = _complianceColor(compliance);
    final dur = _fmtDuration(pass.durationSeconds);
    final isLive = pass.status == 'en_ruta';

    final track = pass.track;
    final hasMiniMap = track != null && track.length >= 2;

    return Material(
      color: pass.isBest
          ? AppColors.goldBg.withValues(alpha: 0.35)
          : Colors.transparent,
      child: InkWell(
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 11),
          child: Row(
            children: [
              // Mini-mapa con el trazo (si hay puntos suficientes).
              if (hasMiniMap) ...[
                ClipRRect(
                  borderRadius: BorderRadius.circular(8),
                  child: SizedBox(
                    width: 56,
                    height: 56,
                    child: IgnorePointer(
                      child: FlutterMap(
                        options: MapOptions(
                          initialCenter: track[track.length ~/ 2],
                          initialZoom: 12.5,
                          interactionOptions: const InteractionOptions(flags: InteractiveFlag.none),
                        ),
                        children: [
                          TileLayer(
                            urlTemplate: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}@2x.png',
                            subdomains: const ['a', 'b', 'c', 'd'],
                            userAgentPackageName: 'com.sfit.sfit_app',
                          ),
                          PolylineLayer(polylines: [
                            Polyline(
                              points: track,
                              color: pass.isBest ? AppColors.gold : AppColors.ink7,
                              strokeWidth: 2.5,
                            ),
                          ]),
                        ],
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: 10),
              ],
              // Columna izquierda: fecha + horario
              Expanded(
                flex: 5,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(children: [
                      Text(_fmtDate(pass.date),
                          style: AppTheme.inter(
                              fontSize: 13,
                              fontWeight: FontWeight.w700,
                              color: AppColors.ink9)),
                      if (pass.isBest) ...[
                        const SizedBox(width: 6),
                        Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 6, vertical: 2),
                          decoration: BoxDecoration(
                            color: AppColors.gold,
                            borderRadius: BorderRadius.circular(4),
                          ),
                          child: Row(mainAxisSize: MainAxisSize.min, children: [
                            const Icon(Icons.workspace_premium,
                                size: 10, color: Colors.white),
                            const SizedBox(width: 2),
                            Text('MEJOR',
                                style: AppTheme.inter(
                                    fontSize: 9.5,
                                    fontWeight: FontWeight.w800,
                                    color: Colors.white,
                                    letterSpacing: 0.6)),
                          ]),
                        ),
                      ],
                      if (isLive) ...[
                        const SizedBox(width: 6),
                        Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 6, vertical: 2),
                          decoration: BoxDecoration(
                            color: AppColors.apto,
                            borderRadius: BorderRadius.circular(4),
                          ),
                          child: Text('EN VIVO',
                              style: AppTheme.inter(
                                  fontSize: 9.5,
                                  fontWeight: FontWeight.w800,
                                  color: Colors.white,
                                  letterSpacing: 0.6)),
                        ),
                      ],
                      // Chip de estado de captura GPS:
                      //   - candidate → trazo orgánico en revisión por operador
                      //   - validated → fue promovida a Route oficial
                      if (pass.captureStatus == 'candidate') ...[
                        const SizedBox(width: 6),
                        Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 6, vertical: 2),
                          decoration: BoxDecoration(
                            color: AppColors.goldBg,
                            border: Border.all(color: AppColors.goldBorder),
                            borderRadius: BorderRadius.circular(4),
                          ),
                          child: Row(mainAxisSize: MainAxisSize.min, children: [
                            const Icon(Icons.add_road_outlined,
                                size: 10, color: AppColors.goldDark),
                            const SizedBox(width: 2),
                            Text('CANDIDATA',
                                style: AppTheme.inter(
                                    fontSize: 9.5,
                                    fontWeight: FontWeight.w800,
                                    color: AppColors.goldDark,
                                    letterSpacing: 0.6)),
                          ]),
                        ),
                      ] else if (pass.captureStatus == 'validated') ...[
                        const SizedBox(width: 6),
                        Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 6, vertical: 2),
                          decoration: BoxDecoration(
                            color: AppColors.aptoBg,
                            border: Border.all(color: AppColors.aptoBorder),
                            borderRadius: BorderRadius.circular(4),
                          ),
                          child: Row(mainAxisSize: MainAxisSize.min, children: [
                            const Icon(Icons.verified_rounded,
                                size: 10, color: AppColors.apto),
                            const SizedBox(width: 2),
                            Text('PROMOVIDA',
                                style: AppTheme.inter(
                                    fontSize: 9.5,
                                    fontWeight: FontWeight.w800,
                                    color: AppColors.apto,
                                    letterSpacing: 0.6)),
                          ]),
                        ),
                      ],
                    ]),
                    const SizedBox(height: 3),
                    Row(children: [
                      const Icon(Icons.access_time,
                          size: 11, color: AppColors.ink5),
                      const SizedBox(width: 3),
                      Text(
                        '${_fmtTime(pass.departureTime)}'
                        '${pass.returnTime != null ? " → ${_fmtTime(pass.returnTime)}" : ""}',
                        style: AppTheme.inter(
                            fontSize: 11.5,
                            color: AppColors.ink6,
                            tabular: true),
                      ),
                      const SizedBox(width: 8),
                      const Icon(Icons.timelapse,
                          size: 11, color: AppColors.ink5),
                      const SizedBox(width: 3),
                      Text(dur,
                          style: AppTheme.inter(
                              fontSize: 11.5,
                              color: AppColors.ink6,
                              tabular: true)),
                    ]),
                  ],
                ),
              ),

              // Columna derecha: compliance / status
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                mainAxisSize: MainAxisSize.min,
                children: [
                  if (compliance != null)
                    Text('$compliance%',
                        style: AppTheme.inter(
                            fontSize: 15,
                            fontWeight: FontWeight.w800,
                            color: cColor,
                            tabular: true))
                  else
                    Text('—',
                        style: AppTheme.inter(
                            fontSize: 15,
                            fontWeight: FontWeight.w700,
                            color: AppColors.ink4)),
                  Text(
                    compliance != null ? 'paraderos' : pass.status,
                    style: AppTheme.inter(
                        fontSize: 9.5,
                        fontWeight: FontWeight.w600,
                        color: AppColors.ink5,
                        letterSpacing: 0.4),
                  ),
                ],
              ),
              const SizedBox(width: 4),
              const Icon(Icons.chevron_right,
                  size: 18, color: AppColors.ink4),
            ],
          ),
        ),
      ),
    );
  }
}

// ── Estados auxiliares ─────────────────────────────────────────────────────

class _EmptyState extends StatelessWidget {
  final VoidCallback onStart;
  const _EmptyState({required this.onStart});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 64, height: 64,
              decoration: BoxDecoration(
                color: AppColors.goldBg,
                shape: BoxShape.circle,
                border: Border.all(color: AppColors.goldBorder),
              ),
              child: const Icon(Icons.route_outlined,
                  size: 30, color: AppColors.goldDark),
            ),
            const SizedBox(height: 16),
            Text('Aún no tienes pasadas',
                style: AppTheme.inter(
                    fontSize: 15,
                    fontWeight: FontWeight.w800,
                    color: AppColors.ink9)),
            const SizedBox(height: 4),
            Text(
              'Inicia tu primer turno y comenzaremos a registrar tu trazo.\n'
              'Las pasadas se agruparán por ruta automáticamente.',
              textAlign: TextAlign.center,
              style: AppTheme.inter(
                  fontSize: 12.5, color: AppColors.ink6, height: 1.4),
            ),
            const SizedBox(height: 20),
            FilledButton.icon(
              onPressed: onStart,
              icon: const Icon(Icons.play_arrow_rounded, size: 20),
              label: Text(
                'Iniciar mi primer turno',
                style: AppTheme.inter(
                  fontSize: 14,
                  fontWeight: FontWeight.w700,
                ),
              ),
              style: FilledButton.styleFrom(
                backgroundColor: AppColors.gold,
                foregroundColor: Colors.white,
                minimumSize: const Size(220, 46),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(10),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _ErrorState extends StatelessWidget {
  final Future<void> Function() onRetry;
  const _ErrorState({required this.onRetry});

  @override
  Widget build(BuildContext context) {
    return ListView(children: [
      const SizedBox(height: 80),
      Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.error_outline,
                  size: 40, color: AppColors.noApto),
              const SizedBox(height: 12),
              Text('No se pudieron cargar tus rutas.',
                  textAlign: TextAlign.center,
                  style: AppTheme.inter(
                      fontSize: 13, color: AppColors.ink7)),
              const SizedBox(height: 14),
              FilledButton.tonal(
                  onPressed: () => onRetry(),
                  child: const Text('Reintentar')),
            ],
          ),
        ),
      ),
    ]);
  }
}

/// Skeleton de carga de "Mis rutas".
///
/// Renderiza una card de turno activo + 3 cards de ruta colapsada con
/// shimmer mientras viene la data del backend. Usa un único
/// `AnimationController` compartido por todos los shimmer boxes.
class _RoutesLoadingSkeleton extends StatefulWidget {
  const _RoutesLoadingSkeleton();

  @override
  State<_RoutesLoadingSkeleton> createState() => _RoutesLoadingSkeletonState();
}

class _RoutesLoadingSkeletonState extends State<_RoutesLoadingSkeleton>
    with SingleTickerProviderStateMixin {
  late final AnimationController _ctrl;

  @override
  void initState() {
    super.initState();
    _ctrl = AnimationController(
      duration: const Duration(milliseconds: 1100),
      vsync: this,
    )..repeat();
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.fromLTRB(14, 6, 14, 24),
      children: [
        // Card "turno en curso" placeholder
        _SkeletonCardLarge(controller: _ctrl),
        const SizedBox(height: 14),
        // Header de sección
        _Shim(controller: _ctrl, w: 90, h: 11, r: 3),
        const SizedBox(height: 12),
        // Cards de ruta
        _SkeletonRouteRow(controller: _ctrl),
        const SizedBox(height: 8),
        _SkeletonRouteRow(controller: _ctrl),
        const SizedBox(height: 8),
        _SkeletonRouteRow(controller: _ctrl),
      ],
    );
  }
}

class _SkeletonCardLarge extends StatelessWidget {
  final AnimationController controller;
  const _SkeletonCardLarge({required this.controller});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.ink2),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(children: [
            _Shim(controller: controller, w: 60, h: 18, r: 999),
            const Spacer(),
            _Shim(controller: controller, w: 76, h: 12, r: 3),
          ]),
          const SizedBox(height: 12),
          _Shim(controller: controller, w: double.infinity, h: 110, r: 10),
          const SizedBox(height: 10),
          Row(children: [
            _Shim(controller: controller, w: 90, h: 12, r: 3),
            const Spacer(),
            _Shim(controller: controller, w: 110, h: 32, r: 8),
          ]),
        ],
      ),
    );
  }
}

class _SkeletonRouteRow extends StatelessWidget {
  final AnimationController controller;
  const _SkeletonRouteRow({required this.controller});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.ink2),
      ),
      child: Row(children: [
        _Shim(controller: controller, w: 38, h: 22, r: 5),
        const SizedBox(width: 10),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _Shim(controller: controller, w: 160, h: 13, r: 4),
              const SizedBox(height: 6),
              _Shim(controller: controller, w: 110, h: 10, r: 3),
            ],
          ),
        ),
        const SizedBox(width: 8),
        _Shim(controller: controller, w: 64, h: 22, r: 999),
      ]),
    );
  }
}

class _Shim extends StatelessWidget {
  final AnimationController controller;
  final double w;
  final double h;
  final double r;
  const _Shim({required this.controller, required this.w, required this.h, required this.r});

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: controller,
      builder: (_, __) => Container(
        width: w,
        height: h,
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(r),
          gradient: LinearGradient(
            begin: Alignment(-1 + controller.value * 2, -0.3),
            end: Alignment(1 + controller.value * 2, 0.3),
            colors: const [AppColors.ink1, AppColors.ink2, AppColors.ink1],
            stops: const [0.0, 0.5, 1.0],
          ),
        ),
      ),
    );
  }
}

// ── Pasada destacada ────────────────────────────────────────────────────────
//
// Buscamos la mejor pasada del conductor para mostrarla arriba con un mini
// mapa. Criterio: pase marcado `isBest:true` por el server con score más alto.
// Si ninguno cumple, fallback al `bestPassId` declarado por el grupo. Si nada
// cumple, retornamos null y la sección no se renderiza.
//
// Solo se considera una pasada con `track.length >= 2 Y` puntos con varianza
// real — pasadas donde el conductor no se movió tienen track colapsado y un
// mini-mapa explotaría con "Infinity or NaN toInt" al fitear bounds.

PassData? _findFeaturedPass(MisRecorridosData data) {
  PassData? best;
  for (final group in data.routes) {
    for (final pass in group.passes) {
      if (!_passHasValidTrack(pass)) continue;
      if (best == null) {
        best = pass;
        continue;
      }
      // Preferir las marcadas como mejores
      if (pass.isBest && !best.isBest) {
        best = pass;
        continue;
      }
      if (!pass.isBest && best.isBest) continue;
      // Empate en isBest → mayor score
      final passScore = pass.score ?? 0;
      final bestScore = best.score ?? 0;
      if (passScore > bestScore) {
        best = pass;
      } else if (passScore == bestScore) {
        // Empate en score → más reciente
        final passDate = pass.date ?? DateTime(1970);
        final bestDate = best.date ?? DateTime(1970);
        if (passDate.isAfter(bestDate)) best = pass;
      }
    }
  }
  return best;
}

bool _passHasValidTrack(PassData pass) {
  final t = pass.track;
  if (t == null || t.length < 2) return false;
  final first = t.first;
  for (final p in t) {
    if ((p.latitude - first.latitude).abs() > 1e-7 ||
        (p.longitude - first.longitude).abs() > 1e-7) {
      return true;
    }
  }
  return false;
}

class _FeaturedPassCard extends StatelessWidget {
  final PassData pass;
  final VoidCallback onTap;

  const _FeaturedPassCard({required this.pass, required this.onTap});

  static final _dateFmt = DateFormat("d 'de' MMM, HH:mm", 'es');

  @override
  Widget build(BuildContext context) {
    final track = pass.track!;
    final dist = pass.distanceMeters;
    final dur = pass.durationSeconds;
    final compl = pass.routeCompliancePercentage;

    String fmtDist(num? m) {
      if (m == null || m == 0) return '—';
      final d = m.toDouble();
      if (d < 1000) return '${d.round()} m';
      return '${(d / 1000).toStringAsFixed(1)} km';
    }

    String fmtDur(int? s) {
      if (s == null || s == 0) return '—';
      final h = s ~/ 3600;
      final m = (s % 3600) ~/ 60;
      if (h == 0) return '${m}m';
      return '${h}h${m.toString().padLeft(2, "0")}';
    }

    return Material(
      color: Colors.white,
      borderRadius: BorderRadius.circular(14),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onTap,
        splashColor: AppColors.goldBg.withValues(alpha: 0.5),
        highlightColor: AppColors.goldBg.withValues(alpha: 0.2),
        child: Ink(
          decoration: BoxDecoration(
            border: Border.all(color: AppColors.goldBorder, width: 1.5),
            borderRadius: BorderRadius.circular(14),
            boxShadow: [
              BoxShadow(
                color: AppColors.gold.withValues(alpha: 0.08),
                blurRadius: 12,
                offset: const Offset(0, 3),
              ),
            ],
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // ── Mini mapa con el trazo dorado ────────────────────
              ClipRRect(
                borderRadius:
                    const BorderRadius.vertical(top: Radius.circular(13)),
                child: SizedBox(
                  height: 160,
                  child: IgnorePointer(
                    child: FlutterMap(
                      options: MapOptions(
                        initialCameraFit: CameraFit.bounds(
                          bounds: LatLngBounds.fromPoints(track),
                          padding: const EdgeInsets.all(20),
                        ),
                        interactionOptions: const InteractionOptions(
                            flags: InteractiveFlag.none),
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
                            points: track,
                            color: AppColors.gold,
                            strokeWidth: 4,
                          ),
                        ]),
                        MarkerLayer(markers: [
                          Marker(
                            point: track.first,
                            width: 22,
                            height: 22,
                            child: Container(
                              decoration: BoxDecoration(
                                color: AppColors.apto,
                                shape: BoxShape.circle,
                                border: Border.all(
                                    color: Colors.white, width: 2),
                              ),
                              alignment: Alignment.center,
                              child: const Icon(Icons.play_arrow_rounded,
                                  size: 12, color: Colors.white),
                            ),
                          ),
                          Marker(
                            point: track.last,
                            width: 22,
                            height: 22,
                            child: Container(
                              decoration: BoxDecoration(
                                color: AppColors.noApto,
                                shape: BoxShape.circle,
                                border: Border.all(
                                    color: Colors.white, width: 2),
                              ),
                              alignment: Alignment.center,
                              child: const Icon(Icons.stop_rounded,
                                  size: 11, color: Colors.white),
                            ),
                          ),
                        ]),
                      ],
                    ),
                  ),
                ),
              ),
              // ── Encabezado: badge MEJOR + ruta + fecha ───────────
              Padding(
                padding: const EdgeInsets.fromLTRB(14, 12, 14, 4),
                child: Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 7, vertical: 3),
                      decoration: BoxDecoration(
                        color: AppColors.gold,
                        borderRadius: BorderRadius.circular(999),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const Icon(Icons.workspace_premium_rounded,
                              size: 12, color: Colors.white),
                          const SizedBox(width: 3),
                          Text(
                            pass.isBest ? 'MEJOR' : 'RECIENTE',
                            style: AppTheme.inter(
                              fontSize: 9.5,
                              fontWeight: FontWeight.w800,
                              color: Colors.white,
                              letterSpacing: 0.8,
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        pass.routeName ?? 'Recorrido sin ruta',
                        style: AppTheme.inter(
                          fontSize: 14,
                          fontWeight: FontWeight.w800,
                          color: AppColors.ink9,
                          letterSpacing: -0.2,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                    if (pass.date != null)
                      Text(
                        _dateFmt.format(pass.date!.toLocal()),
                        style: AppTheme.inter(
                          fontSize: 11,
                          color: AppColors.ink5,
                          tabular: true,
                        ),
                      ),
                  ],
                ),
              ),
              // ── Métricas en fila ─────────────────────────────────
              Padding(
                padding: const EdgeInsets.fromLTRB(14, 8, 14, 12),
                child: Row(
                  children: [
                    _MiniMetric(
                      icon: Icons.straighten_rounded,
                      label: fmtDist(dist),
                    ),
                    const SizedBox(width: 14),
                    _MiniMetric(
                      icon: Icons.schedule_rounded,
                      label: fmtDur(dur),
                    ),
                    if (compl != null) ...[
                      const SizedBox(width: 14),
                      _MiniMetric(
                        icon: Icons.verified_outlined,
                        label: '$compl%',
                        accent: compl >= 80
                            ? AppColors.apto
                            : compl >= 50
                                ? AppColors.riesgo
                                : AppColors.noApto,
                      ),
                    ],
                    const Spacer(),
                    Container(
                      padding: const EdgeInsets.all(6),
                      decoration: BoxDecoration(
                        color: AppColors.goldBg,
                        shape: BoxShape.circle,
                        border: Border.all(color: AppColors.goldBorder),
                      ),
                      child: const Icon(Icons.arrow_forward_rounded,
                          size: 14, color: AppColors.goldDark),
                    ),
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

class _MiniMetric extends StatelessWidget {
  final IconData icon;
  final String label;
  final Color? accent;

  const _MiniMetric({required this.icon, required this.label, this.accent});

  @override
  Widget build(BuildContext context) {
    final color = accent ?? AppColors.ink7;
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: 13, color: color),
        const SizedBox(width: 4),
        Text(
          label,
          style: AppTheme.inter(
            fontSize: 12,
            fontWeight: FontWeight.w700,
            color: color,
            tabular: true,
          ),
        ),
      ],
    );
  }
}
