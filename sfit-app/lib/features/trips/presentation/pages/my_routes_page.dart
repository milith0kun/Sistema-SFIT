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

  @override
  Widget build(BuildContext context) {
    final async = ref.watch(misRecorridosProvider);

    return SafeArea(
      child: Column(
        children: [
          // ── Header ──────────────────────────────────────────────
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 4),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Mis rutas',
                    style: AppTheme.inter(
                      fontSize: 18, fontWeight: FontWeight.w800,
                      color: AppColors.ink9)),
                const SizedBox(height: 2),
                Text('Tus pasadas agrupadas por ruta',
                    style: AppTheme.inter(fontSize: 13, color: AppColors.ink5)),
              ],
            ),
          ),
          const SizedBox(height: 8),

          // ── Cuerpo ──────────────────────────────────────────────
          Expanded(
            child: async.when(
              loading: () => const Center(
                  child: CircularProgressIndicator(color: AppColors.gold)),
              error: (_, __) => _ErrorState(onRetry: _refresh),
              data: (data) {
                final hasActive = data.activeEntry != null;
                final hasRoutes = data.routes.isNotEmpty;
                if (!hasActive && !hasRoutes) {
                  return RefreshIndicator(
                    onRefresh: _refresh,
                    color: AppColors.gold,
                    child: ListView(children: const [
                      SizedBox(height: 60),
                      _EmptyState(),
                    ]),
                  );
                }
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
                          onClose: () {
                            final id = data.activeEntry!.id;
                            final plate = data.activeEntry!.vehiclePlate;
                            final dep = data.activeEntry!.departureTime ?? '';
                            context.push(
                              '/viaje-checkout/$id',
                              extra: {
                                'vehiclePlate': plate,
                                'departureTime': dep,
                                'estimatedKm': null,
                              },
                            );
                          },
                          onSeeMap: () {
                            context.push('/buses-en-vivo/${data.activeEntry!.id}');
                          },
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
                            child: _RouteGroupTile(group: route),
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

// ── Provider ────────────────────────────────────────────────────────────────

/// Carga el endpoint `/conductor/mis-recorridos` ya tipado en `MisRecorridos`.
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
  const _RouteGroupTile({required this.group});

  @override
  State<_RouteGroupTile> createState() => _RouteGroupTileState();
}

class _RouteGroupTileState extends State<_RouteGroupTile> {
  bool _expanded = false;

  @override
  Widget build(BuildContext context) {
    final g = widget.group;
    final code = g.code ?? '—';
    final name = g.name ?? 'Sin ruta asignada';
    final hasNoRoute = g.routeId == null;

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
                          '/conductor/recorrido-detalle/${g.passes[i].id}');
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
  const _EmptyState();

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
            Text('Aún no tenés pasadas',
                style: AppTheme.inter(
                    fontSize: 15,
                    fontWeight: FontWeight.w800,
                    color: AppColors.ink9)),
            const SizedBox(height: 4),
            Text(
              'Iniciá tu primer turno desde "Inicio" del conductor.\n'
              'Tus pasadas se irán agrupando por ruta automáticamente.',
              textAlign: TextAlign.center,
              style: AppTheme.inter(
                  fontSize: 12.5, color: AppColors.ink6, height: 1.4),
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
