import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import '../../../../core/network/dio_client.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/widgets/sfit_loading.dart';
import '../../../fleet/data/models/fleet_entry_model.dart';

// ── Modelos locales ───────────────────────────────────────────────────────────

class _DriverStats {
  final String driverId;
  final String driverName;
  final String currentStatus;
  final double totalKm;
  final double totalHours;
  final int trips;

  const _DriverStats({
    required this.driverId,
    required this.driverName,
    required this.currentStatus,
    required this.totalKm,
    required this.totalHours,
    required this.trips,
  });
}

class _MonthSummary {
  final double totalKm;
  final double avgKmPerVehicle;
  final String mostActiveVehicle;
  final int totalTrips;
  final int activeVehicles;

  const _MonthSummary({
    required this.totalKm,
    required this.avgKmPerVehicle,
    required this.mostActiveVehicle,
    required this.totalTrips,
    required this.activeVehicles,
  });
}

// ── Página principal ──────────────────────────────────────────────────────────

/// Análisis de flota del mes — rol OPERADOR.
/// Carga hasta 200 entradas de flota de los últimos 30 días y calcula
/// métricas localmente: km totales, promedio por vehículo, vehículo más activo
/// y tabla de conductores.
class FleetAnalyticsPage extends ConsumerStatefulWidget {
  const FleetAnalyticsPage({super.key});

  @override
  ConsumerState<FleetAnalyticsPage> createState() => _FleetAnalyticsPageState();
}

class _FleetAnalyticsPageState extends ConsumerState<FleetAnalyticsPage> {
  bool _loading = true;
  String? _error;
  _MonthSummary? _summary;
  List<_DriverStats> _drivers = [];

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) { if (mounted) _load(); });
  }

  Future<void> _load() async {
    setState(() { _loading = true; _error = null; });
    try {
      final dio = ref.read(dioClientProvider).dio;
      final now   = DateTime.now();
      final desde = now.subtract(const Duration(days: 30));
      final fmt   = DateFormat('yyyy-MM-dd');

      final resp = await dio.get('/flota', queryParameters: {
        'limit': 200,
        'desde': fmt.format(desde),
        'hasta': fmt.format(now),
      });

      final raw  = (resp.data as Map)['data'] as Map;
      final list = (raw['items'] as List? ?? [])
          .map((e) => FleetEntryModel.fromJson(e as Map<String, dynamic>))
          .toList();

      _compute(list);
    } catch (e) {
      if (mounted) {
        setState(() {
          _error = 'No se pudieron cargar los datos de flota.';
          _loading = false;
        });
      }
    }
  }

  void _compute(List<FleetEntryModel> entries) {
    if (!mounted) return;

    // ── Por vehículo ──────────────────────────────────────────────
    final Map<String, double>  kmByVehicle    = {};
    final Map<String, String>  plateByVehicle = {};

    // ── Por conductor ─────────────────────────────────────────────
    final Map<String, double>  kmByDriver     = {};
    final Map<String, double>  hoursByDriver  = {};
    final Map<String, String>  nameByDriver   = {};
    final Map<String, String>  statusByDriver = {};
    final Map<String, int>     tripsByDriver  = {};

    for (final e in entries) {
      final vid = e.vehicle.id;
      kmByVehicle[vid]    = (kmByVehicle[vid] ?? 0) + e.km;
      plateByVehicle[vid] = e.vehicle.plate;

      final did = e.driver.id;
      kmByDriver[did]    = (kmByDriver[did] ?? 0) + e.km;
      nameByDriver[did]  = e.driver.name;
      statusByDriver[did] = e.driver.status;
      tripsByDriver[did]  = (tripsByDriver[did] ?? 0) + 1;

      // Horas: si hay departure + return time, calcula duración
      if (e.departureTime != null && e.returnTime != null) {
        try {
          final dep = DateTime.parse(e.departureTime!);
          final ret = DateTime.parse(e.returnTime!);
          final hrs = ret.difference(dep).inMinutes / 60.0;
          hoursByDriver[did] = (hoursByDriver[did] ?? 0) + hrs;
        } catch (_) {}
      }
    }

    // Vehículo más activo
    String mostActive = '—';
    if (kmByVehicle.isNotEmpty) {
      final topId = kmByVehicle.entries
          .reduce((a, b) => a.value > b.value ? a : b)
          .key;
      mostActive = plateByVehicle[topId] ?? topId;
    }

    final totalKm   = kmByVehicle.values.fold(0.0, (a, b) => a + b);
    final avgKm     = kmByVehicle.isEmpty
        ? 0.0
        : totalKm / kmByVehicle.length;

    final drivers = kmByDriver.entries.map((e) => _DriverStats(
      driverId:      e.key,
      driverName:    nameByDriver[e.key] ?? e.key,
      currentStatus: statusByDriver[e.key] ?? 'apto',
      totalKm:       e.value,
      totalHours:    hoursByDriver[e.key] ?? 0,
      trips:         tripsByDriver[e.key] ?? 0,
    )).toList()
      ..sort((a, b) => b.totalKm.compareTo(a.totalKm));

    setState(() {
      _summary = _MonthSummary(
        totalKm: totalKm,
        avgKmPerVehicle: avgKm,
        mostActiveVehicle: mostActive,
        totalTrips: entries.length,
        activeVehicles: kmByVehicle.length,
      );
      _drivers = drivers;
      _loading = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // ── Header ────────────────────────────────────────────────
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 4),
            child: Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('Análisis de Flota',
                          style: AppTheme.inter(
                            fontSize: 18, fontWeight: FontWeight.w700,
                            color: AppColors.ink9, letterSpacing: -0.3,
                          )),
                      Text('Últimos 30 días',
                          style: AppTheme.inter(fontSize: 12, color: AppColors.ink5)),
                    ],
                  ),
                ),
                IconButton(
                  icon: const Icon(Icons.refresh_outlined,
                      color: AppColors.ink5, size: 20),
                  tooltip: 'Actualizar',
                  onPressed: _loading ? null : _load,
                ),
              ],
            ),
          ),

          Expanded(
            child: _loading
                ? const SfitLoading(message: 'Calculando métricas…')
                : _error != null
                    ? _ErrorView(message: _error!, onRetry: _load)
                    : RefreshIndicator(
                        onRefresh: _load,
                        color: AppColors.gold,
                        child: ListView(
                          padding:
                              const EdgeInsets.fromLTRB(16, 8, 16, 32),
                          children: [
                            if (_summary != null)
                              _SummarySection(summary: _summary!),
                            const SizedBox(height: 20),
                            _DriversTable(drivers: _drivers),
                          ],
                        ),
                      ),
          ),
        ],
      ),
    );
  }
}

