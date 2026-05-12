import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../fleet/data/datasources/fleet_api_service.dart';
import '../../data/datasources/operator_api_service.dart';

/// Crea un viaje (Trip) en curso desde la app móvil — RF-09 mobile.
///
/// Reemplaza al snackbar "Crea desde el panel web" del FAB de
/// `OperatorTripsPage`. Operativamente equivale al endpoint POST /viajes:
/// el operador elige vehículo + conductor (+ ruta opcional + hora de
/// salida) y se persiste como Trip `en_curso`.
class NuevoViajePage extends ConsumerStatefulWidget {
  const NuevoViajePage({super.key});

  @override
  ConsumerState<NuevoViajePage> createState() => _NuevoViajePageState();
}

class _NuevoViajePageState extends ConsumerState<NuevoViajePage> {
  List<Map<String, dynamic>> _vehicles = [];
  List<Map<String, dynamic>> _drivers = [];
  // Rutas mapeadas a {id, code, name} para mostrar dropdown legible.
  List<Map<String, String>> _routes = [];
  bool _loading = true;
  bool _submitting = false;
  String? _error;

  Map<String, dynamic>? _vehicle;
  Map<String, dynamic>? _driver;
  Map<String, String>? _route;
  DateTime? _startTime;

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  Future<void> _loadData() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final fleet = ref.read(fleetApiServiceProvider);
      final op = ref.read(operatorApiServiceProvider);
      final results = await Future.wait([
        fleet.getAvailableVehicles(),
        fleet.getAptDrivers(),
        op.getRoutes(limit: 100),
      ]);
      if (!mounted) return;
      setState(() {
        _vehicles = results[0] as List<Map<String, dynamic>>;
        _drivers = results[1] as List<Map<String, dynamic>>;
        _routes = (results[2] as List)
            .map<Map<String, String>>((r) => <String, String>{
                  'id': (r.id ?? '') as String,
                  'code': (r.code ?? '') as String,
                  'name': (r.name ?? 'Ruta') as String,
                })
            .where((m) => (m['id'] ?? '').isNotEmpty)
            .toList();
        _loading = false;
      });
    } catch (_) {
      if (mounted) {
        setState(() {
          _loading = false;
          _error = 'No se pudieron cargar los recursos.';
        });
      }
    }
  }

  Future<void> _pickStartTime() async {
    final now = DateTime.now();
    final picked = await showDatePicker(
      context: context,
      initialDate: _startTime ?? now,
      firstDate: now.subtract(const Duration(hours: 6)),
      lastDate: now.add(const Duration(days: 30)),
    );
    if (picked == null || !mounted) return;
    final time = await showTimePicker(
      context: context,
      initialTime: TimeOfDay.fromDateTime(_startTime ?? now),
    );
    if (time == null || !mounted) return;
    setState(() {
      _startTime = DateTime(
        picked.year,
        picked.month,
        picked.day,
        time.hour,
        time.minute,
      );
    });
  }

  Future<void> _submit() async {
    if (_vehicle == null || _driver == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Selecciona vehículo y conductor.')),
      );
      return;
    }
    setState(() => _submitting = true);
    try {
      final svc = ref.read(operatorApiServiceProvider);
      await svc.createTrip(
        vehicleId: _vehicle!['id'] as String? ??
            _vehicle!['_id'] as String,
        driverId: _driver!['id'] as String? ?? _driver!['_id'] as String,
        routeId: _route?['id'],
        startTime: _startTime,
      );
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Viaje creado.'),
          backgroundColor: AppColors.apto,
        ),
      );
      // Invalidar listados ahora obsoletos.
      ref.invalidate(operadorTripsProvider);
      Navigator.pop(context, true);
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Error al crear viaje.'),
            backgroundColor: AppColors.noApto,
          ),
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
        backgroundColor: Colors.white,
        elevation: 0,
        surfaceTintColor: Colors.transparent,
        title: Text(
          'Nuevo viaje',
          style: AppTheme.inter(
            fontSize: 16,
            fontWeight: FontWeight.w700,
            color: AppColors.ink9,
          ),
        ),
        iconTheme: const IconThemeData(color: AppColors.ink9),
      ),
      body: _loading
          ? const Center(
              child: CircularProgressIndicator(color: AppColors.primary),
            )
          : _error != null
              ? Center(
                  child: Padding(
                    padding: const EdgeInsets.all(24),
                    child: Column(mainAxisSize: MainAxisSize.min, children: [
                      const Icon(
                        Icons.error_outline,
                        size: 36,
                        color: AppColors.ink4,
                      ),
                      const SizedBox(height: 10),
                      Text(_error!,
                          style: AppTheme.inter(color: AppColors.ink7)),
                      const SizedBox(height: 12),
                      FilledButton(
                        onPressed: _loadData,
                        style: FilledButton.styleFrom(
                          backgroundColor: AppColors.primary,
                        ),
                        child: const Text('Reintentar'),
                      ),
                    ]),
                  ),
                )
              : SingleChildScrollView(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      const _SectionLabel(label: 'VEHÍCULO'),
                      const SizedBox(height: 8),
                      _DropdownCard<Map<String, dynamic>>(
                        hint: 'Seleccionar vehículo',
                        value: _vehicle,
                        items: _vehicles,
                        labelBuilder: (v) =>
                            '${v['plate']} — ${v['brand']} ${v['model']}',
                        onChanged: (v) => setState(() => _vehicle = v),
                      ),
                      const SizedBox(height: 16),
                      const _SectionLabel(label: 'CONDUCTOR'),
                      const SizedBox(height: 8),
                      _DropdownCard<Map<String, dynamic>>(
                        hint: 'Seleccionar conductor',
                        value: _driver,
                        items: _drivers,
                        labelBuilder: (d) => d['name'] as String? ?? '—',
                        onChanged: (d) => setState(() => _driver = d),
                      ),
                      const SizedBox(height: 16),
                      const _SectionLabel(label: 'RUTA (OPCIONAL)'),
                      const SizedBox(height: 8),
                      _DropdownCard<Map<String, String>>(
                        hint: 'Seleccionar ruta',
                        value: _route,
                        items: _routes,
                        labelBuilder: (r) {
                          final code = r['code'] ?? '';
                          final name = r['name'] ?? 'Ruta';
                          return code.isEmpty ? name : '$code · $name';
                        },
                        onChanged: (r) => setState(() => _route = r),
                      ),
                      const SizedBox(height: 16),
                      const _SectionLabel(label: 'HORA DE SALIDA'),
                      const SizedBox(height: 8),
                      InkWell(
                        onTap: _pickStartTime,
                        borderRadius: BorderRadius.circular(8),
                        child: Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 12,
                            vertical: 14,
                          ),
                          decoration: BoxDecoration(
                            color: Colors.white,
                            border: Border.all(color: AppColors.ink2),
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: Row(children: [
                            const Icon(
                              Icons.schedule,
                              size: 16,
                              color: AppColors.ink5,
                            ),
                            const SizedBox(width: 10),
                            Expanded(
                              child: Text(
                                _startTime == null
                                    ? 'Ahora (por defecto)'
                                    : DateFormat('dd MMM yyyy · HH:mm', 'es')
                                        .format(_startTime!),
                                style: AppTheme.inter(
                                  fontSize: 13,
                                  color: _startTime == null
                                      ? AppColors.ink4
                                      : AppColors.ink8,
                                ),
                              ),
                            ),
                            if (_startTime != null)
                              IconButton(
                                tooltip: 'Limpiar',
                                visualDensity: VisualDensity.compact,
                                icon: const Icon(
                                  Icons.close,
                                  size: 16,
                                  color: AppColors.ink5,
                                ),
                                onPressed: () =>
                                    setState(() => _startTime = null),
                              ),
                          ]),
                        ),
                      ),
                      const SizedBox(height: 28),
                      FilledButton(
                        onPressed: _submitting ? null : _submit,
                        style: FilledButton.styleFrom(
                          backgroundColor: AppColors.primary,
                          minimumSize: const Size(double.infinity, 48),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(10),
                          ),
                        ),
                        child: _submitting
                            ? const SizedBox(
                                width: 20,
                                height: 20,
                                child: CircularProgressIndicator(
                                  color: Colors.white,
                                  strokeWidth: 2,
                                ),
                              )
                            : Text(
                                'Crear viaje',
                                style: AppTheme.inter(
                                  fontSize: 15,
                                  fontWeight: FontWeight.w700,
                                  color: Colors.white,
                                ),
                              ),
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
          fontSize: 11,
          fontWeight: FontWeight.w700,
          color: AppColors.ink5,
          letterSpacing: 1.0,
        ),
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
          hint: Text(
            hint,
            style: AppTheme.inter(fontSize: 13, color: AppColors.ink4),
          ),
          isExpanded: true,
          icon: const Icon(Icons.expand_more, color: AppColors.ink4),
          items: items
              .map(
                (item) => DropdownMenuItem<T>(
                  value: item,
                  child: Text(
                    labelBuilder(item),
                    style: AppTheme.inter(
                      fontSize: 13,
                      color: AppColors.ink8,
                    ),
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
              )
              .toList(),
          onChanged: onChanged,
        ),
      ),
    );
  }
}
