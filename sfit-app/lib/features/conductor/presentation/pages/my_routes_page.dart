import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:geolocator/geolocator.dart';
import '../../../../core/network/dio_client.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../auth/presentation/providers/auth_provider.dart';

/// Rutas del día para el rol Conductor — RF-10.
class MyRoutesPage extends ConsumerStatefulWidget {
  const MyRoutesPage({super.key});

  @override
  ConsumerState<MyRoutesPage> createState() => _MyRoutesPageState();
}

class _MyRoutesPageState extends ConsumerState<MyRoutesPage> {
  List<Map<String, dynamic>> _entries = [];
  bool _loading = true;
  String? _error;
  String? _actionLoadingId;
  String? _actionError;
  Timer? _locationTimer;
  String? _activeEntryId;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _locationTimer?.cancel();
    super.dispose();
  }

  void _startLocationTimer(String entryId) {
    _locationTimer?.cancel();
    _activeEntryId = entryId;
    // Envía posición GPS cada 60 segundos mientras el recorrido está activo
    _locationTimer = Timer.periodic(const Duration(seconds: 60), (_) {
      _updateLocation(entryId);
    });
  }

  void _stopLocationTimer() {
    _locationTimer?.cancel();
    _locationTimer = null;
    _activeEntryId = null;
  }

  Future<void> _load() async {
    setState(() { _loading = true; _error = null; });
    try {
      final dio = ref.read(dioClientProvider).dio;
      final resp = await dio.get('/flota', queryParameters: {'limit': 20});
      final data = (resp.data as Map)['data'] as Map;
      if (mounted) {
        final items = List<Map<String, dynamic>>.from(data['items'] as List);
        setState(() { _entries = items; _loading = false; });

        // Restaurar timer si hay un recorrido activo y no había timer corriendo
        if (_locationTimer == null) {
          final active = items.where((e) => e['status'] == 'en_ruta').firstOrNull;
          if (active != null) _startLocationTimer(active['id'] as String);
        }
      }
    } catch (e) {
      if (mounted) setState(() { _loading = false; _error = e.toString(); });
    }
  }

  Future<Position?> _requestPosition() async {
    bool serviceEnabled = await Geolocator.isLocationServiceEnabled();
    if (!serviceEnabled) {
      if (mounted) {
        setState(() { _actionError = 'El GPS está desactivado. Actívalo en ajustes.'; });
      }
      return null;
    }

    LocationPermission permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
      if (permission == LocationPermission.denied) {
        if (mounted) setState(() { _actionError = 'Permiso de ubicación denegado.'; });
        return null;
      }
    }
    if (permission == LocationPermission.deniedForever) {
      if (mounted) setState(() { _actionError = 'Permiso de ubicación permanentemente denegado. Actívalo en ajustes del sistema.'; });
      return null;
    }

    try {
      return await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(
          accuracy: LocationAccuracy.high,
          timeLimit: Duration(seconds: 20),
        ),
      );
    } catch (e) {
      if (mounted) setState(() { _actionError = 'No se pudo obtener la ubicación: ${e.toString()}'; });
      return null;
    }
  }

  Future<void> _startTrip(String entryId) async {
    setState(() { _actionLoadingId = entryId; _actionError = null; });
    try {
      final position = await _requestPosition();
      if (position == null) {
        setState(() { _actionLoadingId = null; });
        return;
      }
      final dio = ref.read(dioClientProvider).dio;
      await dio.patch('/flota/$entryId/location', data: {
        'lat': position.latitude,
        'lng': position.longitude,
        'action': 'start',
      });
      _startLocationTimer(entryId);
      await _load();
    } catch (e) {
      if (mounted) setState(() { _actionError = 'Error al iniciar recorrido: ${e.toString()}'; });
    } finally {
      if (mounted) setState(() { _actionLoadingId = null; });
    }
  }

  Future<void> _endTrip(String entryId) async {
    setState(() { _actionLoadingId = entryId; _actionError = null; });
    try {
      final position = await _requestPosition();
      if (position == null) {
        setState(() { _actionLoadingId = null; });
        return;
      }
      final dio = ref.read(dioClientProvider).dio;
      await dio.patch('/flota/$entryId/location', data: {
        'lat': position.latitude,
        'lng': position.longitude,
        'action': 'end',
      });
      _stopLocationTimer();
      await _load();
    } catch (e) {
      if (mounted) setState(() { _actionError = 'Error al finalizar recorrido: ${e.toString()}'; });
    } finally {
      if (mounted) setState(() { _actionLoadingId = null; });
    }
  }

  Future<void> _updateLocation(String entryId) async {
    try {
      final position = await _requestPosition();
      if (position == null) return;
      final dio = ref.read(dioClientProvider).dio;
      await dio.patch('/flota/$entryId/location', data: {
        'lat': position.latitude,
        'lng': position.longitude,
        'action': 'update',
      });
    } catch (_) {}
  }

  double get _totalKm {
    return _entries.fold<double>(0.0, (sum, e) {
      final km = e['km'];
      if (km == null) return sum;
      return sum + (km as num).toDouble();
    });
  }

  double get _totalHours {
    double total = 0.0;
    for (final e in _entries) {
      final dep = e['departureTime'] as String?;
      final ret = e['returnTime'] as String?;
      if (dep != null && ret != null) {
        try {
          final d = DateTime.parse(dep);
          final r = DateTime.parse(ret);
          total += r.difference(d).inMinutes / 60.0;
        } catch (_) {}
      } else if (dep != null) {
        try {
          final d = DateTime.parse(dep);
          total += DateTime.now().difference(d).inMinutes / 60.0;
        } catch (_) {}
      }
    }
    return total;
  }

  int get _completedTrips =>
      _entries.where((e) {
        final s = e['status'] as String? ?? '';
        return s == 'cerrado' || s == 'auto_cierre';
      }).length;

  @override
  Widget build(BuildContext context) {
    final user = ref.watch(authProvider).user;
    return SafeArea(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 20, 16, 4),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Rutas del día',
                    style: AppTheme.inter(
                      fontSize: 20, fontWeight: FontWeight.w800,
                      color: AppColors.ink9, letterSpacing: -0.5)),
                if (user != null)
                  Text(user.name,
                      style: AppTheme.inter(fontSize: 13, color: AppColors.ink4)),
              ],
            ),
          ),
          const SizedBox(height: 10),

          if (!_loading && _entries.isNotEmpty)
            _DailySummaryRow(
              totalKm: _totalKm,
              totalHours: _totalHours,
              completed: _completedTrips,
            ),

          if (_actionError != null)
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                decoration: BoxDecoration(
                  color: AppColors.noAptoBg,
                  border: Border.all(color: AppColors.noAptoBorder),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Row(
                  children: [
                    const Icon(Icons.error_outline, size: 16, color: AppColors.noApto),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(_actionError!,
                          style: AppTheme.inter(fontSize: 12, color: AppColors.noApto)),
                    ),
                    GestureDetector(
                      onTap: () => setState(() { _actionError = null; }),
                      child: const Icon(Icons.close, size: 14, color: AppColors.noApto),
                    ),
                  ],
                ),
              ),
            ),

          Expanded(
            child: _loading
                ? const Center(child: CircularProgressIndicator(color: AppColors.gold))
                : _error != null
                    ? Center(
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            const Icon(Icons.error_outline,
                                color: AppColors.noApto, size: 32),
                            const SizedBox(height: 8),
                            Text('Error al cargar rutas.',
                                style: AppTheme.inter(fontSize: 14, color: AppColors.ink6)),
                            const SizedBox(height: 12),
                            TextButton(onPressed: _load, child: const Text('Reintentar')),
                          ],
                        ),
                      )
                    : _entries.isEmpty
                        ? Center(
                            child: Column(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                const Icon(Icons.route_outlined,
                                    size: 48, color: AppColors.ink2),
                                const SizedBox(height: 12),
                                Text('Sin rutas asignadas hoy.',
                                    style: AppTheme.inter(fontSize: 15, color: AppColors.ink4)),
                              ],
                            ),
                          )
                        : RefreshIndicator(
                            onRefresh: _load,
                            color: AppColors.gold,
                            child: ListView.separated(
                              padding: const EdgeInsets.all(12),
                              itemCount: _entries.length,
                              separatorBuilder: (_, __) => const SizedBox(height: 8),
                              itemBuilder: (_, i) => _RouteCard(
                                entry: _entries[i],
                                isActionLoading: _actionLoadingId == (_entries[i]['id'] as String?),
                                onStartTrip: _startTrip,
                                onEndTrip: _endTrip,
                                onUpdateLocation: _updateLocation,
                              ),
                            ),
                          ),
          ),
        ],
      ),
    );
  }
}

