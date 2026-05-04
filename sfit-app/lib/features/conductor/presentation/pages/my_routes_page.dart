import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:geolocator/geolocator.dart';
import 'package:go_router/go_router.dart';
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
    _locationTimer = Timer.periodic(const Duration(seconds: 60), (_) {
      _updateLocation(entryId);
    });
  }

  void _stopLocationTimer() {
    _locationTimer?.cancel();
    _locationTimer = null;
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

        if (_locationTimer == null) {
          final active = items.where((e) => e['status'] == 'en_ruta').firstOrNull;
          if (active != null) _startLocationTimer(active['id'] as String);
        }
      }
    } catch (e) {
      if (mounted) setState(() { _loading = false; _error = e.toString(); });
    }
  }

  /// Intenta obtener una posición rápida (3s) sin bloquear el flujo.
  /// Si el GPS no responde a tiempo o no hay permiso, devuelve null.
  /// El servidor recibirá la primera ubicación real en el siguiente tick
  /// del timer de actualización (cada 60s).
  Future<Position?> _tryGetPosition({Duration timeout = const Duration(seconds: 3)}) async {
    try {
      final enabled = await Geolocator.isLocationServiceEnabled();
      if (!enabled) return null;
      var perm = await Geolocator.checkPermission();
      if (perm == LocationPermission.denied) {
        perm = await Geolocator.requestPermission();
      }
      if (perm == LocationPermission.denied || perm == LocationPermission.deniedForever) {
        return null;
      }
      return await Geolocator.getCurrentPosition(
        locationSettings: LocationSettings(
          accuracy: LocationAccuracy.high,
          timeLimit: timeout,
        ),
      );
    } catch (_) {
      return null;
    }
  }

  Future<void> _startTrip(String entryId) async {
    setState(() { _actionLoadingId = entryId; _actionError = null; });
    try {
      final position = await _tryGetPosition();
      final dio = ref.read(dioClientProvider).dio;
      // Si no hay GPS aún, mandamos lat/lng = 0 como placeholder; el
      // backend acepta `action: "start"` y el primer punto real llega
      // cuando el GPS responda en el próximo tick del timer.
      await dio.patch('/flota/$entryId/location', data: {
        'lat': position?.latitude ?? 0,
        'lng': position?.longitude ?? 0,
        'action': 'start',
      });
      _startLocationTimer(entryId);
      await _load();
      if (position == null && mounted) {
        setState(() { _actionError = 'Iniciado sin GPS — registrando posición en background.'; });
      }
    } catch (e) {
      if (mounted) setState(() { _actionError = 'Error al iniciar recorrido: ${e.toString()}'; });
    } finally {
      if (mounted) setState(() { _actionLoadingId = null; });
    }
  }

  Future<void> _endTrip(String entryId) async {
    setState(() { _actionLoadingId = entryId; _actionError = null; });
    try {
      final position = await _tryGetPosition();
      final dio = ref.read(dioClientProvider).dio;
      await dio.patch('/flota/$entryId/location', data: {
        'lat': position?.latitude ?? 0,
        'lng': position?.longitude ?? 0,
        'action': 'end',
      });
      _stopLocationTimer();
      // Navegar directo al resumen full-screen del viaje (en lugar de solo recargar).
      if (mounted) {
        context.push('/conductor/trip-summary/$entryId');
      }
    } catch (e) {
      if (mounted) setState(() { _actionError = 'Error al finalizar recorrido: ${e.toString()}'; });
    } finally {
      if (mounted) setState(() { _actionLoadingId = null; });
    }
  }

  Future<void> _updateLocation(String entryId) async {
    try {
      final position = await _tryGetPosition();
      if (position == null) return;
      final dio = ref.read(dioClientProvider).dio;
      await dio.patch('/flota/$entryId/location', data: {
        'lat': position.latitude,
        'lng': position.longitude,
        'action': 'update',
      });
    } catch (_) {}
  }

  /// Renderiza el cuerpo principal:
  ///   - Si hay una sola FleetEntry "disponible" → "modo directo" con un
  ///     botón gigante "Iniciar mi turno" centrado. Reduce fricción.
  ///   - Si hay varias o estados mixtos → la lista clásica con cards.
  Widget _buildBody() {
    final disponibles = _entries.where((e) => e['status'] == 'disponible').toList();
    final showBigButton = _entries.length == 1 && disponibles.length == 1;

    if (showBigButton) {
      final entry = disponibles.first;
      final entryId = entry['id'] as String? ?? '';
      final isLoading = _actionLoadingId == entryId;
      final vehicle = entry['vehicle'] as Map<String, dynamic>?;
      final route = entry['route'] as Map<String, dynamic>?;
      final plate = vehicle?['plate'] as String? ?? '—';
      final routeLabel = route?['name'] as String? ?? 'Sin ruta asignada';

      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Container(
                padding: const EdgeInsets.all(20),
                decoration: BoxDecoration(
                  color: AppColors.goldBg,
                  shape: BoxShape.circle,
                  border: Border.all(color: AppColors.goldBorder, width: 2),
                ),
                child: const Icon(Icons.directions_bus_rounded, size: 48, color: AppColors.goldDark),
              ),
              const SizedBox(height: 18),
              Text(plate,
                style: AppTheme.inter(fontSize: 22, fontWeight: FontWeight.w800, color: AppColors.ink9, tabular: true)),
              const SizedBox(height: 4),
              Text(routeLabel, textAlign: TextAlign.center,
                style: AppTheme.inter(fontSize: 13, color: AppColors.ink6)),
              const SizedBox(height: 32),
              SizedBox(
                width: double.infinity,
                height: 64,
                child: FilledButton(
                  onPressed: isLoading ? null : () => _startTrip(entryId),
                  style: FilledButton.styleFrom(
                    backgroundColor: AppColors.gold,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                  ),
                  child: isLoading
                      ? const SizedBox(width: 22, height: 22, child: CircularProgressIndicator(strokeWidth: 2.4, color: Colors.white))
                      : Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                          const Icon(Icons.play_arrow_rounded, size: 28, color: Colors.white),
                          const SizedBox(width: 8),
                          Text('Iniciar mi turno',
                            style: AppTheme.inter(fontSize: 17, fontWeight: FontWeight.w800, color: Colors.white)),
                        ]),
                ),
              ),
              const SizedBox(height: 12),
              Text('Te pediremos GPS al iniciar. Si no responde a tiempo,\nigual arrancamos y registramos la posición en background.',
                textAlign: TextAlign.center,
                style: AppTheme.inter(fontSize: 11.5, color: AppColors.ink5, height: 1.4)),
            ],
          ),
        ),
      );
    }

    return RefreshIndicator(
      onRefresh: _load,
      color: AppColors.ink9,
      child: ListView.separated(
        padding: const EdgeInsets.fromLTRB(16, 4, 16, 16),
        itemCount: _entries.length,
        separatorBuilder: (_, __) => const SizedBox(height: 10),
        itemBuilder: (_, i) => _RouteCard(
          entry: _entries[i],
          isActionLoading: _actionLoadingId == (_entries[i]['id'] as String?),
          onStartTrip: _startTrip,
          onEndTrip: _endTrip,
          onUpdateLocation: _updateLocation,
        ),
      ),
    );
  }

  // ── Métricas derivadas ──────────────────────────────────────────
  int get _enRuta =>
      _entries.where((e) => e['status'] == 'en_ruta').length;

  int get _completed =>
      _entries.where((e) {
        final s = e['status'] as String? ?? '';
        return s == 'cerrado' || s == 'auto_cierre';
      }).length;

  int get _disponibles =>
      _entries.where((e) => e['status'] == 'disponible').length;

  double get _totalKm => _entries.fold<double>(0.0, (sum, e) {
        final km = e['km'];
        if (km == null) return sum;
        return sum + (km as num).toDouble();
      });

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

  String _fmtHours(double h) {
    final hrs = h.floor();
    final mins = ((h - hrs) * 60).round();
    if (hrs == 0) return '${mins}m';
    return '${hrs}h ${mins.toString().padLeft(2, '0')}m';
  }

  @override
  Widget build(BuildContext context) {
    final user = ref.watch(authProvider).user;
    return SafeArea(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // ── Encabezado ─────────────────────────────────────────
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 18, 16, 4),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Rutas del día',
                    style: AppTheme.inter(
                      fontSize: 20, fontWeight: FontWeight.w700,
                      color: AppColors.ink9, letterSpacing: -0.5)),
                if (user != null)
                  Padding(
                    padding: const EdgeInsets.only(top: 2),
                    child: Text(user.name,
                        style: AppTheme.inter(fontSize: 12, color: AppColors.ink5)),
                  ),
              ],
            ),
          ),

          // ── Strip de métricas ──────────────────────────────────
          if (!_loading && _entries.isNotEmpty) ...[
            const SizedBox(height: 12),
            _StatsStrip(
              total: _entries.length,
              enRuta: _enRuta,
              completados: _completed,
              disponibles: _disponibles,
              km: _totalKm,
              hours: _fmtHours(_totalHours),
            ),
          ],

          // ── Banner de error inline ─────────────────────────────
          if (_actionError != null)
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
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

          const SizedBox(height: 12),

          // ── Cuerpo ─────────────────────────────────────────────
          Expanded(
            child: _loading
                ? const _LoadingState()
                : _error != null
                    ? _ErrorState(onRetry: _load)
                    : _entries.isEmpty
                        ? const _EmptyState()
                        : _buildBody(),
          ),
        ],
      ),
    );
  }
}

