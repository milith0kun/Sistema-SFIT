import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import 'package:latlong2/latlong.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../shared/models/fleet_entry_model.dart';
import '../../../../shared/widgets/map/sfit_map_tiles.dart';
import '../../../../shared/widgets/sfit_loading.dart';
import '../../../operator/data/datasources/operator_api_service.dart';
import '../../../../shared/models/fleet_entry_model.dart';

/// Detalle de una entrada de flota (FleetEntry) para el rol OPERADOR.
///
/// Llega desde el tab Flota al tap sobre una card. Muestra:
/// - Cabecera con placa, conductor y estado del turno.
/// - Ruta asignada (si la hay) con código + nombre.
/// - Horario salida → retorno, km recorridos, observaciones.
/// - Mini-mapa con el track GPS cuando el turno está cerrado.
class FleetEntryDetailPage extends ConsumerStatefulWidget {
  final String entryId;
  const FleetEntryDetailPage({super.key, required this.entryId});

  @override
  ConsumerState<FleetEntryDetailPage> createState() =>
      _FleetEntryDetailPageState();
}

class _FleetEntryDetailPageState extends ConsumerState<FleetEntryDetailPage> {
  AsyncValue<FleetEntryModel> _entry = const AsyncValue.loading();

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _entry = const AsyncValue.loading());
    try {
      final api = ref.read(operatorApiServiceProvider);
      final detail = await api.getFleetEntryDetail(widget.entryId);
      if (mounted) setState(() => _entry = AsyncValue.data(detail));
    } catch (e, st) {
      if (mounted) setState(() => _entry = AsyncValue.error(e, st));
    }
  }

  String _fmtTime(String? iso) {
    if (iso == null) return '—';
    try {
      final dt = DateTime.parse(iso).toLocal();
      return DateFormat('dd MMM · HH:mm', 'es').format(dt);
    } catch (_) {
      return iso;
    }
  }

  List<LatLng> _track(FleetEntryModel e) {
    return e.trackPoints
        .map<LatLng?>((p) {
          final lat = (p['lat'] as num?)?.toDouble();
          final lng = (p['lng'] as num?)?.toDouble();
          if (lat == null || lng == null) return null;
          if (lat.isNaN || lng.isNaN || lat.isInfinite || lng.isInfinite) {
            return null;
          }
          return LatLng(lat, lng);
        })
        .whereType<LatLng>()
        .toList();
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
          'Detalle de turno',
          style: AppTheme.inter(
            fontSize: 16,
            fontWeight: FontWeight.w700,
            color: AppColors.ink9,
          ),
        ),
        iconTheme: const IconThemeData(color: AppColors.ink9),
      ),
      body: _entry.when(
        loading: () => const SfitLoading.page(color: AppColors.primary),
        error: (_, __) => _ErrorView(onRetry: _load),
        data: (e) => RefreshIndicator(
          color: AppColors.primary,
          onRefresh: _load,
          child: ListView(
            padding: const EdgeInsets.fromLTRB(14, 14, 14, 24),
            children: [
              _HeaderCard(entry: e),
              const SizedBox(height: 12),
              _MetaSection(entry: e, fmtTime: _fmtTime),
              const SizedBox(height: 12),
              if (e.observations != null && e.observations!.isNotEmpty)
                _ObservationsCard(text: e.observations!),
              const SizedBox(height: 12),
              _TrackPreview(points: _track(e), status: e.status ?? ''),
            ],
          ),
        ),
      ),
    );
  }
}

// ── Header con placa, conductor y estado ────────────────────────────────

class _HeaderCard extends StatelessWidget {
  final FleetEntryModel entry;
  const _HeaderCard({required this.entry});

