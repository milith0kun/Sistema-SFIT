import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:geolocator/geolocator.dart';
import '../../../../core/services/battery_optimization_service.dart';
import '../../../../core/services/location_tracking_service.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_theme.dart';

/// Pantalla técnica de diagnóstico del tracking GPS.
///
/// Pensada para soporte y debugging post-mortem cuando el conductor
/// reporta "el trazo salió raro". Muestra todos los counters internos
/// que el `TrackingHealthCard` resume con un semáforo. Acceso: long-press
/// del card en cualquier estado.
///
/// Las métricas se leen del provider `locationTrackingProvider` que ya
/// las expone vía `TrackingState`. Acciones disponibles:
/// - Forzar bulk upload del track persistido en Hive (`location_track_v2`).
/// - Verificar y configurar battery optimization.
/// - Abrir settings de ubicación del sistema.
class TrackingDiagnosticsPage extends ConsumerStatefulWidget {
  const TrackingDiagnosticsPage({super.key});

  @override
  ConsumerState<TrackingDiagnosticsPage> createState() =>
      _TrackingDiagnosticsPageState();
}

class _TrackingDiagnosticsPageState
    extends ConsumerState<TrackingDiagnosticsPage> {
  bool _isExempt = false;
  bool _busy = false;

  @override
  void initState() {
    super.initState();
    _refreshBatteryStatus();
  }

  Future<void> _refreshBatteryStatus() async {
    final exempt = await BatteryOptimizationService.instance.isExempt();
    if (!mounted) return;
    setState(() => _isExempt = exempt);
  }

  Future<void> _forceBulkUpload() async {
    final entryId = ref.read(locationTrackingProvider).entryId;
    if (entryId == null) {
      _snack('No hay turno activo para subir track.');
      return;
    }
    setState(() => _busy = true);
    try {
      final inserted = await ref
          .read(locationTrackingProvider.notifier)
          .bulkUploadTrack(entryId);
      if (mounted) _snack('Bulk upload: $inserted puntos insertados.');
    } catch (e) {
      if (mounted) _snack('Falló el bulk: $e');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  void _snack(String msg) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(msg), behavior: SnackBarBehavior.floating),
    );
  }

  @override
  Widget build(BuildContext context) {
    final s = ref.watch(locationTrackingProvider);
    return Scaffold(
      appBar: AppBar(
        title: const Text('Diagnóstico de tracking'),
      ),
      body: SafeArea(
        child: RefreshIndicator(
          onRefresh: () async {
            await _refreshBatteryStatus();
            ref.invalidate(locationTrackingProvider);
          },
          child: ListView(
            padding: const EdgeInsets.all(16),
            children: [
              _Section(
                title: 'Estado actual',
                children: [
                  _KV('Tracking activo', s.isTracking ? 'Sí' : 'No'),
                  _KV('Turno (entryId)', s.entryId ?? '—'),
                  _KV(
                    'Última posición',
                    s.currentPosition != null
                        ? '${s.currentPosition!.latitude.toStringAsFixed(5)}, '
                            '${s.currentPosition!.longitude.toStringAsFixed(5)}'
                        : '—',
                  ),
                  _KV(
                    'Accuracy actual',
                    s.currentAccuracy != null
                        ? '${s.currentAccuracy!.toStringAsFixed(1)} m'
                        : '—',
                  ),
                ],
              ),
              const SizedBox(height: 12),
              _Section(
                title: 'Cola offline',
                children: [
                  _KV('Pings pendientes (queue)', '${s.queuedPoints}'),
                  _KV('Descartados por overflow', '${s.droppedByOverflow}'),
                  _KV('Descartados por accuracy >100m',
                      '${s.discardedLowAccuracy}'),
                  _KV('Fallos consecutivos del drain',
                      '${s.consecutiveFailures}'),
                  _KV(
                    'Último envío exitoso',
                    s.lastSuccessfulSend != null
                        ? _formatRelative(s.lastSuccessfulSend!)
                        : 'Nunca',
                  ),
                ],
              ),
              const SizedBox(height: 12),
              _Section(
                title: 'Sistema',
                children: [
                  _KV('Plataforma', Platform.operatingSystem),
                  _KV('Versión', Platform.operatingSystemVersion),
                  _KV(
                    'Battery optimization',
                    _isExempt ? 'Excluida ✓' : 'Activa (riesgo)',
                  ),
                  _KV(
                    'Turno interrumpido detectado',
                    s.wasInterrupted ? 'Sí' : 'No',
                  ),
                ],
              ),
              const SizedBox(height: 16),
              _Section(
                title: 'Acciones',
                children: [
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: [
                      OutlinedButton.icon(
                        onPressed: _busy ? null : _forceBulkUpload,
                        icon: const Icon(Icons.upload, size: 16),
                        label: const Text('Forzar bulk upload'),
                      ),
                      OutlinedButton.icon(
                        onPressed: _busy
                            ? null
                            : () async {
                                await ref
                                    .read(locationTrackingProvider.notifier)
                                    .flushQueue();
                                _snack('Forzando drain de cola…');
                              },
                        icon: const Icon(Icons.cloud_sync_outlined, size: 16),
                        label: const Text('Forzar drain'),
                      ),
                      OutlinedButton.icon(
                        onPressed: _busy
                            ? null
                            : () async {
                                await BatteryOptimizationService.instance
                                    .requestExemption();
                                await _refreshBatteryStatus();
                              },
                        icon: const Icon(Icons.battery_charging_full, size: 16),
                        label: const Text('Configurar batería'),
                      ),
                      OutlinedButton.icon(
                        onPressed: _busy
                            ? null
                            : () async {
                                await BatteryOptimizationService.instance
                                    .openManufacturerSettings();
                              },
                        icon: const Icon(Icons.android, size: 16),
                        label: const Text('Apps protegidas (OEM)'),
                      ),
                      OutlinedButton.icon(
                        onPressed: () => Geolocator.openLocationSettings(),
                        icon: const Icon(Icons.location_on_outlined, size: 16),
                        label: const Text('Ajustes GPS'),
                      ),
                      OutlinedButton.icon(
                        onPressed: () => Geolocator.openAppSettings(),
                        icon: const Icon(Icons.settings, size: 16),
                        label: const Text('Permisos de la app'),
                      ),
                    ],
                  ),
                ],
              ),
              const SizedBox(height: 24),
              Text(
                'Estos datos son útiles para soporte técnico. Si reportás un '
                'problema con tu trazo, mostranos esta pantalla.',
                style: AppTheme.inter(
                  fontSize: 11.5,
                  color: AppColors.ink6,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  String _formatRelative(DateTime t) {
    final diff = DateTime.now().difference(t);
    if (diff.inSeconds < 60) return 'hace ${diff.inSeconds}s';
    if (diff.inMinutes < 60) return 'hace ${diff.inMinutes} min';
    if (diff.inHours < 24) return 'hace ${diff.inHours} h';
    return 'hace ${diff.inDays} d';
  }
}

class _Section extends StatelessWidget {
  final String title;
  final List<Widget> children;
  const _Section({required this.title, required this.children});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.ink2),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            title.toUpperCase(),
            style: AppTheme.inter(
              fontSize: 11,
              fontWeight: FontWeight.w800,
              color: AppColors.ink5,
              letterSpacing: 0.8,
            ),
          ),
          const SizedBox(height: 8),
          ...children,
        ],
      ),
    );
  }
}

class _KV extends StatelessWidget {
  final String k;
  final String v;
  const _KV(this.k, this.v);

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            flex: 5,
            child: Text(
              k,
              style: AppTheme.inter(fontSize: 12.5, color: AppColors.ink6),
            ),
          ),
          Expanded(
            flex: 6,
            child: Text(
              v,
              style: AppTheme.inter(
                fontSize: 12.5,
                fontWeight: FontWeight.w700,
                color: AppColors.ink9,
              ),
              textAlign: TextAlign.end,
            ),
          ),
        ],
      ),
    );
  }
}