// ── Strip de métricas (sobrio, separadores verticales) ──────────────
class _StatsStrip extends StatelessWidget {
  final int total;
  final int enRuta;
  final int completados;
  final int disponibles;
  final double km;
  final String hours;

  const _StatsStrip({
    required this.total,
    required this.enRuta,
    required this.completados,
    required this.disponibles,
    required this.km,
    required this.hours,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        decoration: BoxDecoration(
          color: Colors.white,
          border: Border.all(color: AppColors.ink2),
          borderRadius: BorderRadius.circular(10),
        ),
        child: Row(
          children: [
            _StatItem(label: 'Total',     value: '$total'),
            const _Sep(),
            _StatItem(label: 'En ruta',   value: '$enRuta',   accent: AppColors.info),
            const _Sep(),
            _StatItem(label: 'Cerrados', value: '$completados', accent: AppColors.apto),
            const _Sep(),
            _StatItem(label: 'Km',       value: km.toStringAsFixed(0)),
            const _Sep(),
            _StatItem(label: 'Horas',    value: hours),
          ],
        ),
      ),
    );
  }
}

class _StatItem extends StatelessWidget {
  final String label;
  final String value;
  final Color? accent;
  const _StatItem({required this.label, required this.value, this.accent});

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(label.toUpperCase(),
              style: AppTheme.inter(
                fontSize: 9, fontWeight: FontWeight.w600,
                color: AppColors.ink5, letterSpacing: 0.6)),
          const SizedBox(height: 3),
          Text(value,
              style: AppTheme.inter(
                fontSize: 15, fontWeight: FontWeight.w700,
                color: accent ?? AppColors.ink9, tabular: true)),
        ],
      ),
    );
  }
}