  @override
  Widget build(BuildContext context) {
    final s = _statusInfo(entry.status ?? '');
    final plate = entry.vehiclePlate ?? '—';
    final driver = entry.driverName ?? 'Sin conductor';
    final dStatus = entry.driverStatus ?? 'apto';
    final dStatusInfo = _driverStatusInfo(dStatus);

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        border: Border.all(color: AppColors.ink2),
        borderRadius: BorderRadius.circular(14),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(children: [
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
              decoration: BoxDecoration(
                color: AppColors.panel,
                borderRadius: BorderRadius.circular(8),
              ),
              child: Text(
                plate,
                style: AppTheme.inter(
                  fontSize: 14,
                  fontWeight: FontWeight.w800,
                  color: Colors.white,
                  letterSpacing: 0.5,
                ),
              ),
            ),
            const Spacer(),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
              decoration: BoxDecoration(
                color: s.bg,
                border: Border.all(color: s.border),
                borderRadius: BorderRadius.circular(999),
              ),
              child: Text(
                s.label,
                style: AppTheme.inter(
                  fontSize: 10,
                  fontWeight: FontWeight.w800,
                  color: s.fg,
                  letterSpacing: 0.6,
                ),
              ),
            ),
          ]),
          const SizedBox(height: 12),
          Row(children: [
            Container(
              width: 8,
              height: 8,
              decoration: BoxDecoration(
                color: dStatusInfo.fg,
                shape: BoxShape.circle,
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: Text(
                driver,
                style: AppTheme.inter(
                  fontSize: 14,
                  fontWeight: FontWeight.w700,
                  color: AppColors.ink9,
                ),
              ),
            ),
            Text(
              dStatusInfo.label,
              style: AppTheme.inter(
                fontSize: 11.5,
                fontWeight: FontWeight.w700,
                color: dStatusInfo.fg,
              ),
            ),
          ]),
        ],
      ),
    );
  }
}

// ── Metadatos: ruta, horario, km, capture ──────────────────────────────

class _MetaSection extends StatelessWidget {
  final FleetEntryModel entry;
  final String Function(String?) fmtTime;
  const _MetaSection({required this.entry, required this.fmtTime});

  @override
  Widget build(BuildContext context) {
    final routeName = entry.routeName;
    final km = entry.distanceMeters == null
        ? null
        : (entry.distanceMeters! / 1000.0);
    final compliance = entry.routeCompliancePercentage;
    final captureStatus = entry.capture?['status'] as String?;

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        border: Border.all(color: AppColors.ink2),
        borderRadius: BorderRadius.circular(14),
      ),
      child: Column(children: [
        _MetaRow(
          icon: Icons.route_outlined,
          label: 'Ruta',
          value: routeName ?? 'Sin asignar',
          valueColor: routeName == null ? AppColors.ink5 : AppColors.ink9,
        ),
        const _Divider(),
        _MetaRow(
          icon: Icons.flight_takeoff_outlined,
          label: 'Salida',
          value: fmtTime(entry.departureTime),
        ),
        const _Divider(),
        _MetaRow(
          icon: Icons.flight_land_outlined,
          label: 'Retorno',
          value: fmtTime(entry.returnTime),
        ),
        if (km != null) ...[
          const _Divider(),
          _MetaRow(
            icon: Icons.straighten_outlined,
            label: 'Kilometraje',
            value: '${km.toStringAsFixed(km >= 10 ? 0 : 1)} km',
          ),
        ],
        if (compliance != null) ...[
          const _Divider(),
          _MetaRow(
            icon: Icons.check_circle_outline,
            label: 'Cumplimiento ruta',
            value: '${compliance.toStringAsFixed(0)}%',
            valueColor: compliance >= 80
                ? AppColors.apto
                : compliance >= 60
                    ? AppColors.riesgo
                    : AppColors.noApto,
          ),
        ],
        if (captureStatus != null) ...[
          const _Divider(),
          _MetaRow(
            icon: Icons.gps_fixed,
            label: 'Captura GPS',
            value: _captureStatusLabel(captureStatus),
          ),
        ],
      ]),
    );
  }
}