// ── Sección de resumen KPI ────────────────────────────────────────────────────

class _SummarySection extends StatelessWidget {
  final _MonthSummary summary;
  const _SummarySection({required this.summary});

  @override
  Widget build(BuildContext context) {
    final fmt = NumberFormat('#,##0.0', 'es');
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('Resumen del mes',
            style: AppTheme.inter(
              fontSize: 13, fontWeight: FontWeight.w700,
              color: AppColors.ink7, letterSpacing: 0.4,
            )),
        const SizedBox(height: 10),

        // Primera fila: km totales + promedio
        Row(children: [
          Expanded(
            child: _KpiCard(
              icon: Icons.route_outlined,
              label: 'Km totales',
              value: '${fmt.format(summary.totalKm)} km',
              accent: AppColors.info,
              bg: AppColors.infoBg,
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: _KpiCard(
              icon: Icons.bar_chart_outlined,
              label: 'Prom. por vehículo',
              value: '${fmt.format(summary.avgKmPerVehicle)} km',
              accent: AppColors.apto,
              bg: AppColors.aptoBg,
            ),
          ),
        ]),
        const SizedBox(height: 10),

        // Segunda fila: vehículo más activo + viajes totales
        Row(children: [
          Expanded(
            child: _KpiCard(
              icon: Icons.emoji_events_outlined,
              label: 'Más activo',
              value: summary.mostActiveVehicle,
              accent: AppColors.goldDark,
              bg: AppColors.goldBg,
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: _KpiCard(
              icon: Icons.directions_car_outlined,
              label: 'Vehículos activos',
              value: '${summary.activeVehicles}',
              accent: AppColors.riesgo,
              bg: AppColors.riesgoBg,
            ),
          ),
        ]),
      ],
    );
  }
}

class _KpiCard extends StatelessWidget {
  final IconData icon;
  final String label;
  final String value;
  final Color accent;
  final Color bg;

  const _KpiCard({
    required this.icon,
    required this.label,
    required this.value,
    required this.accent,
    required this.bg,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: accent.withValues(alpha: 0.25)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, size: 18, color: accent),
          const SizedBox(height: 6),
          Text(value,
              style: AppTheme.inter(
                fontSize: 16, fontWeight: FontWeight.w800,
                color: accent, tabular: true,
              ),
              maxLines: 1,
              overflow: TextOverflow.ellipsis),
          Text(label,
              style: AppTheme.inter(fontSize: 11, color: accent.withValues(alpha: 0.8))),
        ],
      ),
    );
  }
}

// ── Tabla de conductores ──────────────────────────────────────────────────────

class _DriversTable extends StatelessWidget {
  final List<_DriverStats> drivers;
  const _DriversTable({required this.drivers});

