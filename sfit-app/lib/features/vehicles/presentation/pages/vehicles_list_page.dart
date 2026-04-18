import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_theme.dart';
import '../../data/datasources/vehicle_api_service.dart';

/// Tab de vehículos para el rol Operador — RF-06.
class VehiclesListPage extends ConsumerStatefulWidget {
  const VehiclesListPage({super.key});

  @override
  ConsumerState<VehiclesListPage> createState() => _VehiclesListPageState();
}

class _VehiclesListPageState extends ConsumerState<VehiclesListPage> {
  List<Map<String, dynamic>> _vehicles = [];
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() { _loading = true; _error = null; });
    try {
      final svc = ref.read(vehicleApiServiceProvider);
      final data = await svc.getVehicles();
      if (mounted) {
        setState(() {
          _vehicles = List<Map<String, dynamic>>.from(data['items'] as List);
          _loading = false;
        });
      }
    } catch (e) {
      if (mounted) setState(() { _loading = false; _error = e.toString(); });
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const Center(child: CircularProgressIndicator(color: AppColors.gold));
    }
    if (_error != null) {
      return Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.error_outline, color: AppColors.noApto, size: 32),
            const SizedBox(height: 8),
            Text('Error al cargar vehículos.',
                style: AppTheme.inter(fontSize: 14, color: AppColors.ink6)),
            const SizedBox(height: 12),
            TextButton(onPressed: _load, child: const Text('Reintentar')),
          ],
        ),
      );
    }
    if (_vehicles.isEmpty) {
      return Center(
        child: Text('Sin vehículos registrados.',
            style: AppTheme.inter(fontSize: 14, color: AppColors.ink4)),
      );
    }
    return RefreshIndicator(
      onRefresh: _load,
      color: AppColors.gold,
      child: ListView.separated(
        padding: const EdgeInsets.all(12),
        itemCount: _vehicles.length,
        separatorBuilder: (_, __) => const SizedBox(height: 8),
        itemBuilder: (_, i) => _VehicleCard(vehicle: _vehicles[i]),
      ),
    );
  }
}

class _VehicleCard extends StatelessWidget {
  final Map<String, dynamic> vehicle;
  const _VehicleCard({required this.vehicle});

  @override
  Widget build(BuildContext context) {
    final status = vehicle['status'] as String? ?? 'disponible';
    final rep = (vehicle['reputationScore'] as num?)?.toInt() ?? 100;
    final inspStatus = vehicle['lastInspectionStatus'] as String? ?? 'pendiente';

    final (statusColor, statusBg, statusLabel) = switch (status) {
      'disponible'       => (AppColors.apto,    AppColors.aptoBg,    'DISPONIBLE'),
      'en_ruta'          => (AppColors.goldDark, AppColors.goldBg,    'EN RUTA'),
      'en_mantenimiento' => (AppColors.riesgo,   AppColors.riesgoBg,  'MANTENIMIENTO'),
      'fuera_de_servicio' => (AppColors.noApto,  AppColors.noAptoBg,  'FUERA DE SERVICIO'),
      _                  => (AppColors.ink5,     AppColors.ink1,      status.toUpperCase()),
    };

    final (inspColor, inspLabel) = switch (inspStatus) {
      'aprobada'  => (AppColors.apto, 'Aprobada'),
      'observada' => (AppColors.riesgo, 'Observada'),
      'rechazada' => (AppColors.noApto, 'Rechazada'),
      _           => (AppColors.ink4, 'Pendiente'),
    };

    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.ink1),
      ),
      padding: const EdgeInsets.all(14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                decoration: BoxDecoration(
                  color: AppColors.panel,
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Text(
                  vehicle['plate'] as String? ?? '—',
                  style: AppTheme.inter(
                    fontSize: 14, fontWeight: FontWeight.w800,
                    color: Colors.white, letterSpacing: 1.5,
                  ),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  '${vehicle['brand'] ?? '—'} ${vehicle['model'] ?? ''} ${vehicle['year'] ?? ''}',
                  style: AppTheme.inter(
                    fontSize: 13, fontWeight: FontWeight.w600, color: AppColors.ink8),
                  overflow: TextOverflow.ellipsis,
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: statusBg,
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Text(statusLabel,
                    style: AppTheme.inter(
                      fontSize: 10, fontWeight: FontWeight.w700, color: statusColor)),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Row(children: [
            _Chip(
              label: _typeLabel(vehicle['vehicleTypeKey'] as String? ?? ''),
              color: AppColors.ink5,
            ),
            const SizedBox(width: 6),
            _Chip(
              label: 'Insp: $inspLabel',
              color: inspColor,
            ),
            const SizedBox(width: 6),
            _Chip(label: '⭐ $rep', color: AppColors.goldDark),
          ]),
        ],
      ),
    );
  }

  String _typeLabel(String key) => switch (key) {
        'transporte_publico'   => 'Transp. Público',
        'limpieza_residuos'    => 'Limpieza',
        'emergencia'           => 'Emergencia',
        'maquinaria'           => 'Maquinaria',
        'bus_interprovincial'  => 'Bus Interprov.',
        'municipal_general'    => 'Municipal',
        _                      => key,
      };
}

class _Chip extends StatelessWidget {
  final String label;
  final Color color;
  const _Chip({required this.label, required this.color});

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.08),
          borderRadius: BorderRadius.circular(4),
        ),
        child: Text(label,
            style: AppTheme.inter(
              fontSize: 11, color: color, fontWeight: FontWeight.w600)),
      );
}