class _MetaRow extends StatelessWidget {
  final IconData icon;
  final String label;
  final String value;
  final Color? valueColor;
  const _MetaRow({
    required this.icon,
    required this.label,
    required this.value,
    this.valueColor,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 10),
      child: Row(children: [
        Icon(icon, size: 16, color: AppColors.ink5),
        const SizedBox(width: 10),
        Expanded(
          child: Text(
            label,
            style: AppTheme.inter(fontSize: 12.5, color: AppColors.ink6),
          ),
        ),
        Flexible(
          child: Text(
            value,
            textAlign: TextAlign.right,
            style: AppTheme.inter(
              fontSize: 13,
              fontWeight: FontWeight.w700,
              color: valueColor ?? AppColors.ink9,
              tabular: true,
            ),
          ),
        ),
      ]),
    );
  }
}

class _Divider extends StatelessWidget {
  const _Divider();
  @override
  Widget build(BuildContext context) =>
      const Divider(height: 1, color: AppColors.ink1);
}

// ── Observaciones ──────────────────────────────────────────────────────

class _ObservationsCard extends StatelessWidget {
  final String text;
  const _ObservationsCard({required this.text});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.ink1,
        border: Border.all(color: AppColors.ink2),
        borderRadius: BorderRadius.circular(14),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(children: [
            const Icon(Icons.notes_outlined, size: 14, color: AppColors.ink6),
            const SizedBox(width: 6),
            Text(
              'OBSERVACIONES',
              style: AppTheme.inter(
                fontSize: 10,
                fontWeight: FontWeight.w800,
                color: AppColors.ink6,
                letterSpacing: 1.2,
              ),
            ),
          ]),
          const SizedBox(height: 8),
          Text(
            text,
            style: AppTheme.inter(
              fontSize: 13,
              color: AppColors.ink8,
              height: 1.45,
            ),
          ),
        ],
      ),
    );
  }
}

// ── Mini-mapa del track ────────────────────────────────────────────────

class _TrackPreview extends StatelessWidget {
  final List<LatLng> points;
  final String status;
  const _TrackPreview({required this.points, required this.status});