// ── Widget: Resumen de hoy ────────────────────────────────────────
class _DailySummaryRow extends StatelessWidget {
  final double totalKm;
  final double totalHours;
  final int completed;

  const _DailySummaryRow({
    required this.totalKm,
    required this.totalHours,
    required this.completed,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(12, 0, 12, 10),
      child: Row(
        children: [
          _MiniCard(
            icon: Icons.route,
            value: '${totalKm.toStringAsFixed(0)} km',
            label: 'Recorridos',
            color: AppColors.info,
            bg: AppColors.infoBg,
          ),
          const SizedBox(width: 8),
          _MiniCard(
            icon: Icons.timer_outlined,
            value: _formatHours(totalHours),
            label: 'En ruta',
            color: AppColors.riesgo,
            bg: AppColors.riesgoBg,
          ),
          const SizedBox(width: 8),
          _MiniCard(
            icon: Icons.check_circle_outline,
            value: '$completed',
            label: 'Completados',
            color: AppColors.apto,
            bg: AppColors.aptoBg,
          ),
        ],
      ),
    );
  }

  String _formatHours(double h) {
    final hrs  = h.floor();
    final mins = ((h - hrs) * 60).round();
    if (hrs == 0) return '${mins}m';
    return '${hrs}h ${mins.toString().padLeft(2, '0')}m';
  }
}

