import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:geolocator/geolocator.dart';
import 'package:go_router/go_router.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/services/location_tracking_service.dart';
import '../../data/datasources/trips_api_service.dart';
import '../../../fleet/data/datasources/fleet_api_service.dart';

/// Wizard de 2 pasos para iniciar un turno (RF-conductor).
///
/// Paso 1: Selector de vehículo + hora de salida estimada.
/// Paso 2: Checklist de pre-viaje (5 ítems).
class TripCheckinPage extends ConsumerStatefulWidget {
  final String? preRouteId;
  final String? preRouteName;
  const TripCheckinPage({super.key, this.preRouteId, this.preRouteName});

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

  /// Preferencias del conductor (última unidad/ruta usadas).
  DriverPreferences? _prefs;

  /// Estado del permiso GPS — bloquea el paso 1 hasta obtener "granted".
  LocationPermissionResult? _permissionResult;
  bool _checkingPermission = false;

  /// Si la ruta vino prellenada en `widget.preRouteId` se usa esa; si no,
  /// se cae a la ruta de preferencias (la última que usó el conductor).
  String? get _effectiveRouteId =>
      widget.preRouteId ?? _prefs?.route?.id;
  String? get _effectiveRouteName =>
      widget.preRouteName ?? _prefs?.route?.name;

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
    _loadVehiclesAndPrefs();
    _checkPermissionsSilently();
  }

  @override
  void dispose() {
    _pageController.dispose();
    super.dispose();
  }

  Future<void> _checkPermissionsSilently() async {
    // Solo verifica el estado actual sin disparar el diálogo del SO; el
    // diálogo se mostrará al tocar "Continuar" si todavía no fue otorgado.
    final notifier = ref.read(locationTrackingProvider.notifier);
    final result = await notifier.ensurePermissions();
    if (!mounted) return;
    setState(() => _permissionResult = result);
  }

  Future<void> _loadVehiclesAndPrefs() async {
    setState(() {
      _vehiclesLoading = true;
      _vehiclesError = null;
    });
    try {
      final fleetSvc = ref.read(fleetApiServiceProvider);
      final tripsSvc = ref.read(tripsApiServiceProvider);
      // Preferencias y vehículos en paralelo — preferencias es opcional, no bloquea.
      final results = await Future.wait([
        fleetSvc.getAvailableVehicles(),
        tripsSvc.getDriverPreferences().catchError(
            (_) => const DriverPreferences()),
      ]);
      final items = results[0] as List<Map<String, dynamic>>;
      final prefs = results[1] as DriverPreferences;

      if (!mounted) return;

      // Pre-seleccionar la última unidad si está dentro de las disponibles.
      String? preselectId;
      String preselectPlate = '';
      if (prefs.vehicle != null) {
        for (final v in items) {
          final id = v['_id'] as String? ?? v['id'] as String? ?? '';
          if (id == prefs.vehicle!.id) {
            preselectId = id;
            preselectPlate = v['plate'] as String? ?? prefs.vehicle!.plate;
            break;
          }
        }
      }

      setState(() {
        _vehicles = items;
        _vehiclesLoading = false;
        _prefs = prefs;
        if (preselectId != null) {
          _selectedVehicleId = preselectId;
          _selectedVehiclePlate = preselectPlate;
        }
      });
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

  Future<void> _goToStep2() async {
    if (_selectedVehicleId == null) {
      _showSnack('Selecciona un vehículo para continuar');
      return;
    }

    // Permisos GPS bloqueantes — no se puede iniciar turno sin ubicación.
    setState(() => _checkingPermission = true);
    final result =
        await ref.read(locationTrackingProvider.notifier).ensurePermissions();
    if (!mounted) return;
    setState(() {
      _permissionResult = result;
      _checkingPermission = false;
    });

    if (result != LocationPermissionResult.granted) {
      await _showPermissionBlockedDialog(result);
      return;
    }

    _pageController.nextPage(
      duration: const Duration(milliseconds: 280),
      curve: Curves.easeInOut,
    );
    setState(() => _step = 1);
  }

  Future<void> _showPermissionBlockedDialog(
      LocationPermissionResult result) async {
    final (title, message, ctaLabel, openSettings) = switch (result) {
      LocationPermissionResult.serviceDisabled => (
          'Activa la ubicación',
          'El GPS del dispositivo está apagado. Actívalo en los ajustes para poder iniciar turno.',
          'Abrir ajustes del sistema',
          () => Geolocator.openLocationSettings(),
        ),
      LocationPermissionResult.deniedForever => (
          'Permiso de ubicación bloqueado',
          'Has bloqueado el acceso a la ubicación. Habilítalo manualmente desde los ajustes de la app — sin esto no podemos registrar tu turno.',
          'Abrir ajustes de la app',
          () => Geolocator.openAppSettings(),
        ),
      _ => (
          'Necesitamos tu ubicación',
          'SFIT registra tu recorrido en tiempo real para validar la ruta y calcular cumplimiento. Toca "Reintentar" y otorga el permiso para continuar.',
          'Reintentar',
          () async {
            final r = await ref
                .read(locationTrackingProvider.notifier)
                .ensurePermissions();
            if (mounted) setState(() => _permissionResult = r);
            return r == LocationPermissionResult.granted;
          },
        ),
    };

    if (!mounted) return;
    await showDialog<void>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(title),
        content: Text(message),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(),
            child: const Text('Cancelar'),
          ),
          FilledButton(
            onPressed: () async {
              await openSettings();
              if (ctx.mounted) Navigator.of(ctx).pop();
            },
            child: Text(ctaLabel),
          ),
        ],
      ),
    );
  }

  Future<void> _iniciarTurno() async {
    if (!_checklistComplete) {
      _showSnack('Completa todos los ítems del checklist');
      return;
    }
    setState(() => _submitting = true);
    try {
      final svc = ref.read(tripsApiServiceProvider);
      final routeId = _effectiveRouteId;
      final entryId = await svc.startTrip(
        vehicleId: _selectedVehicleId!,
        departureTime: _departureTime,
        checklistComplete: true,
        routeId: routeId,
      );
      // Arranca el tracker GPS con el id de la FleetEntry y la ruta seleccionada
      await ref.read(locationTrackingProvider.notifier).startTracking(
        entryId,
        routeId: routeId,
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
            onRetry: _loadVehiclesAndPrefs,
            onVehicleSelected: (id, plate) => setState(() {
              _selectedVehicleId = id;
              _selectedVehiclePlate = plate;
            }),
            onPickTime: _pickDepartureTime,
            onNext: _goToStep2,
            preRouteName: _effectiveRouteName,
            isSuggestedRoute:
                widget.preRouteId == null && _prefs?.route != null,
            suggestedVehicleId: _prefs?.vehicle?.id,
            permissionResult: _permissionResult,
            checkingPermission: _checkingPermission,
            onRetryPermission: _checkPermissionsSilently,
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
  final String? preRouteName;
  /// `true` cuando la ruta no vino prellenada y se cae a la última usada.
  final bool isSuggestedRoute;
  /// ID de la unidad sugerida (última usada por el conductor).
  final String? suggestedVehicleId;
  final LocationPermissionResult? permissionResult;
  final bool checkingPermission;
  final VoidCallback onRetryPermission;

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
    required this.permissionResult,
    required this.checkingPermission,
    required this.onRetryPermission,
    this.preRouteName,
    this.isSuggestedRoute = false,
    this.suggestedVehicleId,
  });

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(16, 20, 16, 24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Encabezado del paso
          const _SectionHeader(
            step: 1,
            title: 'Vehículo y hora de salida',
            subtitle: 'Selecciona el vehículo asignado y confirma la hora estimada de salida.',
          ),
          const SizedBox(height: 16),

          _PermissionBanner(
            result: permissionResult,
            checking: checkingPermission,
            onRetry: onRetryPermission,
          ),

          if (preRouteName != null) ...[
            Container(
              margin: const EdgeInsets.only(bottom: 16),
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
              decoration: BoxDecoration(
                color: AppColors.goldBg,
                border: Border.all(color: AppColors.goldBorder),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Row(
                children: [
                  Icon(
                    isSuggestedRoute ? Icons.history_rounded : Icons.route,
                    size: 18,
                    color: AppColors.goldDark,
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          isSuggestedRoute ? 'RUTA SUGERIDA (ÚLTIMA USADA)' : 'RUTA ASIGNADA',
                          style: AppTheme.inter(
                            fontSize: 9.5,
                            fontWeight: FontWeight.w700,
                            color: AppColors.goldDark,
                            letterSpacing: 1.4,
                          ),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          preRouteName!,
                          style: AppTheme.inter(
                            fontSize: 14,
                            fontWeight: FontWeight.w700,
                            color: AppColors.goldDark,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ],

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
            const _InfoCard(
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
                isSuggested: suggestedVehicleId != null && suggestedVehicleId == id,
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
  final bool isSuggested;
  final VoidCallback onTap;

  const _VehicleCard({
    required this.id,
    required this.plate,
    required this.label,
    required this.selected,
    required this.onTap,
    this.isSuggested = false,
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
                  Row(
                    children: [
                      Text(
                        plate,
                        style: AppTheme.inter(
                          fontSize: 14,
                          fontWeight: FontWeight.w700,
                          color: AppColors.ink9,
                        ),
                      ),
                      if (isSuggested) ...[
                        const SizedBox(width: 6),
                        Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 6, vertical: 2),
                          decoration: BoxDecoration(
                            color: AppColors.infoBg,
                            border: Border.all(color: AppColors.infoBorder),
                            borderRadius: BorderRadius.circular(999),
                          ),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              const Icon(Icons.history_rounded,
                                  size: 10, color: AppColors.info),
                              const SizedBox(width: 3),
                              Text(
                                'ÚLTIMA',
                                style: AppTheme.inter(
                                  fontSize: 8.5,
                                  fontWeight: FontWeight.w800,
                                  color: AppColors.info,
                                  letterSpacing: 0.6,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ],
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

class _PermissionBanner extends StatelessWidget {
  final LocationPermissionResult? result;
  final bool checking;
  final VoidCallback onRetry;

  const _PermissionBanner({
    required this.result,
    required this.checking,
    required this.onRetry,
  });

  @override
  Widget build(BuildContext context) {
    if (result == LocationPermissionResult.granted) {
      return Container(
        margin: const EdgeInsets.only(bottom: 12),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        decoration: BoxDecoration(
          color: AppColors.aptoBg,
          border: Border.all(color: AppColors.aptoBorder),
          borderRadius: BorderRadius.circular(10),
        ),
        child: Row(
          children: [
            const Icon(Icons.gps_fixed_rounded,
                size: 16, color: AppColors.apto),
            const SizedBox(width: 8),
            Expanded(
              child: Text(
                'Ubicación activa — el recorrido se registrará durante tu turno.',
                style: AppTheme.inter(fontSize: 12, color: AppColors.apto),
              ),
            ),
          ],
        ),
      );
    }

    final (color, bg, border, icon, message) = switch (result) {
      LocationPermissionResult.serviceDisabled => (
          AppColors.noApto,
          AppColors.noAptoBg,
          AppColors.noAptoBorder,
          Icons.location_disabled_rounded,
          'GPS apagado. Actívalo desde el sistema antes de iniciar turno.',
        ),
      LocationPermissionResult.deniedForever => (
          AppColors.noApto,
          AppColors.noAptoBg,
          AppColors.noAptoBorder,
          Icons.block_rounded,
          'Permiso de ubicación bloqueado. Habilítalo en ajustes para continuar.',
        ),
      _ => (
          AppColors.riesgo,
          AppColors.riesgoBg,
          AppColors.riesgoBorder,
          Icons.gps_off_rounded,
          'Necesitamos tu ubicación para registrar el recorrido del turno.',
        ),
    };

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: bg,
        border: Border.all(color: border),
        borderRadius: BorderRadius.circular(10),
      ),
      child: Row(
        children: [
          Icon(icon, size: 18, color: color),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              message,
              style: AppTheme.inter(
                fontSize: 12,
                color: color,
                fontWeight: FontWeight.w600,
                height: 1.4,
              ),
            ),
          ),
          TextButton(
            onPressed: checking ? null : onRetry,
            style: TextButton.styleFrom(
              foregroundColor: color,
              padding:
                  const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
              minimumSize: const Size(0, 32),
            ),
            child: checking
                ? const SizedBox(
                    width: 14,
                    height: 14,
                    child: CircularProgressIndicator(strokeWidth: 1.6),
                  )
                : Text(
                    'Probar',
                    style: AppTheme.inter(
                      fontSize: 12,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
          ),
        ],
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
          const _SectionHeader(
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
