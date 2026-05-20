import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../shared/widgets/sfit_loading.dart';
import '../../data/datasources/operator_api_service.dart';

/// Listado de pasadas (FleetEntry cerradas) de una ruta para que el operador
/// elija cuál promover a "recomendada".
///
/// Marcar una pasada como recomendada dispara en el backend la reescritura
/// de `Route.waypoints` con los puntos GPS de esa pasada (peso 100%). El
/// próximo conductor que tome la ruta verá ese trazado como oficial.
///
/// Endpoint: `GET /api/rutas/:id/pasadas` (operator_api_service.getRoutePasses).
class OperatorRoutePassesPage extends ConsumerStatefulWidget {
  final String routeId;
  final String? routeName;

  const OperatorRoutePassesPage({
    super.key,
    required this.routeId,
    this.routeName,
  });

  @override
  ConsumerState<OperatorRoutePassesPage> createState() =>
      _OperatorRoutePassesPageState();
}

class _OperatorRoutePassesPageState
    extends ConsumerState<OperatorRoutePassesPage> {
  bool _loading = true;
  String? _busyPassId; // id de la pasada en marcado, '__clear__' para limpiar
  String? _error;
  String? _success;
  List<Map<String, dynamic>> _passes = const [];
  String? _preferredId;
  String? _routeCode;
  String? _routeName;

  @override
  void initState() {
    super.initState();
    _routeName = widget.routeName;
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final svc = ref.read(operatorApiServiceProvider);
      final data = await svc.getRoutePasses(widget.routeId, limit: 30);
      final items = (data['items'] as List?)
              ?.map((e) => Map<String, dynamic>.from(e as Map))
              .toList() ??
          const <Map<String, dynamic>>[];
      final route = data['route'] as Map?;
      if (!mounted) return;
      setState(() {
        _passes = items;
        _preferredId = route?['preferredCaptureId'] as String?;
        _routeCode = route?['code'] as String?;
        _routeName = route?['name'] as String? ?? _routeName;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = 'No se pudieron cargar las pasadas: $e');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _markPreferred(String passId) async {
    setState(() {
      _busyPassId = passId;
      _error = null;
      _success = null;
    });
    try {
      final svc = ref.read(operatorApiServiceProvider);
      await svc.markRoutePreferredCapture(
        widget.routeId,
        captureId: passId,
      );
      if (!mounted) return;
      setState(() {
        _success = 'Pasada marcada como recomendada. '
            'La ruta oficial se actualizó con sus puntos GPS.';
      });
      await _load();
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = 'No se pudo marcar como recomendada: $e');
    } finally {
      if (mounted) setState(() => _busyPassId = null);
    }
  }

  Future<void> _clearPreferred() async {
    setState(() {
      _busyPassId = '__clear__';
      _error = null;
      _success = null;
    });
    try {
      final svc = ref.read(operatorApiServiceProvider);
      await svc.clearRoutePreferredCapture(widget.routeId);
      if (!mounted) return;
      setState(() => _success = 'Override quitado.');
      await _load();
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = 'No se pudo quitar el override: $e');
    } finally {
      if (mounted) setState(() => _busyPassId = null);
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
        leading: IconButton(
          onPressed: () => context.pop(),
          icon: const Icon(Icons.arrow_back, color: AppColors.ink9),
        ),
        title: Text(
          _routeCode != null && _routeName != null
              ? '$_routeCode · $_routeName'
              : 'Pasadas',
          style: AppTheme.inter(
            fontSize: 15,
            fontWeight: FontWeight.w700,
            color: AppColors.ink9,
          ),
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
        ),
        actions: [
          IconButton(
            tooltip: 'Refrescar',
            onPressed: _loading ? null : _load,
            icon: const Icon(Icons.refresh, color: AppColors.ink9),
          ),
        ],
      ),
      body: SafeArea(
        child: _loading
            ? const SfitLoading.page()
            : Column(
                children: [
                  if (_error != null)
                    _BannerMessage(
                      text: _error!,
                      color: AppColors.danger,
                      bg: AppColors.riesgoBg,
                    ),
                  if (_success != null)
                    _BannerMessage(
                      text: _success!,
                      color: AppColors.apto,
                      bg: AppColors.aptoBg,
                    ),
                  if (_preferredId != null)
                    _PreferredHeader(
                      onClear: _busyPassId != null ? null : _clearPreferred,
                      clearing: _busyPassId == '__clear__',
                    ),
                  Expanded(
                    child: _passes.isEmpty
                        ? Center(
                            child: Text(
                              'Esta ruta aún no tiene pasadas cerradas.',
                              style: AppTheme.inter(
                                fontSize: 13,
                                color: AppColors.ink5,
                              ),
                            ),
                          )
                        : ListView.separated(
                            padding: const EdgeInsets.all(12),
                            itemCount: _passes.length,
                            separatorBuilder: (_, __) =>
                                const SizedBox(height: 8),
                            itemBuilder: (_, i) {
                              final p = _passes[i];
                              return _PassCard(
                                pass: p,
                                isBusy: _busyPassId == p['id'],
                                disabled:
                                    _busyPassId != null && _busyPassId != p['id'],
                                onMark: () =>
                                    _markPreferred(p['id'] as String),
                              );
                            },
                          ),
                  ),
                ],
              ),
      ),
    );
  }
}