class _MiniCard extends StatelessWidget {
  final IconData icon;
  final String value;
  final String label;
  final Color color;
  final Color bg;

  const _MiniCard({
    required this.icon,
    required this.value,
    required this.label,
    required this.color,
    required this.bg,
  });

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 8),
        decoration: BoxDecoration(
          color: bg,
          border: Border.all(color: color.withValues(alpha: 0.25)),
          borderRadius: BorderRadius.circular(10),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 16, color: color),
            const SizedBox(height: 4),
            Text(value,
                style: AppTheme.inter(
                    fontSize: 14, fontWeight: FontWeight.w800,
                    color: color, tabular: true)),
            Text(label,
                style: AppTheme.inter(fontSize: 10, color: color.withValues(alpha: 0.75)),
                textAlign: TextAlign.center),
          ],
        ),
      ),
    );
  }
}

// ── Tarjeta de ruta ───────────────────────────────────────────────
class _RouteCard extends StatelessWidget {
  final Map<String, dynamic> entry;
  final bool isActionLoading;
  final Future<void> Function(String entryId) onStartTrip;
  final Future<void> Function(String entryId) onEndTrip;
  final Future<void> Function(String entryId) onUpdateLocation;

  const _RouteCard({
    required this.entry,
    required this.isActionLoading,
    required this.onStartTrip,
    required this.onEndTrip,
    required this.onUpdateLocation,
  });

