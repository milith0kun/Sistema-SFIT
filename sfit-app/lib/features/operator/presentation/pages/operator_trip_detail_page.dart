import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import '../../../../core/network/dio_client.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_theme.dart';

/// Detalle de un viaje del operador (RF-09 mobile).
class OperatorTripDetailPage extends ConsumerStatefulWidget {
  final String tripId;
  const OperatorTripDetailPage({super.key, required this.tripId});

  @override
  ConsumerState<OperatorTripDetailPage> createState() =>
      _OperatorTripDetailPageState();
}

class _OperatorTripDetailPageState
    extends ConsumerState<OperatorTripDetailPage>
    with SingleTickerProviderStateMixin {
  late final TabController _tabs;
  bool _loading = true;
  String? _error;
  Map<String, dynamic>? _trip;

  @override
  void initState() {
    super.initState();
    _tabs = TabController(length: 3, vsync: this);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) _load();
    });
  }

  @override
  void dispose() {
    _tabs.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final dio = ref.read(dioClientProvider).dio;
      final resp = await dio.get('/viajes/${widget.tripId}');
      final body = resp.data as Map?;
      final data = (body?['data'] as Map<String, dynamic>?) ??
          (body as Map<String, dynamic>?);
      if (mounted) {
        setState(() {
          _trip = data;
          _loading = false;
        });
      }
    } catch (_) {
      if (mounted) {
        setState(() {
          _error = 'No se pudo cargar el viaje.';
          _loading = false;
        });
      }
    }
  }

  String _routeName() {
    final t = _trip;
    if (t == null) return 'Viaje';
    final route = t['route'] as Map<String, dynamic>?;
    return (route?['name'] ?? t['routeName'] ?? 'Ruta').toString();
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
          'Viaje · ${_routeName()}',
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: AppTheme.inter(
            fontSize: 15,
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
          tabs: const [
            Tab(text: 'Info'),
            Tab(text: 'Pasajeros'),
            Tab(text: 'Manifiesto'),
          ],
        ),
      ),
      body: _loading
          ? const Center(
              child: CircularProgressIndicator(color: AppColors.primary),
            )
          : _error != null
              ? Center(
                  child: Column(mainAxisSize: MainAxisSize.min, children: [
                    Text(
                      _error!,
                      style: AppTheme.inter(fontSize: 13, color: AppColors.ink5),
                    ),
                    const SizedBox(height: 12),
                    FilledButton(
                      onPressed: _load,
                      child: const Text('Reintentar'),
                    ),
                  ]),
                )
              : TabBarView(
                  controller: _tabs,
                  children: [
                    _InfoTab(trip: _trip ?? const {}),
                    _PassengersTabBridge(tripId: widget.tripId),
                    _ManifestTabBridge(tripId: widget.tripId),
                  ],
                ),
    );
  }
}

class _InfoTab extends StatelessWidget {
  final Map<String, dynamic> trip;
  const _InfoTab({required this.trip});

  @override
  Widget build(BuildContext context) {
    final route = trip['route'] as Map<String, dynamic>?;
    final vehicle = trip['vehicle'] as Map<String, dynamic>?;
    final driver = trip['driver'] as Map<String, dynamic>?;
    final fmt = DateFormat('dd MMM yyyy · HH:mm', 'es');
    DateTime? parseDt(dynamic v) =>
        v is String ? DateTime.tryParse(v) : null;
    final dep = parseDt(trip['departureAt']) ?? parseDt(trip['scheduledAt']);
    final status = (trip['status'] ?? 'programado').toString();

    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
      children: [
        _InfoRow(
          icon: Icons.route_outlined,
          label: 'Ruta',
          value: (route?['name'] ?? trip['routeName'] ?? '—').toString(),
        ),
        _InfoRow(
          icon: Icons.directions_car_outlined,
          label: 'Vehículo',
          value: (vehicle?['plate'] ?? trip['vehiclePlate'] ?? '—').toString(),
        ),
        _InfoRow(
          icon: Icons.person_outline,
          label: 'Conductor',
          value: (driver?['name'] ?? trip['driverName'] ?? '—').toString(),
        ),
        _InfoRow(
          icon: Icons.schedule,
          label: 'Salida',
          value: dep != null ? fmt.format(dep.toLocal()) : '—',
        ),
        _InfoRow(
          icon: Icons.flag_outlined,
          label: 'Estado',
          value: status.toUpperCase(),
        ),
        if ((trip['observations'] ?? trip['notes']) != null)
          _InfoRow(
            icon: Icons.note_outlined,
            label: 'Observaciones',
            value: (trip['observations'] ?? trip['notes']).toString(),
          ),
      ],
    );
  }
}

