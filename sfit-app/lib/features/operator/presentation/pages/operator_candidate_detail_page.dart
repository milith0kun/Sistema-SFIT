import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import '../../../../shared/widgets/map/sfit_map_tiles.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:latlong2/latlong.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../shared/widgets/sfit_loading.dart';
import '../../../../shared/models/route_candidate_model.dart';
import '../../../../shared/models/route_model.dart';
import '../../data/datasources/operator_api_service.dart';
import 'operator_routes_page.dart'
    show Candidate, pointsToLatLng, formatDistance, ago;

/// Detalle de una **captura GPS candidata** — RF-09 mobile.
///
/// Layout estilo Google Maps: mapa full-screen como base, bottom sheet
/// draggable con la información y los CTAs para validar / asignar / descartar.
class OperatorCandidateDetailPage extends ConsumerStatefulWidget {
  /// `seed` puede pasarse por `extra` cuando navegamos desde la lista para
  /// pintar el mapa al instante con el `samplePolyline` mientras se cargan
  /// los puntos completos.
  final String candidateId;
  final Candidate? seed;

  const OperatorCandidateDetailPage({
    super.key,
    required this.candidateId,
    this.seed,
  });

  @override
  ConsumerState<OperatorCandidateDetailPage> createState() =>
      _OperatorCandidateDetailPageState();
}