class _Sep extends StatelessWidget {
  const _Sep();
  @override
  Widget build(BuildContext context) =>
      Container(width: 1, height: 26, color: AppColors.ink2);
}

// ── Estados (loading / error / empty) ───────────────────────────────
class _LoadingState extends StatelessWidget {
  const _LoadingState();
  @override
  Widget build(BuildContext context) => Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const SizedBox(
              width: 24, height: 24,
              child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.ink7),
            ),
            const SizedBox(height: 12),
            Text('Cargando rutas…',
                style: AppTheme.inter(fontSize: 13, color: AppColors.ink5)),
          ],
        ),
      );
}

class _ErrorState extends StatelessWidget {
  final VoidCallback onRetry;
  const _ErrorState({required this.onRetry});

  @override
  Widget build(BuildContext context) => Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.error_outline, color: AppColors.noApto, size: 28),
            const SizedBox(height: 10),
            Text('No se pudieron cargar las rutas.',
                style: AppTheme.inter(fontSize: 13, color: AppColors.ink6)),
            const SizedBox(height: 12),
            OutlinedButton(
              onPressed: onRetry,
              style: OutlinedButton.styleFrom(
                foregroundColor: AppColors.ink9,
                side: const BorderSide(color: AppColors.ink2),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(8),
                ),
              ),
              child: Text('Reintentar',
                  style: AppTheme.inter(fontSize: 12, fontWeight: FontWeight.w600)),
            ),
          ],
        ),
      );
}