class _InfoRow extends StatelessWidget {
  final IconData icon;
  final String label;
  final String value;
  const _InfoRow({
    required this.icon,
    required this.label,
    required this.value,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        border: Border.all(color: AppColors.ink2),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(children: [
        Container(
          width: 36,
          height: 36,
          decoration: BoxDecoration(
            color: AppColors.ink1,
            borderRadius: BorderRadius.circular(8),
          ),
          alignment: Alignment.center,
          child: Icon(icon, size: 18, color: AppColors.ink7),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                label,
                style: AppTheme.inter(
                  fontSize: 10.5,
                  fontWeight: FontWeight.w700,
                  color: AppColors.ink5,
                  letterSpacing: 0.8,
                ),
              ),
              const SizedBox(height: 2),
              Text(
                value,
                style: AppTheme.inter(
                  fontSize: 13.5,
                  fontWeight: FontWeight.w600,
                  color: AppColors.ink9,
                ),
              ),
            ],
          ),
        ),
      ]),
    );
  }
}

class _PassengersTabBridge extends StatelessWidget {
  final String tripId;
  const _PassengersTabBridge({required this.tripId});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          const Icon(
            Icons.groups_2_outlined,
            size: 40,
            color: AppColors.ink4,
          ),
          const SizedBox(height: 10),
          Text(
            'Lista de pasajeros',
            style: AppTheme.inter(
              fontSize: 14,
              fontWeight: FontWeight.w700,
              color: AppColors.ink8,
            ),
          ),
          const SizedBox(height: 14),
          FilledButton.icon(
            onPressed: () =>
                context.push('/operador/viajes/$tripId/pasajeros'),
            icon: const Icon(Icons.open_in_new, size: 16),
            label: const Text('Abrir pasajeros'),
            style: FilledButton.styleFrom(
              backgroundColor: AppColors.ink9,
              foregroundColor: Colors.white,
            ),
          ),
        ]),
      ),
    );
  }
}

class _ManifestTabBridge extends StatelessWidget {
  final String tripId;
  const _ManifestTabBridge({required this.tripId});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          const Icon(
            Icons.photo_camera_outlined,
            size: 40,
            color: AppColors.ink4,
          ),
          const SizedBox(height: 10),
          Text(
            'Manifiesto firmado',
            style: AppTheme.inter(
              fontSize: 14,
              fontWeight: FontWeight.w700,
              color: AppColors.ink8,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            'Sube la foto del manifiesto firmado por los pasajeros.',
            textAlign: TextAlign.center,
            style: AppTheme.inter(fontSize: 12, color: AppColors.ink5),
          ),
          const SizedBox(height: 14),
          FilledButton.icon(
            onPressed: () =>
                context.push('/operador/viajes/$tripId/manifiesto'),
            icon: const Icon(Icons.cloud_upload_outlined, size: 16),
            label: const Text('Subir manifiesto'),
            style: FilledButton.styleFrom(
              backgroundColor: AppColors.primary,
              foregroundColor: Colors.white,
            ),
          ),
        ]),
      ),
    );
  }
}