class _OperatorCandidateDetailPageState
    extends ConsumerState<OperatorCandidateDetailPage> {
  final _mapCtl = MapController();
  final _sheetCtl = DraggableScrollableController();

  bool _loading = true;
  String? _error;

  // Datos de la captura
  RouteCandidateModel? _meta;
  List<LatLng> _points = const [];

  @override
  void initState() {
    super.initState();
    _meta = widget.seed;
    _points = widget.seed != null ? pointsToLatLng(widget.seed!.points) : const [];
    _load();
  }

  @override
  void dispose() {
    _sheetCtl.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final service = ref.read(operatorApiServiceProvider);
      final meta = await service.getRouteCandidateDetail(widget.candidateId);
      final points = pointsToLatLng(meta.points);

      if (mounted) {
        setState(() {
          _meta = meta;
          _points = points;
          _loading = false;
        });
      }
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) _fitCamera();
      });
    } catch (e) {
      if (mounted) {
        setState(() {
          _error = _extractError(e);
          _loading = false;
        });
      }
    }
  }

  String _extractError(Object e) {
    if (e is DioException) {
      final data = e.response?.data;
      if (data is Map && data['error'] is String) return data['error'] as String;
      if (data is Map && data['message'] is String) return data['message'] as String;
    }
    return 'No se pudo cargar la captura';
  }

  // ── Centrar trazo (replicamos el patrón de bus_detail con padding asim.) ──
  void _fitCamera() {
    if (_points.length < 2) return;
    try {
      final mq = MediaQuery.of(context);
      final screenH = mq.size.height;
      final sheetFraction = _sheetCtl.isAttached ? _sheetCtl.size : 0.32;
      final bottomPad = (screenH * sheetFraction).clamp(120.0, screenH * 0.6) + 16;
      final topPad = mq.padding.top + 72;
      _mapCtl.fitCamera(CameraFit.bounds(
        bounds: LatLngBounds.fromPoints(_points),
        padding: EdgeInsets.fromLTRB(48, topPad, 48, bottomPad),
      ));
    } catch (_) {/* defensivo */}
  }

  // ── Acciones ──────────────────────────────────────────────────────────

  Future<void> _onCreateNewRoute() async {
    final meta = _meta;
    if (meta == null) return;
    final ok = await context.push<bool>(
      '/operador/rutas/candidatas/${widget.candidateId}/validar',
      extra: meta,
    );
    if (!mounted) return;
    if (ok == true) {
      ref.invalidate(routeCandidatesProvider);
      Navigator.of(context).maybePop();
    }
  }

  Future<void> _onAssignToExisting() async {
    final meta = _meta;
    if (meta == null) return;
    final routeId = await showModalBottomSheet<String>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _AssignRouteSheet(),
    );
    if (routeId == null || !mounted) return;

    try {
      final service = ref.read(operatorApiServiceProvider);
      await service.assignRouteCandidate(widget.candidateId, routeId: routeId);
      if (!mounted) return;
      ref.invalidate(routeCandidatesProvider);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Captura asignada a la ruta seleccionada.'),
          behavior: SnackBarBehavior.floating,
          backgroundColor: AppColors.apto,
        ),
      );
      Navigator.of(context).maybePop();
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('No se pudo asignar: ${_extractError(e)}'),
          behavior: SnackBarBehavior.floating,
          backgroundColor: AppColors.noApto,
        ),
      );
    }
  }

  /// Borra la captura definitivamente (DELETE /rutas/candidatas/[id]).
  /// Distinto de "descartar" (que solo marca status=rejected y la deja en
  /// la base por auditoría). Aquí se elimina el documento por completo.
  Future<void> _onDeleteForever() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Eliminar captura'),
        content: const Text(
          'Esta acción borra la captura y todo su trazo GPS de la base. '
          'No se puede deshacer. ¿Continuar?',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Cancelar'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(ctx, true),
            style: FilledButton.styleFrom(backgroundColor: AppColors.noApto),
            child: const Text('Sí, eliminar'),
          ),
        ],
      ),
    );
    if (confirmed != true || !mounted) return;

    try {
      final service = ref.read(operatorApiServiceProvider);
      await service.deleteRouteCandidate(widget.candidateId);
      if (!mounted) return;
      ref.invalidate(routeCandidatesProvider);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Captura eliminada definitivamente.'),
          behavior: SnackBarBehavior.floating,
          backgroundColor: AppColors.ink9,
        ),
      );
      Navigator.of(context).maybePop();
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('No se pudo eliminar: ${_extractError(e)}'),
          behavior: SnackBarBehavior.floating,
          backgroundColor: AppColors.noApto,
        ),
      );
    }
  }

  Future<void> _onDiscard() async {
    final confirmed = await showModalBottomSheet<bool>(
      context: context,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(18)),
      ),
      builder: (ctx) => Padding(
        padding: const EdgeInsets.fromLTRB(20, 14, 20, 24),
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          Container(
            margin: const EdgeInsets.only(bottom: 14),
            width: 38,
            height: 4,
            decoration: BoxDecoration(
              color: AppColors.ink2,
              borderRadius: BorderRadius.circular(2),
            ),
          ),
          const Icon(Icons.warning_amber_rounded,
              size: 38, color: AppColors.noApto),
          const SizedBox(height: 10),
          Text(
            'Descartar esta captura',
            style: AppTheme.inter(
              fontSize: 17,
              fontWeight: FontWeight.w800,
              color: AppColors.ink9,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            'No se podrá recuperar. ¿Confirmas que esta captura no es útil?',
            textAlign: TextAlign.center,
            style: AppTheme.inter(
              fontSize: 13,
              color: AppColors.ink6,
              height: 1.4,
            ),
          ),
          const SizedBox(height: 18),
          Row(children: [
            Expanded(
              child: OutlinedButton(
                onPressed: () => Navigator.pop(ctx, false),
                style: OutlinedButton.styleFrom(
                  foregroundColor: AppColors.ink8,
                  side: const BorderSide(color: AppColors.ink3),
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(10),
                  ),
                ),
                child: Text(
                  'Cancelar',
                  style: AppTheme.inter(
                    fontSize: 14,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: FilledButton(
                onPressed: () => Navigator.pop(ctx, true),
                style: FilledButton.styleFrom(
                  backgroundColor: AppColors.noApto,
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(10),
                  ),
                ),
                child: Text(
                  'Sí, descartar',
                  style: AppTheme.inter(
                    fontSize: 14,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ),
            ),
          ]),
        ]),
      ),
    );
    if (confirmed != true || !mounted) return;

    try {
      final service = ref.read(operatorApiServiceProvider);
      await service.dismissRouteCandidate(widget.candidateId, reason: '');
      if (!mounted) return;
      ref.invalidate(routeCandidatesProvider);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Captura descartada.'),
          behavior: SnackBarBehavior.floating,
          backgroundColor: AppColors.ink9,
        ),
      );
      Navigator.of(context).maybePop();
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('No se pudo descartar: ${_extractError(e)}'),
          behavior: SnackBarBehavior.floating,
          backgroundColor: AppColors.noApto,
        ),
      );
    }
  }

  // ── Build ─────────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    final meta = _meta;
    final hasTrack = _points.length >= 2;
    // Centro inicial: primer punto, o Plaza de Armas Cusco como fallback.
    final initialCenter = hasTrack ? _points.first : const LatLng(-13.5163, -71.9785);
    final title = meta?.suggestedName?.trim().isNotEmpty == true
        ? meta!.suggestedName!
        : 'Captura';

    return Scaffold(
      backgroundColor: AppColors.paper,
      body: Stack(children: [
        // ── Mapa ──────────────────────────────────────────────────────
        Positioned.fill(
          child: FlutterMap(
            mapController: _mapCtl,
            options: MapOptions(
              initialCenter: initialCenter,
              initialZoom: 14,
            ),
            children: [
              sfitCartoVoyagerTile(),
              if (hasTrack)
                PolylineLayer(polylines: [
                  Polyline(
                    points: _points,
                    color: AppColors.gold,
                    strokeWidth: 5,
                  ),
                ]),
              if (hasTrack)
                MarkerLayer(markers: [
                  Marker(
                    point: _points.first,
                    width: 28,
                    height: 28,
                    child: Container(
                      decoration: BoxDecoration(
                        color: AppColors.apto,
                        shape: BoxShape.circle,
                        border: Border.all(color: Colors.white, width: 3),
                        boxShadow: [
                          BoxShadow(
                            color: Colors.black.withValues(alpha: 0.25),
                            blurRadius: 4,
                          ),
                        ],
                      ),
                      alignment: Alignment.center,
                      child: const Icon(
                        Icons.flag_rounded,
                        size: 14,
                        color: Colors.white,
                      ),
                    ),
                  ),
                  Marker(
                    point: _points.last,
                    width: 28,
                    height: 28,
                    child: Container(
                      decoration: BoxDecoration(
                        color: AppColors.noApto,
                        shape: BoxShape.circle,
                        border: Border.all(color: Colors.white, width: 3),
                        boxShadow: [
                          BoxShadow(
                            color: Colors.black.withValues(alpha: 0.25),
                            blurRadius: 4,
                          ),
                        ],
                      ),
                      alignment: Alignment.center,
                      child: const Icon(
                        Icons.flag_rounded,
                        size: 14,
                        color: Colors.white,
                      ),
                    ),
                  ),
                ]),
            ],
          ),
        ),

        // ── Botones flotantes superiores ────────────────────────────
        Positioned(
          top: MediaQuery.of(context).padding.top + 8,
          left: 12,
          right: 12,
          child: Row(children: [
            _floatingIconButton(
              icon: Icons.arrow_back_rounded,
              onTap: () => Navigator.of(context).maybePop(),
              tooltip: 'Volver',
            ),
            const SizedBox(width: 8),
            Expanded(
              child: Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 14, vertical: 9),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(999),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withValues(alpha: 0.10),
                      blurRadius: 8,
                    ),
                  ],
                ),
                child: Row(children: [
                  const Icon(
                    Icons.timeline_outlined,
                    size: 17,
                    color: AppColors.primary,
                  ),
                  const SizedBox(width: 6),
                  Expanded(
                    child: Text(
                      'Captura · $title',
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
              ),
            ),
            const SizedBox(width: 8),
            _floatingIconButton(
              icon: Icons.center_focus_strong_outlined,
              onTap: _fitCamera,
              tooltip: 'Centrar trazo',
            ),
          ]),
        ),

        // ── Banner de error si aplica ───────────────────────────────
        if (_error != null)
          Positioned(
            top: MediaQuery.of(context).padding.top + 64,
            left: 12,
            right: 12,
            child: Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: AppColors.noAptoBg,
                border: Border.all(color: AppColors.noAptoBorder),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Row(children: [
                const Icon(
                  Icons.error_outline,
                  size: 18,
                  color: AppColors.noApto,
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    _error!,
                    style: AppTheme.inter(
                      fontSize: 12.5,
                      color: AppColors.noApto,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
                TextButton(
                  onPressed: _load,
                  child: Text(
                    'Reintentar',
                    style: AppTheme.inter(
                      fontSize: 12,
                      fontWeight: FontWeight.w800,
                      color: AppColors.noApto,
                    ),
                  ),
                ),
              ]),
            ),
          ),

        // ── Bottom sheet con datos + CTAs ───────────────────────────
        DraggableScrollableSheet(
          controller: _sheetCtl,
          initialChildSize: 0.32,
          minChildSize: 0.18,
          maxChildSize: 0.85,
          snap: true,
          snapSizes: const [0.18, 0.32, 0.85],
          builder: (_, scrollController) => Container(
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: const BorderRadius.vertical(
                top: Radius.circular(20),
              ),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.12),
                  blurRadius: 16,
                  offset: const Offset(0, -2),
                ),
              ],
            ),
            child: ListView(
              controller: scrollController,
              padding: EdgeInsets.zero,
              children: [
                Center(
                  child: Container(
                    margin: const EdgeInsets.only(top: 8, bottom: 4),
                    width: 38,
                    height: 4,
                    decoration: BoxDecoration(
                      color: AppColors.ink2,
                      borderRadius: BorderRadius.circular(2),
                    ),
                  ),
                ),
                if (_loading && meta == null)
                  const Padding(
                    padding: EdgeInsets.all(36),
                    child: SfitLoading.page(color: AppColors.primary),
                  )
                else
                  Padding(
                    padding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        if (meta != null) _summaryHeader(meta),
                        const SizedBox(height: 14),
                        if (meta != null) _kpiRow(meta),
                        const SizedBox(height: 18),
                        Text(
                          'ACCIONES',
                          style: AppTheme.inter(
                            fontSize: 10.5,
                            fontWeight: FontWeight.w800,
                            color: AppColors.ink5,
                            letterSpacing: 1.4,
                          ),
                        ),
                        const SizedBox(height: 10),
                        _ctaButton(
                          icon: Icons.check_rounded,
                          label: 'Crear como ruta nueva',
                          subtitle:
                              'Validá la captura y creá una ruta oficial.',
                          color: AppColors.gold,
                          onTap: meta == null ? null : _onCreateNewRoute,
                        ),
                        const SizedBox(height: 10),
                        _ctaButton(
                          icon: Icons.alt_route_rounded,
                          label: 'Asignar a ruta existente',
                          subtitle:
                              'Vincular esta captura a una ruta ya registrada.',
                          color: AppColors.info,
                          onTap: meta == null ? null : _onAssignToExisting,
                        ),
                        const SizedBox(height: 10),
                        _ctaButton(
                          icon: Icons.close_rounded,
                          label: 'Descartar',
                          subtitle:
                              'La captura no se utilizará para crear rutas.',
                          color: AppColors.noApto,
                          onTap: meta == null ? null : _onDiscard,
                        ),
                        const SizedBox(height: 10),
                        _ctaButton(
                          icon: Icons.delete_forever_outlined,
                          label: 'Eliminar definitivamente',
                          subtitle:
                              'Borra la captura y su trazo GPS. No se puede deshacer.',
                          color: AppColors.noApto,
                          onTap: meta == null ? null : _onDeleteForever,
                        ),
                        const SizedBox(height: 24),
                      ],
                    ),
                  ),
              ],
            ),
          ),
        ),
      ]),
    );
  }

  // ── Sub-widgets del sheet ─────────────────────────────────────────────

  Widget _summaryHeader(RouteCandidateModel meta) {
    final title = meta.suggestedName?.trim().isNotEmpty == true
        ? meta.suggestedName!
        : 'Captura GPS';
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          padding: const EdgeInsets.all(8),
          decoration: BoxDecoration(
            color: AppColors.primaryBg,
            border: Border.all(color: AppColors.primaryBorder),
            borderRadius: BorderRadius.circular(10),
          ),
          child: const Icon(
            Icons.timeline_outlined,
            size: 20,
            color: AppColors.primary,
          ),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                title,
                style: AppTheme.inter(
                  fontSize: 16,
                  fontWeight: FontWeight.w800,
                  color: AppColors.ink9,
                ),
              ),
              const SizedBox(height: 2),
              Text(
                ago(meta.createdAt),
                style: AppTheme.inter(
                  fontSize: 11.5,
                  color: AppColors.ink5,
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _kpiRow(RouteCandidateModel meta) {
    final score = ((meta.avgConfidence ?? 0) * 100).round();
    final scoreColor = score >= 80
        ? AppColors.apto
        : score >= 60
            ? AppColors.riesgo
            : AppColors.noApto;
    return Row(children: [
      Expanded(
        child: _kpi(
          label: 'Distancia',
          value: formatDistance((meta.distanceMeters ?? 0).round()),
        ),
      ),
      Expanded(
        child: _kpi(
          label: 'Puntos',
          value: '${meta.sampleCount ?? 0}',
        ),
      ),
      Expanded(
        child: _kpi(
          label: 'Paradas',
          value: '${meta.detectedStops.length}',
        ),
      ),
      Expanded(
        child: _kpi(
          label: 'Score',
          value: '$score',
          valueColor: scoreColor,
        ),
      ),
    ]);
  }

  Widget _kpi({
    required String label,
    required String value,
    Color? valueColor,
  }) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label.toUpperCase(),
          style: AppTheme.inter(
            fontSize: 9.5,
            fontWeight: FontWeight.w700,
            color: AppColors.ink5,
            letterSpacing: 1.2,
          ),
        ),
        const SizedBox(height: 2),
        Text(
          value,
          style: AppTheme.inter(
            fontSize: 16,
            fontWeight: FontWeight.w800,
            color: valueColor ?? AppColors.ink9,
            tabular: true,
          ),
        ),
      ],
    );
  }

  Widget _ctaButton({
    required IconData icon,
    required String label,
    required String subtitle,
    required Color color,
    VoidCallback? onTap,
  }) {
    return Material(
      color: Colors.white,
      borderRadius: BorderRadius.circular(12),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            border: Border.all(color: AppColors.ink2),
            borderRadius: BorderRadius.circular(12),
          ),
          child: Row(children: [
            Container(
              width: 42,
              height: 42,
              decoration: BoxDecoration(
                color: color.withValues(alpha: 0.10),
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: color.withValues(alpha: 0.35)),
              ),
              alignment: Alignment.center,
              child: Icon(icon, size: 20, color: color),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    label,
                    style: AppTheme.inter(
                      fontSize: 14,
                      fontWeight: FontWeight.w800,
                      color: AppColors.ink9,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    subtitle,
                    style: AppTheme.inter(
                      fontSize: 11.5,
                      color: AppColors.ink5,
                      height: 1.35,
                    ),
                  ),
                ],
              ),
            ),
            const Icon(
              Icons.chevron_right,
              size: 20,
              color: AppColors.ink4,
            ),
          ]),
        ),
      ),
    );
  }

  Widget _floatingIconButton({
    required IconData icon,
    required VoidCallback onTap,
    required String tooltip,
  }) {
    return Material(
      color: Colors.white,
      shape: const CircleBorder(),
      elevation: 4,
      shadowColor: Colors.black.withValues(alpha: 0.25),
      child: InkWell(
        onTap: onTap,
        customBorder: const CircleBorder(),
        child: Tooltip(
          message: tooltip,
          child: SizedBox(
            width: 44,
            height: 44,
            child: Icon(icon, size: 22, color: AppColors.ink8),
          ),
        ),
      ),
    );
  }
}

