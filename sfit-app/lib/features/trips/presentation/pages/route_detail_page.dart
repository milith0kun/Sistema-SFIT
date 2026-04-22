import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/network/dio_client.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../shared/widgets/widgets.dart';

/// RF-09: Detalle de ruta asignada al conductor.
class RouteDetailPage extends ConsumerStatefulWidget {
  final String routeId;
  final String routeName;

  const RouteDetailPage({
    super.key,
    required this.routeId,
    required this.routeName,
  });

  @override
  ConsumerState<RouteDetailPage> createState() => _RouteDetailPageState();
}

class _RouteDetailPageState extends ConsumerState<RouteDetailPage> {
  Map<String, dynamic>? _route;
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final dio = ref.read(dioClientProvider).dio;
      final resp = await dio.get('/rutas/${widget.routeId}');
      final body = resp.data as Map<String, dynamic>;
      // Soporta { data: {...} } o respuesta directa
      final data = body['data'] as Map<String, dynamic>? ?? body;
      if (mounted) {
        setState(() {
          _route = data;
          _loading = false;
        });
      }
    } catch (_) {
      if (mounted) {
        setState(() {
          _error = 'No se pudo cargar el detalle de la ruta.';
          _loading = false;
        });
      }
    }
  }

  // Convierte el valor de "status" del API al enum SfitStatus
  SfitStatus _parseStatus(String? raw) {
    switch ((raw ?? '').toLowerCase()) {
      case 'activa':
      case 'activo':
      case 'active':
        return SfitStatus.activo;
      case 'en_ruta':
      case 'en ruta':
        return SfitStatus.enRuta;
      case 'inactiva':
      case 'inactivo':
      case 'inactive':
        return SfitStatus.inactivo;
      case 'suspendida':
      case 'suspendido':
        return SfitStatus.suspendido;
      default:
        return SfitStatus.activo;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(widget.routeName),
        leading: const BackButton(),
      ),
      body: _buildBody(),
    );
  }

  Widget _buildBody() {
    if (_loading) {
      return const Center(
        child: CircularProgressIndicator(color: AppColors.gold),
      );
    }

    if (_error != null) {
      return _ErrorState(message: _error!, onRetry: _load);
    }

    final route = _route!;
    final name        = route['name']        as String? ?? widget.routeName;
    final origin      = route['origin']      as String? ?? '—';
    final destination = route['destination'] as String? ?? '—';
    final statusRaw   = route['status']      as String?;
    final schedule    = route['schedule']    as String? ?? '—';
    final rawStops    = route['stops'];
    final stops = rawStops is List
        ? rawStops.cast<dynamic>().map((s) => s.toString()).toList()
        : <String>[];

    final sfitStatus = _parseStatus(statusRaw);
    final statusLabel = statusRaw ?? 'activa';

    return RefreshIndicator(
      onRefresh: _load,
      color: AppColors.gold,
      child: SingleChildScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // ── Hero card ─────────────────────────────────────────
            SfitHeroCard(
              kicker: 'MIS RUTAS',
              title: name,
              rfCode: 'RF-09',
              pills: [
                SfitHeroPill(label: 'Estado', value: statusLabel),
                SfitHeroPill(label: 'Horario', value: schedule),
              ],
            ),
            const SizedBox(height: 20),

            // ── Origen → Destino ──────────────────────────────────
            _SectionCard(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Row(
                  children: [
                    // Origen
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'ORIGEN',
                            style: AppTheme.inter(
                              fontSize: 10,
                              fontWeight: FontWeight.w700,
                              color: AppColors.ink4,
                              letterSpacing: 1.4,
                            ),
                          ),
                          const SizedBox(height: 4),
                          Row(
                            children: [
                              const Icon(
                                Icons.radio_button_checked,
                                size: 16,
                                color: AppColors.apto,
                              ),
                              const SizedBox(width: 6),
                              Expanded(
                                child: Text(
                                  origin,
                                  style: AppTheme.inter(
                                    fontSize: 13,
                                    fontWeight: FontWeight.w700,
                                    color: AppColors.ink9,
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),

                    // Flecha central
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 8),
                      child: Column(
                        children: [
                          const SizedBox(height: 16),
                          Container(
                            padding: const EdgeInsets.all(6),
                            decoration: BoxDecoration(
                              color: AppColors.goldBg,
                              border: Border.all(color: AppColors.goldBorder),
                              shape: BoxShape.circle,
                            ),
                            child: const Icon(
                              Icons.arrow_forward,
                              size: 14,
                              color: AppColors.goldDark,
                            ),
                          ),
                        ],
                      ),
                    ),

                    // Destino
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.end,
                        children: [
                          Text(
                            'DESTINO',
                            style: AppTheme.inter(
                              fontSize: 10,
                              fontWeight: FontWeight.w700,
                              color: AppColors.ink4,
                              letterSpacing: 1.4,
                            ),
                            textAlign: TextAlign.end,
                          ),
                          const SizedBox(height: 4),
                          Row(
                            mainAxisAlignment: MainAxisAlignment.end,
                            children: [
                              Expanded(
                                child: Text(
                                  destination,
                                  textAlign: TextAlign.end,
                                  style: AppTheme.inter(
                                    fontSize: 13,
                                    fontWeight: FontWeight.w700,
                                    color: AppColors.ink9,
                                  ),
                                ),
                              ),
                              const SizedBox(width: 6),
                              const Icon(
                                Icons.location_on,
                                size: 16,
                                color: AppColors.noApto,
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 16),

            // ── Estado y horario ──────────────────────────────────
            _SectionCard(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Row(
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'ESTADO DE LA RUTA',
                            style: AppTheme.inter(
                              fontSize: 10,
                              fontWeight: FontWeight.w700,
                              color: AppColors.ink4,
                              letterSpacing: 1.4,
                            ),
                          ),
                          const SizedBox(height: 8),
                          SfitStatusPill(
                            status: sfitStatus,
                            label: statusLabel,
                          ),
                        ],
                      ),
                    ),
                    Container(
                      width: 1,
                      height: 44,
                      color: AppColors.ink2,
                    ),
                    const SizedBox(width: 16),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'HORARIO',
                            style: AppTheme.inter(
                              fontSize: 10,
                              fontWeight: FontWeight.w700,
                              color: AppColors.ink4,
                              letterSpacing: 1.4,
                            ),
                          ),
                          const SizedBox(height: 8),
                          Row(
                            children: [
                              const Icon(
                                Icons.schedule,
                                size: 15,
                                color: AppColors.gold,
                              ),
                              const SizedBox(width: 6),
                              Expanded(
                                child: Text(
                                  schedule,
                                  style: AppTheme.inter(
                                    fontSize: 13,
                                    fontWeight: FontWeight.w700,
                                    color: AppColors.ink9,
                                    tabular: true,
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 16),

            // ── Paradas intermedias ───────────────────────────────
            if (stops.isNotEmpty) ...[
              Text(
                'Paradas intermedias',
                style: AppTheme.inter(
                  fontSize: 15,
                  fontWeight: FontWeight.w700,
                  color: AppColors.ink9,
                ),
              ),
              const SizedBox(height: 8),
              _SectionCard(
                child: Column(
                  children: [
                    for (int i = 0; i < stops.length; i++) ...[
                      if (i > 0)
                        const Divider(height: 1, color: AppColors.ink1),
                      _StopTile(index: i + 1, name: stops[i]),
                    ],
                  ],
                ),
              ),
            ] else ...[
              _SectionCard(
                child: Padding(
                  padding: const EdgeInsets.all(20),
                  child: Row(
                    children: [
                      const Icon(
                        Icons.info_outline,
                        size: 18,
                        color: AppColors.ink4,
                      ),
                      const SizedBox(width: 10),
                      Text(
                        'Sin paradas intermedias registradas',
                        style: AppTheme.inter(
                          fontSize: 13,
                          color: AppColors.ink5,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

// ── Parada en la lista ─────────────────────────────────────────────────────────
class _StopTile extends StatelessWidget {
  final int index;
  final String name;
  const _StopTile({required this.index, required this.name});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      child: Row(
        children: [
          Container(
            width: 26,
            height: 26,
            decoration: BoxDecoration(
              color: AppColors.goldBg,
              border: Border.all(color: AppColors.goldBorder),
              shape: BoxShape.circle,
            ),
            alignment: Alignment.center,
            child: Text(
              '$index',
              style: AppTheme.inter(
                fontSize: 11,
                fontWeight: FontWeight.w800,
                color: AppColors.goldDark,
                tabular: true,
              ),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              name,
              style: AppTheme.inter(
                fontSize: 13,
                fontWeight: FontWeight.w500,
                color: AppColors.ink8,
              ),
            ),
          ),
          const Icon(Icons.place_outlined, size: 16, color: AppColors.ink4),
        ],
      ),
    );
  }
}

// ── Card contenedor genérico ───────────────────────────────────────────────────
class _SectionCard extends StatelessWidget {
  final Widget child;
  const _SectionCard({required this.child});

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        border: Border.all(color: AppColors.ink2),
        borderRadius: BorderRadius.circular(12),
      ),
      child: child,
    );
  }
}

// ── Estado de error ────────────────────────────────────────────────────────────
class _ErrorState extends StatelessWidget {
  final String message;
  final VoidCallback onRetry;
  const _ErrorState({required this.message, required this.onRetry});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(
              Icons.error_outline,
              size: 44,
              color: AppColors.noApto,
            ),
            const SizedBox(height: 12),
            Text(
              message,
              textAlign: TextAlign.center,
              style: AppTheme.inter(fontSize: 13, color: AppColors.ink6),
            ),
            const SizedBox(height: 16),
            FilledButton.icon(
              onPressed: onRetry,
              icon: const Icon(Icons.refresh, size: 18),
              label: const Text('Reintentar'),
              style: FilledButton.styleFrom(
                backgroundColor: AppColors.gold,
                minimumSize: const Size(160, 44),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