class _EmptyState extends StatelessWidget {
  const _EmptyState();
  @override
  Widget build(BuildContext context) => Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.alt_route_outlined, size: 36, color: AppColors.ink3),
            const SizedBox(height: 10),
            Text('Sin rutas asignadas hoy.',
                style: AppTheme.inter(fontSize: 14, color: AppColors.ink5)),
            const SizedBox(height: 4),
            Text('Las rutas asignadas por tu empresa aparecerán aquí.',
                textAlign: TextAlign.center,
                style: AppTheme.inter(fontSize: 12, color: AppColors.ink4)),
          ],
        ),
      );
}

// ── Tarjeta de ruta (sobria) ────────────────────────────────────────
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
    final km = entry['km'];

    final (statusColor, statusLabel) = switch (status) {
      'en_ruta'     => (AppColors.info,    'EN RUTA'),
      'cerrado'     => (AppColors.apto,    'CERRADO'),
      'auto_cierre' => (AppColors.riesgo,  'AUTO-CIERRE'),
      'disponible'  => (AppColors.ink6,    'DISPONIBLE'),
      _             => (AppColors.ink5,    status.toUpperCase()),
    };

    final showStart = status == 'disponible';
    final showEnd = status == 'en_ruta';
    final showShare = status == 'en_ruta';

    final plate = (vehicle['plate'] as String? ?? '—').toUpperCase();
    final brandModel = '${vehicle['brand'] ?? ''} ${vehicle['model'] ?? ''}'.trim();

    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: AppColors.ink2),
      ),
      padding: const EdgeInsets.all(14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // ── Encabezado: placa + estado ─────────────────────
          Row(
            children: [
              // Placa estilo pill negro
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
                decoration: BoxDecoration(
                  color: AppColors.ink9,
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Text(plate,
                    style: AppTheme.inter(
                      fontSize: 12, fontWeight: FontWeight.w700,
                      color: Colors.white, letterSpacing: 0.6, tabular: true)),
              ),
              if (brandModel.isNotEmpty) ...[
                const SizedBox(width: 8),
                Flexible(
                  child: Text(brandModel,
                      style: AppTheme.inter(fontSize: 12, color: AppColors.ink6),
                      overflow: TextOverflow.ellipsis),
                ),
              ],
              const Spacer(),
              _StatusChip(label: statusLabel, color: statusColor),
            ],
          ),

          // ── Ruta asignada ──────────────────────────────────
          if (route != null) ...[
            const SizedBox(height: 10),
            Row(
              children: [
                const Icon(Icons.alt_route, size: 14, color: AppColors.ink5),
                const SizedBox(width: 6),
                Expanded(
                  child: Text(
                    '${route['code'] ?? ''} · ${route['name'] ?? ''}',
                    style: AppTheme.inter(
                      fontSize: 12.5, color: AppColors.ink8,
                      fontWeight: FontWeight.w600),
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
              ],
            ),
          ],

          // ── Divisor + métricas ─────────────────────────────
          const SizedBox(height: 12),
          Container(height: 1, color: AppColors.ink1),
          const SizedBox(height: 10),

          Row(
            children: [
              _Metric(
                icon: Icons.login,
                label: 'Salida',
                value: _fmtTime(dep),
              ),
              const SizedBox(width: 14),
              _Metric(
                icon: Icons.logout,
                label: 'Retorno',
                value: _fmtTime(ret),
              ),
              if (km != null) ...[
                const SizedBox(width: 14),
                _Metric(
                  icon: Icons.straighten,
                  label: 'Km',
                  value: (km as num).toStringAsFixed(0),
                ),
              ],
            ],
          ),

          // ── Botones de acción ──────────────────────────────
          if (showStart || showEnd || showShare) ...[
            const SizedBox(height: 12),
            Container(height: 1, color: AppColors.ink1),
            const SizedBox(height: 10),
            Row(
              children: [
                if (showStart)
                  Expanded(
                    child: _SoberButton(
                      label: 'Iniciar recorrido',
                      icon: Icons.play_arrow_rounded,
                      filled: true,
                      bg: AppColors.ink9,
                      fg: Colors.white,
                      loading: isActionLoading,
                      onTap: () => onStartTrip(entryId),
                    ),
                  ),
                if (showEnd) ...[
                  Expanded(
                    child: _SoberButton(
                      label: 'Finalizar',
                      icon: Icons.stop_rounded,
                      filled: false,
                      bg: AppColors.noAptoBg,
                      fg: AppColors.noApto,
                      border: AppColors.noAptoBorder,
                      loading: isActionLoading,
                      onTap: () => onEndTrip(entryId),
                    ),
                  ),
                  const SizedBox(width: 8),
                  _SoberButton(
                    label: 'Actualizar GPS',
                    icon: Icons.my_location,
                    filled: false,
                    bg: Colors.white,
                    fg: AppColors.ink8,
                    border: AppColors.ink2,
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

// ── Chip de estado (outlined + dot) ─────────────────────────────────
class _StatusChip extends StatelessWidget {
  final String label;
  final Color color;
  const _StatusChip({required this.label, required this.color});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: Colors.white,
        border: Border.all(color: color.withValues(alpha: 0.4)),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 6, height: 6,
            decoration: BoxDecoration(
              color: color,
              borderRadius: BorderRadius.circular(3),
            ),
          ),
          const SizedBox(width: 5),
          Text(label,
              style: AppTheme.inter(
                fontSize: 9.5, fontWeight: FontWeight.w700,
                color: color, letterSpacing: 0.5)),
        ],
      ),
    );
  }
}

// ── Métrica inline (icon + label + value) ───────────────────────────
class _Metric extends StatelessWidget {
  final IconData icon;
  final String label;
  final String value;
  const _Metric({required this.icon, required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: 13, color: AppColors.ink5),
        const SizedBox(width: 5),
        Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(label.toUpperCase(),
                style: AppTheme.inter(
                  fontSize: 8.5, fontWeight: FontWeight.w600,
                  color: AppColors.ink5, letterSpacing: 0.6)),
            const SizedBox(height: 1),
            Text(value,
                style: AppTheme.inter(
                  fontSize: 12.5, fontWeight: FontWeight.w700,
                  color: AppColors.ink9, tabular: true)),
          ],
        ),
      ],
    );
  }
}