class _BannerMessage extends StatelessWidget {
  final String text;
  final Color color;
  final Color bg;

  const _BannerMessage({
    required this.text,
    required this.color,
    required this.bg,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      margin: const EdgeInsets.fromLTRB(12, 12, 12, 0),
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: bg,
        border: Border.all(color: color.withValues(alpha: 0.3)),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Text(
        text,
        style: AppTheme.inter(fontSize: 12.5, color: color),
      ),
    );
  }
}

class _PreferredHeader extends StatelessWidget {
  final VoidCallback? onClear;
  final bool clearing;

  const _PreferredHeader({required this.onClear, required this.clearing});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      margin: const EdgeInsets.fromLTRB(12, 12, 12, 0),
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: AppColors.aptoBg,
        border: Border.all(color: AppColors.aptoBorder),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Row(
        children: [
          const Icon(Icons.star, color: AppColors.apto, size: 16),
          const SizedBox(width: 6),
          Expanded(
            child: Text(
              'Hay una pasada marcada como recomendada. '
              'Quitarla NO restaura el promedio convergente automáticamente.',
              style: AppTheme.inter(
                fontSize: 11.5,
                color: AppColors.apto,
              ),
            ),
          ),
          const SizedBox(width: 6),
          TextButton.icon(
            onPressed: onClear,
            icon: clearing
                ? const SizedBox(
                    width: 12,
                    height: 12,
                    child: SfitLoading.inline(strokeWidth: 1.5),
                  )
                : const Icon(Icons.close, size: 14),
            label: const Text('Quitar'),
            style: TextButton.styleFrom(
              foregroundColor: AppColors.apto,
              padding: const EdgeInsets.symmetric(horizontal: 8),
              minimumSize: const Size(0, 28),
              tapTargetSize: MaterialTapTargetSize.shrinkWrap,
            ),
          ),
        ],
      ),
    );
  }
}

class _PassCard extends StatelessWidget {
  final Map<String, dynamic> pass;
  final bool isBusy;
  final bool disabled;
  final VoidCallback onMark;

  const _PassCard({
    required this.pass,
    required this.isBusy,
    required this.disabled,
    required this.onMark,
  });

