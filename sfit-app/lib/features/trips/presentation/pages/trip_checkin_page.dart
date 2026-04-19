import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_theme.dart';
import '../../data/datasources/trips_api_service.dart';
import '../../../fleet/data/datasources/fleet_api_service.dart';

/// Wizard de 2 pasos para iniciar un turno (RF-conductor).
///
/// Paso 1: Selector de vehículo + hora de salida estimada.
/// Paso 2: Checklist de pre-viaje (5 ítems).
class TripCheckinPage extends ConsumerStatefulWidget {
  const TripCheckinPage({super.key});

  @override
  ConsumerState<TripCheckinPage> createState() => _TripCheckinPageState();
}

class _TripCheckinPageState extends ConsumerState<TripCheckinPage> {
  final PageController _pageController = PageController();
  int _step = 0;

  // ── Paso 1 ────────────────────────────────────────────────────────────────
  List<Map<String, dynamic>> _vehicles = [];
  bool _vehiclesLoading = true;
  String? _vehiclesError;
  String? _selectedVehicleId;
  String _selectedVehiclePlate = '';
  DateTime _departureTime = DateTime.now();

  // ── Paso 2 — Checklist ────────────────────────────────────────────────────
  final Map<String, bool> _checklist = {
    'combustible': false,
    'luces': false,
    'frenos': false,
    'documentos': false,
    'extintor': false,
  };
  final Map<String, String> _checklistLabels = {
    'combustible': 'Nivel de combustible OK',
    'luces': 'Luces funcionando',
    'frenos': 'Frenos en buen estado',
    'documentos': 'Documentos del vehículo al día',
    'extintor': 'Extintor vigente y accesible',
  };
  final Map<String, IconData> _checklistIcons = {
    'combustible': Icons.local_gas_station_outlined,
    'luces': Icons.lightbulb_outlined,
    'frenos': Icons.disc_full_outlined,
    'documentos': Icons.description_outlined,
    'extintor': Icons.fire_extinguisher_outlined,
  };

  bool _submitting = false;

  @override
  void initState() {
    super.initState();
    _loadVehicles();
  }

  @override
  void dispose() {
    _pageController.dispose();
    super.dispose();
  }

  Future<void> _loadVehicles() async {
    setState(() {
      _vehiclesLoading = true;
      _vehiclesError = null;
    });
    try {
      final svc = ref.read(fleetApiServiceProvider);
      final items = await svc.getAvailableVehicles();
      if (mounted) {
        setState(() {
          _vehicles = items;
          _vehiclesLoading = false;
        });
      }
    } catch (_) {
      if (mounted) {
        setState(() {
          _vehiclesError = 'No se pudieron cargar los vehículos.';
          _vehiclesLoading = false;
        });
      }
    }
  }

  bool get _checklistComplete => _checklist.values.every((v) => v);

  Future<void> _pickDepartureTime() async {
    final now = DateTime.now();
    final picked = await showTimePicker(
      context: context,
      initialTime: TimeOfDay.fromDateTime(_departureTime),
      builder: (ctx, child) => Theme(
        data: Theme.of(ctx).copyWith(
          colorScheme: const ColorScheme.light(primary: AppColors.gold),
        ),
        child: child!,
      ),
    );
    if (picked != null && mounted) {
      setState(() {
        _departureTime = DateTime(
          now.year, now.month, now.day, picked.hour, picked.minute,
        );
      });
    }
  }

  void _goToStep2() {
    if (_selectedVehicleId == null) {
      _showSnack('Selecciona un vehículo para continuar');
      return;
    }
    _pageController.nextPage(
      duration: const Duration(milliseconds: 280),
      curve: Curves.easeInOut,
    );
    setState(() => _step = 1);
  }