// ── Botón sobrio (relleno o outlined) ───────────────────────────────
class _SoberButton extends StatelessWidget {
  final String label;
  final IconData icon;
  final bool filled;
  final Color bg;
  final Color fg;
  final Color? border;
  final bool loading;
  final VoidCallback onTap;
  final bool compact;

  const _SoberButton({
    required this.label,
    required this.icon,
    required this.filled,
    required this.bg,
    required this.fg,
    this.border,
    required this.loading,
    required this.onTap,
    this.compact = false,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: loading ? null : onTap,
      child: AnimatedOpacity(
        opacity: loading ? 0.55 : 1.0,
        duration: const Duration(milliseconds: 150),
        child: Container(
          height: 38,
          padding: EdgeInsets.symmetric(horizontal: compact ? 11 : 14),
          decoration: BoxDecoration(
            color: bg,
            border: border != null ? Border.all(color: border!) : null,
            borderRadius: BorderRadius.circular(8),
          ),
          child: loading
              ? Center(
                  child: SizedBox(
                    width: 14, height: 14,
                    child: CircularProgressIndicator(
                      strokeWidth: 2, color: fg),
                  ),
                )
              : Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(icon, size: 15, color: fg),
                    if (!compact) ...[
                      const SizedBox(width: 6),
                      Text(label,
                          style: AppTheme.inter(
                            fontSize: 12.5, fontWeight: FontWeight.w700,
                            color: fg)),
                    ],
                  ],
                ),
        ),
      ),
    );
  }
}