  @override
  Widget build(BuildContext context) {
    if (drivers.isEmpty) {
      return Container(
        padding: const EdgeInsets.all(24),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: AppColors.ink2),
        ),
        child: Column(
          children: [
            const Icon(Icons.groups_2_outlined, size: 40, color: AppColors.ink3),
            const SizedBox(height: 10),
            Text('Sin datos de conductores',
                style: AppTheme.inter(fontSize: 14, color: AppColors.ink5)),
          ],
        ),
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('Conductores del período',
            style: AppTheme.inter(
              fontSize: 13, fontWeight: FontWeight.w700,
              color: AppColors.ink7, letterSpacing: 0.4,
            )),
        const SizedBox(height: 10),
        Container(
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(10),
            border: Border.all(color: AppColors.ink2),
          ),
          child: Column(
            children: [
              // Cabecera
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                decoration: const BoxDecoration(
                  color: AppColors.ink1,
                  borderRadius: BorderRadius.only(
                    topLeft: Radius.circular(9),
                    topRight: Radius.circular(9),
                  ),
                ),
                child: Row(
                  children: [
                    Expanded(
                      flex: 3,
                      child: Text('Conductor',
                          style: AppTheme.inter(
                            fontSize: 11, fontWeight: FontWeight.w700,
                            color: AppColors.ink6, letterSpacing: 0.5,
                          )),
                    ),
                    Expanded(
                      child: Text('Horas',
                          style: AppTheme.inter(
                            fontSize: 11, fontWeight: FontWeight.w700,
                            color: AppColors.ink6, letterSpacing: 0.5,
                          ),
                          textAlign: TextAlign.right),
                    ),
                    Expanded(
                      child: Text('Km',
                          style: AppTheme.inter(
                            fontSize: 11, fontWeight: FontWeight.w700,
                            color: AppColors.ink6, letterSpacing: 0.5,
                          ),
                          textAlign: TextAlign.right),
                    ),
                    const SizedBox(width: 70), // Estado
                  ],
                ),
              ),
              // Filas
              ...drivers.asMap().entries.map((e) {
                final isLast = e.key == drivers.length - 1;
                return _DriverRow(stats: e.value, isLast: isLast);
              }),
            ],
          ),
        ),
      ],
    );
  }
}

class _DriverRow extends StatelessWidget {
  final _DriverStats stats;
  final bool isLast;

  const _DriverRow({required this.stats, required this.isLast});

  @override
  Widget build(BuildContext context) {
    final fmt = NumberFormat('#,##0.0', 'es');
    final (statusColor, statusBg, statusLabel) = switch (stats.currentStatus) {
      'apto'    => (AppColors.apto,   AppColors.aptoBg,   'APTO'),
      'riesgo'  => (AppColors.riesgo, AppColors.riesgoBg, 'RIESGO'),
      _         => (AppColors.noApto, AppColors.noAptoBg, 'NO APTO'),
    };

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        border: isLast
            ? null
            : const Border(bottom: BorderSide(color: AppColors.ink2)),
      ),
      child: Row(
        children: [
          Expanded(
            flex: 3,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(stats.driverName,
                    style: AppTheme.inter(
                      fontSize: 13, fontWeight: FontWeight.w600,
                      color: AppColors.ink9,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis),
                Text('${stats.trips} viaje${stats.trips == 1 ? '' : 's'}',
                    style: AppTheme.inter(fontSize: 11, color: AppColors.ink5)),
              ],
            ),
          ),
          Expanded(
            child: Text(
              '${fmt.format(stats.totalHours)}h',
              style: AppTheme.inter(
                fontSize: 12, fontWeight: FontWeight.w700,
                color: AppColors.ink7, tabular: true,
              ),
              textAlign: TextAlign.right,
            ),
          ),
          Expanded(
            child: Text(
              fmt.format(stats.totalKm),
              style: AppTheme.inter(
                fontSize: 12, fontWeight: FontWeight.w700,
                color: AppColors.ink7, tabular: true,
              ),
              textAlign: TextAlign.right,
            ),
          ),
          const SizedBox(width: 8),
          Container(
            width: 62,
            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 3),
            decoration: BoxDecoration(
              color: statusBg,
              borderRadius: BorderRadius.circular(4),
            ),
            child: Text(
              statusLabel,
              style: AppTheme.inter(
                fontSize: 9, fontWeight: FontWeight.w700,
                color: statusColor, letterSpacing: 0.3,
              ),
              textAlign: TextAlign.center,
            ),
          ),
        ],
      ),
    );
  }
}

// ── Estado de error ───────────────────────────────────────────────────────────

class _ErrorView extends StatelessWidget {
  final String message;
  final VoidCallback onRetry;
  const _ErrorView({required this.message, required this.onRetry});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.bar_chart_outlined,
                size: 52, color: AppColors.ink3),
            const SizedBox(height: 12),
            Text(message,
                textAlign: TextAlign.center,
                style: AppTheme.inter(fontSize: 14, color: AppColors.ink6, height: 1.4)),
            const SizedBox(height: 18),
            FilledButton.icon(
              onPressed: onRetry,
              icon: const Icon(Icons.refresh, size: 16),
              label: const Text('Reintentar'),
              style: FilledButton.styleFrom(
                backgroundColor: AppColors.panel,
                minimumSize: const Size(double.infinity, 46),
                shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(8)),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