  @override
  Widget build(BuildContext context) {
    if (points.length < 2) {
      final isActive = status == 'en_ruta';
      return Container(
        padding: const EdgeInsets.all(18),
        decoration: BoxDecoration(
          color: Colors.white,
          border: Border.all(color: AppColors.ink2),
          borderRadius: BorderRadius.circular(14),
        ),
        child: Column(children: [
          Icon(
            isActive ? Icons.satellite_alt_outlined : Icons.map_outlined,
            size: 36,
            color: AppColors.ink4,
          ),
          const SizedBox(height: 10),
          Text(
            isActive ? 'Recolectando GPS…' : 'Sin trazo GPS suficiente',
            style: AppTheme.inter(
              fontSize: 13,
              fontWeight: FontWeight.w700,
              color: AppColors.ink7,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            isActive
                ? 'El conductor aún está en ruta. El recorrido completo aparecerá al cerrar el turno.'
                : 'Esta entrada no registró suficientes puntos GPS para dibujar el recorrido.',
            textAlign: TextAlign.center,
            style: AppTheme.inter(
              fontSize: 11.5,
              color: AppColors.ink5,
              height: 1.4,
            ),
          ),
        ]),
      );
    }

    final bounds = LatLngBounds.fromPoints(points);
    return ClipRRect(
      borderRadius: BorderRadius.circular(14),
      child: SizedBox(
        height: 240,
        child: FlutterMap(
          options: MapOptions(
            initialCameraFit: CameraFit.bounds(
              bounds: bounds,
              padding: const EdgeInsets.all(24),
            ),
            interactionOptions: const InteractionOptions(
              flags: InteractiveFlag.pinchZoom | InteractiveFlag.drag,
            ),
          ),
          children: [
            sfitCartoVoyagerTile(),
            PolylineLayer(polylines: [
              Polyline(
                points: points,
                color: AppColors.primary,
                strokeWidth: 4,
              ),
            ]),
            MarkerLayer(markers: [
              Marker(
                point: points.first,
                width: 18,
                height: 18,
                child: Container(
                  decoration: BoxDecoration(
                    color: AppColors.apto,
                    shape: BoxShape.circle,
                    border: Border.all(color: Colors.white, width: 2.5),
                  ),
                ),
              ),
              Marker(
                point: points.last,
                width: 18,
                height: 18,
                child: Container(
                  decoration: BoxDecoration(
                    color: AppColors.noApto,
                    shape: BoxShape.circle,
                    border: Border.all(color: Colors.white, width: 2.5),
                  ),
                ),
              ),
            ]),
          ],
        ),
      ),
    );
  }
}

// ── Helpers de estado ──────────────────────────────────────────────────

class _StatusInfo {
  final String label;
  final Color fg;
  final Color bg;
  final Color border;
  const _StatusInfo({
    required this.label,
    required this.fg,
    required this.bg,
    required this.border,
  });
}

_StatusInfo _statusInfo(String s) => switch (s) {
      'en_ruta' => const _StatusInfo(
          label: 'EN RUTA',
          fg: AppColors.riesgo,
          bg: AppColors.riesgoBg,
          border: AppColors.riesgoBorder,
        ),
      'cerrado' => const _StatusInfo(
          label: 'CERRADO',
          fg: AppColors.apto,
          bg: AppColors.aptoBg,
          border: AppColors.aptoBorder,
        ),
      'auto_cierre' => const _StatusInfo(
          label: 'AUTO-CIERRE',
          fg: AppColors.ink6,
          bg: AppColors.ink1,
          border: AppColors.ink2,
        ),
      'mantenimiento' => const _StatusInfo(
          label: 'MANTENIMIENTO',
          fg: AppColors.info,
          bg: AppColors.infoBg,
          border: AppColors.infoBorder,
        ),
      'fuera_de_servicio' => const _StatusInfo(
          label: 'FUERA DE SERVICIO',
          fg: AppColors.noApto,
          bg: AppColors.noAptoBg,
          border: AppColors.noAptoBorder,
        ),
      _ => _StatusInfo(
          label: s.toUpperCase(),
          fg: AppColors.ink6,
          bg: AppColors.ink1,
          border: AppColors.ink2,
        ),
    };

class _DriverStatusInfo {
  final String label;
  final Color fg;
  const _DriverStatusInfo({required this.label, required this.fg});
}

_DriverStatusInfo _driverStatusInfo(String s) => switch (s) {
      'riesgo' =>
        const _DriverStatusInfo(label: 'En riesgo', fg: AppColors.riesgo),
      'no_apto' =>
        const _DriverStatusInfo(label: 'No apto', fg: AppColors.noApto),
      _ => const _DriverStatusInfo(label: 'Apto', fg: AppColors.apto),
    };

String _captureStatusLabel(String s) => switch (s) {
      'validated' => 'Validada',
      'merged' => 'Fusionada',
      'rejected' => 'Rechazada',
      'candidate' => 'Candidata',
      'raw' => 'Sin procesar',
      _ => s,
    };

class _ErrorView extends StatelessWidget {
  final VoidCallback onRetry;
  const _ErrorView({required this.onRetry});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.error_outline, size: 40, color: AppColors.ink4),
            const SizedBox(height: 12),
            Text(
              'No se pudo cargar el detalle',
              style: AppTheme.inter(
                fontSize: 14,
                fontWeight: FontWeight.w700,
                color: AppColors.ink8,
              ),
            ),
            const SizedBox(height: 14),
            FilledButton.icon(
              onPressed: onRetry,
              icon: const Icon(Icons.refresh, size: 16),
              label: const Text('Reintentar'),
              style: FilledButton.styleFrom(
                backgroundColor: AppColors.primary,
                foregroundColor: Colors.white,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