// ── Modal: asignar a ruta existente ─────────────────────────────────────

class _AssignRouteSheet extends ConsumerStatefulWidget {
  @override
  ConsumerState<_AssignRouteSheet> createState() => _AssignRouteSheetState();
}

class _AssignRouteSheetState extends ConsumerState<_AssignRouteSheet> {
  bool _loading = true;
  List<RouteModel> _routes = const [];
  String? _selected;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final service = ref.read(operatorApiServiceProvider);
      final list = await service.getRoutes(limit: 200);
      if (mounted) {
        setState(() {
          _routes = list;
          _loading = false;
        });
      }
    } catch (_) {
      if (mounted) {
        setState(() {
          _routes = const [];
          _loading = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final mq = MediaQuery.of(context);
    return Container(
      constraints: BoxConstraints(maxHeight: mq.size.height * 0.7),
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(18)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            margin: const EdgeInsets.only(top: 10, bottom: 6),
            width: 38,
            height: 4,
            decoration: BoxDecoration(
              color: AppColors.ink2,
              borderRadius: BorderRadius.circular(2),
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 8, 20, 6),
            child: Row(children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Asignar a ruta existente',
                      style: AppTheme.inter(
                        fontSize: 16,
                        fontWeight: FontWeight.w800,
                        color: AppColors.ink9,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      'La captura quedará vinculada a la ruta como `raw`.',
                      style: AppTheme.inter(
                        fontSize: 12,
                        color: AppColors.ink5,
                      ),
                    ),
                  ],
                ),
              ),
            ]),
          ),
          const Divider(height: 18, color: AppColors.ink2),
          Flexible(
            child: _loading
                ? const Padding(
                    padding: EdgeInsets.all(28),
                    child: SfitLoading.page(color: AppColors.primary),
                  )
                : _routes.isEmpty
                    ? Padding(
                        padding: const EdgeInsets.all(24),
                        child: Column(children: [
                          const Icon(
                            Icons.route_outlined,
                            size: 32,
                            color: AppColors.ink4,
                          ),
                          const SizedBox(height: 8),
                          Text(
                            'No hay rutas disponibles',
                            style: AppTheme.inter(
                              fontSize: 13,
                              fontWeight: FontWeight.w700,
                              color: AppColors.ink8,
                            ),
                          ),
                        ]),
                      )
                    : ListView.separated(
                        shrinkWrap: true,
                        padding: const EdgeInsets.fromLTRB(12, 4, 12, 4),
                        itemCount: _routes.length,
                        separatorBuilder: (_, __) =>
                            const SizedBox(height: 6),
                        itemBuilder: (_, i) {
                          final r = _routes[i];
                          final code = r.code ?? '';
                          final name = r.name ?? '';
                          final selected = _selected == r.id;
                          return Material(
                            color: selected
                                ? AppColors.primaryBg
                                : Colors.white,
                            borderRadius: BorderRadius.circular(10),
                            child: InkWell(
                              borderRadius: BorderRadius.circular(10),
                              onTap: () => setState(() => _selected = r.id),
                              child: Container(
                                padding: const EdgeInsets.all(12),
                                decoration: BoxDecoration(
                                  border: Border.all(
                                    color: selected
                                        ? AppColors.primaryBorder
                                        : AppColors.ink2,
                                  ),
                                  borderRadius: BorderRadius.circular(10),
                                ),
                                child: Row(children: [
                                  Icon(
                                    selected
                                        ? Icons.radio_button_checked
                                        : Icons.radio_button_off,
                                    size: 18,
                                    color: selected
                                        ? AppColors.primary
                                        : AppColors.ink4,
                                  ),
                                  const SizedBox(width: 10),
                                  if (code.isNotEmpty) ...[
                                    Container(
                                      padding: const EdgeInsets.symmetric(
                                        horizontal: 6,
                                        vertical: 2,
                                      ),
                                      decoration: BoxDecoration(
                                        color: AppColors.ink1,
                                        borderRadius:
                                            BorderRadius.circular(4),
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
                                    const SizedBox(width: 8),
                                  ],
                                  Expanded(
                                    child: Text(
                                      name,
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                      style: AppTheme.inter(
                                        fontSize: 13.5,
                                        fontWeight: FontWeight.w700,
                                        color: AppColors.ink9,
                                      ),
                                    ),
                                  ),
                                ]),
                              ),
                            ),
                          );
                        },
                      ),
          ),
          Padding(
            padding: EdgeInsets.fromLTRB(
              16,
              10,
              16,
              16 + mq.viewInsets.bottom,
            ),
            child: SizedBox(
              width: double.infinity,
              height: 50,
              child: FilledButton(
                onPressed: _selected == null
                    ? null
                    : () => Navigator.pop(context, _selected),
                style: FilledButton.styleFrom(
                  backgroundColor: AppColors.gold,
                  foregroundColor: Colors.white,
                  disabledBackgroundColor: AppColors.ink3,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(10),
                  ),
                ),
                child: Text(
                  'Confirmar asignación',
                  style: AppTheme.inter(
                    fontSize: 14,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