  @override
  Widget build(BuildContext context) {
    final entryId = entry['id'] as String? ?? '';
    final status = entry['status'] as String? ?? 'disponible';
    final vehicle = entry['vehicleId'] as Map? ?? {};
    final route = entry['routeId'] as Map?;
    final dep = entry['departureTime'] as String?;
    final ret = entry['returnTime'] as String?;

    final (statusColor, statusBg, statusLabel) = switch (status) {
      'en_ruta'     => (AppColors.goldDark, AppColors.goldBg,  'EN RUTA'),
      'cerrado'     => (AppColors.apto,     AppColors.aptoBg,  'CERRADO'),
      'auto_cierre' => (AppColors.ink5,     AppColors.ink1,    'AUTO-CIERRE'),
      'disponible'  => (AppColors.info,     AppColors.infoBg,  'DISPONIBLE'),
      _             => (AppColors.ink5,     AppColors.ink1,     status.toUpperCase()),
    };

    final showStart = status == 'disponible';
    final showEnd   = status == 'en_ruta';
    final showShare = status == 'en_ruta';

    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: status == 'en_ruta' ? AppColors.goldBorder : AppColors.ink1,
          width: status == 'en_ruta' ? 1.5 : 1,
        ),
      ),
      padding: const EdgeInsets.all(14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // ── Encabezado: placa + badge de estado ──────────────
          Row(
            children: [
              const Icon(Icons.directions_bus, size: 18, color: AppColors.gold),
              const SizedBox(width: 6),
              Text(vehicle['plate'] as String? ?? '—',
                  style: AppTheme.inter(
                    fontSize: 14, fontWeight: FontWeight.w700,
                    color: AppColors.ink9)),
              if (vehicle['brand'] != null || vehicle['model'] != null) ...[
                const SizedBox(width: 6),
                Text(
                  '${vehicle['brand'] ?? ''} ${vehicle['model'] ?? ''}'.trim(),
                  style: AppTheme.inter(fontSize: 11, color: AppColors.ink5),
                  overflow: TextOverflow.ellipsis,
                ),
              ],
              const Spacer(),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: statusBg,
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Text(statusLabel,
                    style: AppTheme.inter(
                      fontSize: 10, fontWeight: FontWeight.w700,
                      color: statusColor)),
              ),
            ],
          ),

          // ── Ruta asignada ─────────────────────────────────────
          if (route != null) ...[
            const SizedBox(height: 6),
            Row(
              children: [
                const Icon(Icons.route, size: 13, color: AppColors.ink4),
                const SizedBox(width: 4),
                Text(
                  '${route['code'] ?? ''} · ${route['name'] ?? ''}',
                  style: AppTheme.inter(
                    fontSize: 12, color: AppColors.ink6, fontWeight: FontWeight.w500),
                  overflow: TextOverflow.ellipsis,
                ),
              ],
            ),
          ],

          // ── Horarios ──────────────────────────────────────────
          const SizedBox(height: 8),
          Row(children: [
            const Icon(Icons.login, size: 14, color: AppColors.ink4),
            const SizedBox(width: 4),
            Text(_fmtTime(dep), style: AppTheme.inter(fontSize: 12, color: AppColors.ink5)),
            if (ret != null) ...[
              const SizedBox(width: 14),
              const Icon(Icons.logout, size: 14, color: AppColors.ink4),
              const SizedBox(width: 4),
              Text(_fmtTime(ret), style: AppTheme.inter(fontSize: 12, color: AppColors.ink5)),
            ],
          ]),

          // ── Botones de acción GPS ─────────────────────────────
          if (showStart || showEnd || showShare) ...[
            const SizedBox(height: 12),
            const Divider(height: 1, color: AppColors.ink1),
            const SizedBox(height: 10),
            Row(
              children: [
                if (showStart)
                  Expanded(
                    child: _ActionButton(
                      label: 'Iniciar recorrido',
                      icon: Icons.play_arrow_rounded,
                      color: AppColors.apto,
                      bg: AppColors.aptoBg,
                      border: AppColors.aptoBorder,
                      loading: isActionLoading,
                      onTap: () => onStartTrip(entryId),
                    ),
                  ),
                if (showEnd) ...[
                  Expanded(
                    child: _ActionButton(
                      label: 'Finalizar recorrido',
                      icon: Icons.stop_rounded,
                      color: AppColors.noApto,
                      bg: AppColors.noAptoBg,
                      border: AppColors.noAptoBorder,
                      loading: isActionLoading,
                      onTap: () => onEndTrip(entryId),
                    ),
                  ),
                  const SizedBox(width: 8),
                  _ActionButton(
                    label: 'Actualizar',
                    icon: Icons.my_location,
                    color: AppColors.gold,
                    bg: AppColors.goldBg,
                    border: AppColors.goldBorder,
                    loading: false,
                    onTap: () => onUpdateLocation(entryId),
                    compact: true,
                  ),
                ],
              ],
            ),
          ],
        ],
      ),
    );
  }

  String _fmtTime(String? iso) {
    if (iso == null) return '—';
    try {
      final dt = DateTime.parse(iso).toLocal();
      final h = dt.hour.toString().padLeft(2, '0');
      final m = dt.minute.toString().padLeft(2, '0');
      return '$h:$m';
    } catch (_) {
      return '—';
    }
  }
}

// ── Botón de acción con estado de carga ───────────────────────────
class _ActionButton extends StatelessWidget {
  final String label;
  final IconData icon;
  final Color color;
  final Color bg;
  final Color border;
  final bool loading;
  final VoidCallback onTap;
  final bool compact;

  const _ActionButton({
    required this.label,
    required this.icon,
    required this.color,
    required this.bg,
    required this.border,
    required this.loading,
    required this.onTap,
    this.compact = false,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: loading ? null : onTap,
      child: AnimatedOpacity(
        opacity: loading ? 0.6 : 1.0,
        duration: const Duration(milliseconds: 150),
        child: Container(
          padding: EdgeInsets.symmetric(
            vertical: 9, horizontal: compact ? 10 : 12),
          decoration: BoxDecoration(
            color: bg,
            border: Border.all(color: border),
            borderRadius: BorderRadius.circular(8),
          ),
          child: loading
              ? Center(
                  child: SizedBox(
                    width: 14, height: 14,
                    child: CircularProgressIndicator(
                      strokeWidth: 2, color: color),
                  ),
                )
              : Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(icon, size: 15, color: color),
                    if (!compact) ...[
                      const SizedBox(width: 5),
                      Text(label,
                          style: AppTheme.inter(
                            fontSize: 12, fontWeight: FontWeight.w700,
                            color: color)),
                    ],
                  ],
                ),
        ),
      ),
    );
  }
}