  Future<void> _iniciarTurno() async {
    if (!_checklistComplete) {
      _showSnack('Completa todos los ítems del checklist');
      return;
    }
    setState(() => _submitting = true);
    try {
      final svc = ref.read(tripsApiServiceProvider);
      await svc.startTrip(
        vehicleId: _selectedVehicleId!,
        departureTime: _departureTime,
        checklistComplete: true,
      );
      if (mounted) {
        context.go('/home');
      }
    } catch (e) {
      if (mounted) {
        _showSnack('Error al iniciar turno: ${_extractError(e)}');
      }
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  String _extractError(Object e) {
    final msg = e.toString();
    // Intenta extraer el mensaje de error de Dio
    final match = RegExp(r'"error"\s*:\s*"([^"]+)"').firstMatch(msg);
    return match?.group(1) ?? msg;
  }

  void _showSnack(String msg) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(msg),
        behavior: SnackBarBehavior.floating,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.paper,
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        surfaceTintColor: Colors.transparent,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: AppColors.ink9),
          onPressed: () {
            if (_step == 1) {
              _pageController.previousPage(
                duration: const Duration(milliseconds: 280),
                curve: Curves.easeInOut,
              );
              setState(() => _step = 0);
            } else {
              context.pop();
            }
          },
        ),
        title: Text(
          'Iniciar turno',
          style: AppTheme.inter(
            fontSize: 16,
            fontWeight: FontWeight.w700,
            color: AppColors.ink9,
          ),
        ),
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(4),
          child: _StepIndicator(step: _step, total: 2),
        ),
      ),
      body: PageView(
        controller: _pageController,
        physics: const NeverScrollableScrollPhysics(),
        children: [
          _Step1(
            vehicles: _vehicles,
            loading: _vehiclesLoading,
            error: _vehiclesError,
            selectedVehicleId: _selectedVehicleId,
            departureTime: _departureTime,
            onRetry: _loadVehicles,
            onVehicleSelected: (id, plate) => setState(() {
              _selectedVehicleId = id;
              _selectedVehiclePlate = plate;
            }),
            onPickTime: _pickDepartureTime,
            onNext: _goToStep2,
          ),
          _Step2(
            checklist: _checklist,
            checklistLabels: _checklistLabels,
            checklistIcons: _checklistIcons,
            vehiclePlate: _selectedVehiclePlate,
            departureTime: _departureTime,
            submitting: _submitting,
            onToggle: (key) => setState(() => _checklist[key] = !_checklist[key]!),
            onSubmit: _iniciarTurno,
          ),
        ],
      ),
    );
  }
}

// ── Indicador de paso ─────────────────────────────────────────────────────────
class _StepIndicator extends StatelessWidget {
  final int step;
  final int total;
  const _StepIndicator({required this.step, required this.total});

  @override
  Widget build(BuildContext context) {
    return Row(
      children: List.generate(total, (i) {
        final active = i <= step;
        return Expanded(
          child: Container(
            height: 4,
            margin: const EdgeInsets.only(right: 1),
            color: active ? AppColors.gold : AppColors.ink2,
          ),
        );
      }),
    );
  }
}

// ── Paso 1: Selector de vehículo ──────────────────────────────────────────────
class _Step1 extends StatelessWidget {
  final List<Map<String, dynamic>> vehicles;
  final bool loading;
  final String? error;
  final String? selectedVehicleId;
  final DateTime departureTime;
  final VoidCallback onRetry;
  final void Function(String id, String plate) onVehicleSelected;
  final VoidCallback onPickTime;
  final VoidCallback onNext;

  const _Step1({
    required this.vehicles,
    required this.loading,
    required this.error,
    required this.selectedVehicleId,
    required this.departureTime,
    required this.onRetry,
    required this.onVehicleSelected,
    required this.onPickTime,
    required this.onNext,
  });

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(16, 20, 16, 24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Encabezado del paso
          _SectionHeader(
            step: 1,
            title: 'Vehículo y hora de salida',
            subtitle: 'Selecciona el vehículo asignado y confirma la hora estimada de salida.',
          ),
          const SizedBox(height: 20),

          // Selector de vehículo
          Text(
            'Vehículo',
            style: AppTheme.inter(
              fontSize: 13,
              fontWeight: FontWeight.w600,
              color: AppColors.ink7,
            ),
          ),
          const SizedBox(height: 8),
          if (loading)
            const Center(
              child: Padding(
                padding: EdgeInsets.all(24),
                child: CircularProgressIndicator(color: AppColors.gold),
              ),
            )
          else if (error != null)
            _ErrorRetry(message: error!, onRetry: onRetry)
          else if (vehicles.isEmpty)
            _InfoCard(
              icon: Icons.directions_car_outlined,
              message: 'No hay vehículos disponibles en este momento.',
            )
          else
            ...vehicles.map((v) {
              final id = v['_id'] as String? ?? v['id'] as String? ?? '';
              final plate = v['plate'] as String? ?? '—';
              final brand = v['brand'] as String? ?? '';
              final model = v['model'] as String? ?? '';
              final selected = selectedVehicleId == id;
              return _VehicleCard(
                id: id,
                plate: plate,
                label: '$brand $model'.trim(),
                selected: selected,
                onTap: () => onVehicleSelected(id, plate),
              );
            }),

          const SizedBox(height: 20),

          // Hora de salida
          Text(
            'Hora de salida estimada',
            style: AppTheme.inter(
              fontSize: 13,
              fontWeight: FontWeight.w600,
              color: AppColors.ink7,
            ),
          ),
          const SizedBox(height: 8),
          GestureDetector(
            onTap: onPickTime,
            child: Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: Colors.white,
                border: Border.all(color: AppColors.ink2),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Row(
                children: [
                  const Icon(Icons.access_time, color: AppColors.gold, size: 20),
                  const SizedBox(width: 10),
                  Text(
                    _formatTime(departureTime),
                    style: AppTheme.inter(
                      fontSize: 15,
                      fontWeight: FontWeight.w600,
                      color: AppColors.ink9,
                    ),
                  ),
                  const Spacer(),
                  Text(
                    'Cambiar',
                    style: AppTheme.inter(
                      fontSize: 13,
                      color: AppColors.gold,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ],
              ),
            ),
          ),

          const SizedBox(height: 28),

          FilledButton(
            onPressed: onNext,
            style: FilledButton.styleFrom(
              backgroundColor: AppColors.gold,
              foregroundColor: Colors.white,
              minimumSize: const Size(double.infinity, 50),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(10),
              ),
            ),
            child: Text(
              'Continuar',
              style: AppTheme.inter(
                fontSize: 15,
                fontWeight: FontWeight.w700,
                color: Colors.white,
              ),
            ),
          ),
        ],
      ),
    );
  }

  String _formatTime(DateTime dt) {
    final h = dt.hour.toString().padLeft(2, '0');
    final m = dt.minute.toString().padLeft(2, '0');
    return '$h:$m';
  }
}

