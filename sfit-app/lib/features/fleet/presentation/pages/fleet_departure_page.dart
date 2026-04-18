import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_theme.dart';
import '../../data/datasources/fleet_api_service.dart';

/// Formulario de registro de salida de flota — RF-07-02.
class FleetDeparturePage extends ConsumerStatefulWidget {
  const FleetDeparturePage({super.key});

  @override
  ConsumerState<FleetDeparturePage> createState() => _FleetDeparturePageState();
}

class _FleetDeparturePageState extends ConsumerState<FleetDeparturePage> {
  List<Map<String, dynamic>> _vehicles = [];
  List<Map<String, dynamic>> _drivers  = [];
  bool _loading = true;
  bool _submitting = false;

  Map<String, dynamic>? _selectedVehicle;
  Map<String, dynamic>? _selectedDriver;
  final _obsCtrl = TextEditingController();

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  @override
  void dispose() {
    _obsCtrl.dispose();
    super.dispose();
  }

  Future<void> _loadData() async {
    try {
      final svc = ref.read(fleetApiServiceProvider);
      final results = await Future.wait([
        svc.getAvailableVehicles(),
        svc.getAptDrivers(),
      ]);
      if (mounted) {
        setState(() {
          _vehicles = results[0];
          _drivers  = results[1];
          _loading  = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _submit() async {
    if (_selectedVehicle == null || _selectedDriver == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Selecciona vehículo y conductor.')),
      );
      return;
    }

    setState(() => _submitting = true);
    try {
      final svc = ref.read(fleetApiServiceProvider);
      await svc.registerDeparture(
        vehicleId: _selectedVehicle!['id'] as String? ?? _selectedVehicle!['_id'] as String,
        driverId: _selectedDriver!['id'] as String? ?? _selectedDriver!['_id'] as String,
        observations: _obsCtrl.text.trim(),
      );
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Salida registrada correctamente.'),
              backgroundColor: AppColors.apto),
        );
        Navigator.pop(context, true);
      }
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Error al registrar la salida.'),
              backgroundColor: AppColors.noApto),
        );
      }
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.paper,
      appBar: AppBar(
        title: Text('Registrar salida',
            style: AppTheme.inter(fontSize: 15, fontWeight: FontWeight.w700)),
        backgroundColor: AppColors.panel,
        foregroundColor: Colors.white,
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator(color: AppColors.gold))
          : SingleChildScrollView(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  // ── Selección de vehículo ─────────────────────
                  const _SectionLabel(label: 'Vehículo disponible'),
                  const SizedBox(height: 8),
                  if (_vehicles.isEmpty)
                    const _NoData(message: 'Sin vehículos disponibles.')
                  else
                    _DropdownCard<Map<String, dynamic>>(
                      hint: 'Seleccionar vehículo',
                      value: _selectedVehicle,
                      items: _vehicles,
                      labelBuilder: (v) => '${v['plate']} — ${v['brand']} ${v['model']}',
                      onChanged: (v) => setState(() => _selectedVehicle = v),
                    ),

                  const SizedBox(height: 16),

                  // ── Selección de conductor ────────────────────
                  const _SectionLabel(label: 'Conductor apto'),
                  const SizedBox(height: 8),
                  if (_drivers.isEmpty)
                    const _NoData(message: 'Sin conductores aptos disponibles.')
                  else
                    _DropdownCard<Map<String, dynamic>>(
                      hint: 'Seleccionar conductor',
                      value: _selectedDriver,
                      items: _drivers,
                      labelBuilder: (d) => d['name'] as String,
                      onChanged: (d) => setState(() => _selectedDriver = d),
                    ),

                  const SizedBox(height: 16),

                  // ── Observaciones ─────────────────────────────
                  const _SectionLabel(label: 'Observaciones (opcional)'),
                  const SizedBox(height: 8),
                  TextField(
                    controller: _obsCtrl,
                    maxLines: 2,
                    decoration: InputDecoration(
                      hintText: 'Novedades al momento de la salida...',
                      hintStyle: AppTheme.inter(fontSize: 13, color: AppColors.ink4),
                      border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(8)),
                      enabledBorder: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(8),
                          borderSide: const BorderSide(color: AppColors.ink2)),
                      contentPadding: const EdgeInsets.symmetric(
                          horizontal: 12, vertical: 10),
                    ),
                    style: AppTheme.inter(fontSize: 13, color: AppColors.ink8),
                  ),

                  const SizedBox(height: 24),

                  FilledButton(
                    onPressed: _submitting ? null : _submit,
                    style: FilledButton.styleFrom(
                      backgroundColor: AppColors.panel,
                      minimumSize: const Size(double.infinity, 48),
                      shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(10)),
                    ),
                    child: _submitting
                        ? const SizedBox(
                            width: 20,
                            height: 20,
                            child: CircularProgressIndicator(
                                color: Colors.white, strokeWidth: 2))
                        : Text('Confirmar salida',
                            style: AppTheme.inter(
                              fontSize: 15,
                              fontWeight: FontWeight.w700,
                              color: Colors.white,
                            )),
                  ),
                ],
              ),
            ),
    );
  }
}

class _SectionLabel extends StatelessWidget {
  final String label;
  const _SectionLabel({required this.label});

  @override
  Widget build(BuildContext context) => Text(
        label,
        style: AppTheme.inter(
            fontSize: 12, fontWeight: FontWeight.w600,
            color: AppColors.ink5, letterSpacing: 0.5),
      );
}

class _DropdownCard<T> extends StatelessWidget {
  final String hint;
  final T? value;
  final List<T> items;
  final String Function(T) labelBuilder;
  final ValueChanged<T?> onChanged;

  const _DropdownCard({
    required this.hint,
    required this.value,
    required this.items,
    required this.labelBuilder,
    required this.onChanged,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12),
      decoration: BoxDecoration(
        color: Colors.white,
        border: Border.all(color: AppColors.ink2),
        borderRadius: BorderRadius.circular(8),
      ),
      child: DropdownButtonHideUnderline(
        child: DropdownButton<T>(
          value: value,
          hint: Text(hint,
              style: AppTheme.inter(fontSize: 13, color: AppColors.ink4)),
          isExpanded: true,
          icon: const Icon(Icons.expand_more, color: AppColors.ink4),
          items: items.map((item) => DropdownMenuItem<T>(
            value: item,
            child: Text(labelBuilder(item),
                style: AppTheme.inter(fontSize: 13, color: AppColors.ink8),
                overflow: TextOverflow.ellipsis),
          )).toList(),
          onChanged: onChanged,
        ),
      ),
    );
  }
}

class _NoData extends StatelessWidget {
  final String message;
  const _NoData({required this.message});

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: AppColors.riesgoBg,
          border: Border.all(color: AppColors.riesgoBorder),
          borderRadius: BorderRadius.circular(8),
        ),
        child: Row(
          children: [
            const Icon(Icons.warning_amber, size: 16, color: AppColors.riesgo),
            const SizedBox(width: 8),
            Text(message,
                style: AppTheme.inter(fontSize: 13, color: AppColors.riesgo)),
          ],
        ),
      );
}