  @override
  Widget build(BuildContext context) {
    final isPreferred = pass['isPreferred'] == true;
    final isBest = pass['isBest'] == true;
    final score = pass['score'];
    final score100 =
        score is num ? (score.toDouble() * 100).round() : null;
    final driverName =
        (pass['driver'] as Map?)?['name'] as String? ?? 'Conductor desconocido';
    final plate = (pass['vehicle'] as Map?)?['plate'] as String?;
    final numPings = pass['numPings'] as int? ?? 0;
    final distanceMeters = pass['distanceMeters'] as num?;
    final durationSeconds = pass['durationSeconds'] as int?;
    final date = pass['date'] as String?;

    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: isPreferred ? AppColors.aptoBg : Colors.white,
        border: Border.all(
          color: isPreferred ? AppColors.aptoBorder : AppColors.ink2,
        ),
        borderRadius: BorderRadius.circular(10),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              if (isPreferred)
                const _Badge(
                  label: 'RECOMENDADA',
                  color: Colors.white,
                  bg: AppColors.apto,
                  icon: Icons.star,
                )
              else if (isBest)
                const _Badge(
                  label: 'MEJOR AUTO',
                  color: AppColors.riesgo,
                  bg: AppColors.riesgoBg,
                  icon: Icons.auto_awesome,
                ),
              const SizedBox(width: 6),
              if (score100 != null) _ScorePill(score: score100),
              const Spacer(),
              if (date != null)
                Text(
                  date.substring(0, 10),
                  style: AppTheme.inter(
                    fontSize: 11,
                    color: AppColors.ink5,
                  ),
                ),
            ],
          ),
          const SizedBox(height: 8),
          Text(
            driverName,
            style: AppTheme.inter(
              fontSize: 13,
              fontWeight: FontWeight.w600,
              color: AppColors.ink9,
            ),
          ),
          if (plate != null)
            Text(
              plate,
              style: AppTheme.inter(
                fontSize: 11.5,
                color: AppColors.ink6,
              ),
            ),
          const SizedBox(height: 6),
          Wrap(
            spacing: 12,
            runSpacing: 4,
            children: [
              _Stat(icon: Icons.timeline, value: '$numPings pings'),
              if (distanceMeters != null)
                _Stat(
                  icon: Icons.straighten,
                  value: distanceMeters >= 1000
                      ? '${(distanceMeters / 1000).toStringAsFixed(2)} km'
                      : '${distanceMeters.round()} m',
                ),
              if (durationSeconds != null)
                _Stat(
                  icon: Icons.timer,
                  value: _formatDuration(durationSeconds),
                ),
            ],
          ),
          if (!isPreferred) ...[
            const SizedBox(height: 10),
            SizedBox(
              width: double.infinity,
              child: FilledButton.icon(
                onPressed: disabled ? null : onMark,
                icon: isBusy
                    ? const SizedBox(
                        width: 14,
                        height: 14,
                        child: SfitLoading.inline(strokeWidth: 1.5, color: Colors.white),
                      )
                    : const Icon(Icons.star, size: 16),
                label: const Text('Marcar como recomendada'),
                style: FilledButton.styleFrom(
                  backgroundColor: AppColors.ink9,
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(vertical: 10),
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }

  static String _formatDuration(int seconds) {
    final m = seconds ~/ 60;
    final s = seconds % 60;
    if (m < 60) return '$m:${s.toString().padLeft(2, '0')}';
    final h = m ~/ 60;
    return '${h}h ${(m % 60).toString().padLeft(2, '0')}m';
  }
}

class _Badge extends StatelessWidget {
  final String label;
  final Color color;
  final Color bg;
  final IconData icon;

  const _Badge({
    required this.label,
    required this.color,
    required this.bg,
    required this.icon,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(4),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 10, color: color),
          const SizedBox(width: 3),
          Text(
            label,
            style: AppTheme.inter(
              fontSize: 9.5,
              fontWeight: FontWeight.w700,
              color: color,
              letterSpacing: 0.4,
            ),
          ),
        ],
      ),
    );
  }
}

class _ScorePill extends StatelessWidget {
  final int score;

  const _ScorePill({required this.score});

  @override
  Widget build(BuildContext context) {
    final color = score >= 80
        ? AppColors.apto
        : score >= 60
            ? AppColors.riesgo
            : AppColors.noApto;
    final bg = score >= 80
        ? AppColors.aptoBg
        : score >= 60
            ? AppColors.riesgoBg
            : AppColors.riesgoBg;

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
      decoration: BoxDecoration(
        color: bg,
        border: Border.all(color: color.withValues(alpha: 0.3)),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        '$score/100',
        style: AppTheme.inter(
          fontSize: 10,
          fontWeight: FontWeight.w700,
          color: color,
        ),
      ),
    );
  }
}

class _Stat extends StatelessWidget {
  final IconData icon;
  final String value;

  const _Stat({required this.icon, required this.value});

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: 11, color: AppColors.ink5),
        const SizedBox(width: 3),
        Text(
          value,
          style: AppTheme.inter(
            fontSize: 11,
            color: AppColors.ink6,
          ),
        ),
      ],
    );
  }
}