class _VehicleCard extends StatelessWidget {
  final String id;
  final String plate;
  final String label;
  final bool selected;
  final VoidCallback onTap;

  const _VehicleCard({
    required this.id,
    required this.plate,
    required this.label,
    required this.selected,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        margin: const EdgeInsets.only(bottom: 8),
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: selected ? AppColors.goldBg : Colors.white,
          border: Border.all(
            color: selected ? AppColors.gold : AppColors.ink2,
            width: selected ? 2 : 1,
          ),
          borderRadius: BorderRadius.circular(10),
        ),
        child: Row(
          children: [
            Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(
                color: selected ? AppColors.gold : AppColors.ink1,
                borderRadius: BorderRadius.circular(8),
              ),
              child: Icon(
                Icons.directions_car,
                color: selected ? Colors.white : AppColors.ink5,
                size: 20,
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    plate,
                    style: AppTheme.inter(
                      fontSize: 14,
                      fontWeight: FontWeight.w700,
                      color: AppColors.ink9,
                    ),
                  ),
                  if (label.isNotEmpty)
                    Text(
                      label,
                      style: AppTheme.inter(fontSize: 12, color: AppColors.ink5),
                    ),
                ],
              ),
            ),
            if (selected)
              const Icon(Icons.check_circle, color: AppColors.gold, size: 20),
          ],
        ),
      ),
    );
  }
}

// ── Paso 2: Checklist de pre-viaje ────────────────────────────────────────────
class _Step2 extends StatelessWidget {
  final Map<String, bool> checklist;
  final Map<String, String> checklistLabels;
  final Map<String, IconData> checklistIcons;
  final String vehiclePlate;
  final DateTime departureTime;
  final bool submitting;
  final void Function(String key) onToggle;
  final VoidCallback onSubmit;

  const _Step2({
    required this.checklist,
    required this.checklistLabels,
    required this.checklistIcons,
    required this.vehiclePlate,
    required this.departureTime,
    required this.submitting,
    required this.onToggle,
    required this.onSubmit,
  });

  bool get _allChecked => checklist.values.every((v) => v);

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(16, 20, 16, 24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          _SectionHeader(
            step: 2,
            title: 'Checklist pre-viaje',
            subtitle: 'Verifica cada ítem antes de iniciar el turno.',
          ),
          const SizedBox(height: 12),

          // Resumen del vehículo
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: AppColors.goldBg,
              border: Border.all(color: AppColors.goldBorder),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Row(
              children: [
                const Icon(Icons.directions_car, color: AppColors.goldDark, size: 18),
                const SizedBox(width: 8),
                Text(
                  vehiclePlate,
                  style: AppTheme.inter(
                    fontSize: 14,
                    fontWeight: FontWeight.w700,
                    color: AppColors.goldDark,
                  ),
                ),
                const Spacer(),
                const Icon(Icons.access_time, color: AppColors.goldDark, size: 16),
                const SizedBox(width: 4),
                Text(
                  _formatTime(departureTime),
                  style: AppTheme.inter(
                    fontSize: 13,
                    color: AppColors.goldDark,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),

          // Ítems del checklist
          ...checklist.entries.map((entry) {
            final key = entry.key;
            final value = entry.value;
            final label = checklistLabels[key] ?? key;
            final icon = checklistIcons[key] ?? Icons.check_outlined;
            return _ChecklistItem(
              icon: icon,
              label: label,
              checked: value,
              onToggle: () => onToggle(key),
            );
          }),

          const SizedBox(height: 8),

          // Progreso
          if (!_allChecked) ...[
            const SizedBox(height: 4),
            Text(
              '${checklist.values.where((v) => v).length} / ${checklist.length} ítems verificados',
              textAlign: TextAlign.center,
              style: AppTheme.inter(fontSize: 12, color: AppColors.ink5),
            ),
          ],

          const SizedBox(height: 20),

          FilledButton(
            onPressed: (_allChecked && !submitting) ? onSubmit : null,
            style: FilledButton.styleFrom(
              backgroundColor: AppColors.apto,
              disabledBackgroundColor: AppColors.ink2,
              foregroundColor: Colors.white,
              minimumSize: const Size(double.infinity, 50),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(10),
              ),
            ),
            child: submitting
                ? const SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(
                      color: Colors.white,
                      strokeWidth: 2,
                    ),
                  )
                : Text(
                    'Iniciar turno',
                    style: AppTheme.inter(
                      fontSize: 15,
                      fontWeight: FontWeight.w700,
                      color: Colors.white,
                    ),
                  ),
          ),
        ],
      ),
    );
  }

  String _formatTime(DateTime dt) {
    final h = dt.hour.toString().padLeft(2, '0');
    final m = dt.minute.toString().padLeft(2, '0');
    return '$h:$m';
  }
}

class _ChecklistItem extends StatelessWidget {
  final IconData icon;
  final String label;
  final bool checked;
  final VoidCallback onToggle;

  const _ChecklistItem({
    required this.icon,
    required this.label,
    required this.checked,
    required this.onToggle,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onToggle,
      child: Container(
        margin: const EdgeInsets.only(bottom: 8),
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: checked ? AppColors.aptoBg : Colors.white,
          border: Border.all(
            color: checked ? AppColors.aptoBorder : AppColors.ink2,
            width: checked ? 1.5 : 1,
          ),
          borderRadius: BorderRadius.circular(10),
        ),
        child: Row(
          children: [
            Icon(
              icon,
              size: 20,
              color: checked ? AppColors.apto : AppColors.ink5,
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Text(
                label,
                style: AppTheme.inter(
                  fontSize: 14,
                  fontWeight: FontWeight.w500,
                  color: checked ? AppColors.apto : AppColors.ink8,
                ),
              ),
            ),
            AnimatedSwitcher(
              duration: const Duration(milliseconds: 200),
              child: Icon(
                checked ? Icons.check_circle : Icons.radio_button_unchecked,
                key: ValueKey(checked),
                color: checked ? AppColors.apto : AppColors.ink3,
                size: 22,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ── Widgets auxiliares ────────────────────────────────────────────────────────
class _SectionHeader extends StatelessWidget {
  final int step;
  final String title;
  final String subtitle;

  const _SectionHeader({
    required this.step,
    required this.title,
    required this.subtitle,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'PASO $step DE 2',
          style: AppTheme.inter(
            fontSize: 11,
            fontWeight: FontWeight.w700,
            color: AppColors.gold,
            letterSpacing: 1.4,
          ),
        ),
        const SizedBox(height: 4),
        Text(
          title,
          style: AppTheme.inter(
            fontSize: 18,
            fontWeight: FontWeight.w800,
            color: AppColors.ink9,
          ),
        ),
        const SizedBox(height: 4),
        Text(
          subtitle,
          style: AppTheme.inter(fontSize: 13, color: AppColors.ink5),
        ),
      ],
    );
  }
}

class _InfoCard extends StatelessWidget {
  final IconData icon;
  final String message;
  const _InfoCard({required this.icon, required this.message});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: AppColors.ink1,
        borderRadius: BorderRadius.circular(10),
      ),
      child: Row(
        children: [
          Icon(icon, color: AppColors.ink4, size: 24),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              message,
              style: AppTheme.inter(fontSize: 13, color: AppColors.ink6),
            ),
          ),
        ],
      ),
    );
  }
}

class _ErrorRetry extends StatelessWidget {
  final String message;
  final VoidCallback onRetry;
  const _ErrorRetry({required this.message, required this.onRetry});

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Text(
          message,
          style: AppTheme.inter(fontSize: 13, color: AppColors.noApto),
        ),
        const SizedBox(height: 8),
        TextButton(
          onPressed: onRetry,
          child: const Text('Reintentar'),
        ),
      ],
    );
  }
}
