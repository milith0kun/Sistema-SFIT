import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/widgets/sfit_loading.dart';
import '../../../../shared/widgets/widgets.dart';
import '../../data/datasources/admin_api_service.dart';

class AdminDashboardPage extends ConsumerStatefulWidget {
  const AdminDashboardPage({super.key});

  @override
  ConsumerState<AdminDashboardPage> createState() => _AdminDashboardPageState();
}

class _AdminDashboardPageState extends ConsumerState<AdminDashboardPage> {
  bool _loading = true;
  String? _error;
  Map<String, dynamic>? _stats;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() { _loading = true; _error = null; });
    try {
      final data = await ref.read(adminApiServiceProvider).getStatsMunicipal();
      if (mounted) setState(() { _stats = data; _loading = false; });
    } catch (e) {
      if (mounted) setState(() { _error = e.toString(); _loading = false; });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.paper,
      body: RefreshIndicator(
        color: AppColors.gold,
        onRefresh: _load,
        child: _loading
            ? const SfitLoading()
            : _error != null
                ? _buildError()
                : _buildContent(),
      ),
    );
  }

  Widget _buildError() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.bar_chart_outlined, size: 48, color: AppColors.ink3),
            const SizedBox(height: 14),
            Text(
              'No se pudieron cargar los datos.',
              textAlign: TextAlign.center,
              style: AppTheme.inter(fontSize: 14, color: AppColors.ink6),
            ),
            const SizedBox(height: 18),
            FilledButton.icon(
              onPressed: _load,
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

  Widget _buildContent() {
    final kpis = _stats?['kpis'] as Map<String, dynamic>? ?? {};
    final resultados = (_stats?['inspeccionesPorResultado'] as List?)
            ?.cast<Map<String, dynamic>>() ??
        [];
    final topBaja = (_stats?['top5VehiculosBajaReputacion'] as List?)
            ?.cast<Map<String, dynamic>>() ??
        [];
    final sanciones = (_stats?['ultimasSanciones'] as List?)
            ?.cast<Map<String, dynamic>>() ??
        [];

    return SafeArea(
      child: SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 28),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            SfitHeroCard(
              kicker: 'ADMIN MUNICIPAL',
              title: 'Tablero',
              subtitle: 'Indicadores clave de tu municipio',
              rfCode: 'RF-19',
              pills: [
                SfitHeroPill(
                  label: 'Vehículos',
                  value: '${kpis['totalVehiculos'] ?? '—'}',
                ),
                SfitHeroPill(
                  label: 'Hoy',
                  value: '${kpis['inspeccionesHoy'] ?? '0'}',
                ),
              ],
            ),
            const SizedBox(height: 20),

            // ── KPI Strip ────────────────────────────────────────────
            SfitKpiStrip(
              items: [
                SfitKpiCardData(
                  icon: Icons.directions_car_outlined,
                  label: 'Activos',
                  value: '${kpis['vehiculosActivos'] ?? '—'}',
                  subtitle: 'En ruta',
                  accent: AppColors.apto,
                ),
                SfitKpiCardData(
                  icon: Icons.flag_outlined,
                  label: 'Reportes',
                  value: '${kpis['reportesPendientes'] ?? '0'}',
                  subtitle: 'Pendientes',
                  accent: AppColors.riesgo,
                ),
                SfitKpiCardData(
                  icon: Icons.people_outline,
                  label: 'Conductores',
                  value: '${kpis['conductoresActivos'] ?? '—'}',
                  subtitle: 'Activos',
                  accent: AppColors.info,
                ),
              ],
            ),
            const SizedBox(height: 20),

            // ── Inspecciones por resultado ───────────────────────────
            if (resultados.isNotEmpty) ...[
              const _SectionHeader(
                icon: Icons.assignment_outlined,
                label: 'Inspecciones por resultado',
              ),
              const SizedBox(height: 10),
              Row(
                children: resultados.map((r) {
                  final result = r['result'] as String? ?? '';
                  final count = r['count'] ?? 0;
                  return Expanded(
                    child: Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 4),
                      child: _ResultCard(result: result, count: count),
                    ),
                  );
                }).toList(),
              ),
              const SizedBox(height: 20),
            ],

            // ── Vehículos con baja reputación ────────────────────────
            if (topBaja.isNotEmpty) ...[
              const _SectionHeader(
                icon: Icons.warning_amber_outlined,
                label: 'Baja reputación',
              ),
              const SizedBox(height: 10),
              ...topBaja.map((v) => _VehicleRepRow(vehicle: v)),
              const SizedBox(height: 20),
            ],

            // ── Últimas sanciones ────────────────────────────────────
            if (sanciones.isNotEmpty) ...[
              const _SectionHeader(
                icon: Icons.gavel_outlined,
                label: 'Últimas sanciones',
              ),
              const SizedBox(height: 10),
              ...sanciones.map((s) => _SancionRow(sancion: s)),
              const SizedBox(height: 20),
            ],

            // ── Módulos ──────────────────────────────────────────────
            const SfitSectionHeader(
              icon: Icons.grid_view_rounded,
              label: 'MÓDULOS DISPONIBLES',
            ),
            const SizedBox(height: 12),
            GridView.count(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              crossAxisCount: 2,
              mainAxisSpacing: 10,
              crossAxisSpacing: 10,
              childAspectRatio: 2.1,
              children: [
                SfitFeatureCard(
                  icon: Icons.people_outline,
                  title: 'Usuarios',
                  subtitle: 'Gestión local',
                  onTap: () {
                    // Nota: AdminDashboardPage no tiene el callback onSelectTab
                    // porque se maneja como un tab independiente.
                    // Para simplicidad, podemos usar una notificación o simplemente
                    // dejarlo como referencia visual por ahora si no hay callback.
                  },
                ),
                SfitFeatureCard(
                  icon: Icons.business_outlined,
                  title: 'Empresas',
                  subtitle: 'Transportistas',
                  onTap: () {},
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

// ── Componentes internos ──────────────────────────────────────────────────────

class _SectionHeader extends StatelessWidget {
  final IconData icon;
  final String label;
  const _SectionHeader({required this.icon, required this.label});

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Icon(icon, size: 15, color: AppColors.ink5),
        const SizedBox(width: 6),
        Text(
          label,
          style: AppTheme.inter(
            fontSize: 12,
            fontWeight: FontWeight.w700,
            color: AppColors.ink5,
            letterSpacing: 0.4,
          ),
        ),
      ],
    );
  }
}

class _ResultCard extends StatelessWidget {
  final String result;
  final int count;
  const _ResultCard({required this.result, required this.count});

  @override
  Widget build(BuildContext context) {
    final (bg, border, fg) = switch (result) {
      'aprobada' => (AppColors.aptoBg, AppColors.aptoBorder, AppColors.apto),
      'rechazada' => (AppColors.noAptoBg, AppColors.noAptoBorder, AppColors.noApto),
      _ => (AppColors.riesgoBg, AppColors.riesgoBorder, AppColors.riesgo),
    };
    final label = switch (result) {
      'aprobada' => 'Aprobadas',
      'rechazada' => 'Rechazadas',
      _ => 'Observadas',
    };
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 10),
      decoration: BoxDecoration(
        color: bg,
        border: Border.all(color: border),
        borderRadius: BorderRadius.circular(10),
      ),
      child: Column(
        children: [
          Text(
            '$count',
            style: AppTheme.inter(
              fontSize: 22,
              fontWeight: FontWeight.w700,
              color: fg,
              tabular: true,
            ),
          ),
          const SizedBox(height: 2),
          Text(
            label,
            style: AppTheme.inter(fontSize: 10, color: fg, fontWeight: FontWeight.w600),
            textAlign: TextAlign.center,
          ),
        ],
      ),
    );
  }
}

class _VehicleRepRow extends StatelessWidget {
  final Map<String, dynamic> vehicle;
  const _VehicleRepRow({required this.vehicle});

  @override
  Widget build(BuildContext context) {
    final plate = vehicle['plate'] as String? ?? '—';
    final rep = vehicle['reputationScore'] ?? vehicle['reputation'] ?? 0;
    final brand = vehicle['brand'] as String? ?? '';
    final model = vehicle['model'] as String? ?? '';

    return Container(
      margin: const EdgeInsets.only(bottom: 6),
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: Colors.white,
        border: Border.all(color: AppColors.ink2),
        borderRadius: BorderRadius.circular(10),
      ),
      child: Row(
        children: [
          Container(
            width: 36,
            height: 36,
            decoration: BoxDecoration(
              color: AppColors.noAptoBg,
              borderRadius: BorderRadius.circular(8),
              border: Border.all(color: AppColors.noAptoBorder),
            ),
            child: const Icon(Icons.car_crash_outlined,
                size: 18, color: AppColors.noApto),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  plate,
                  style: AppTheme.inter(
                    fontSize: 13,
                    fontWeight: FontWeight.w700,
                    color: AppColors.ink9,
                    tabular: true,
                  ),
                ),
                if (brand.isNotEmpty || model.isNotEmpty)
                  Text(
                    '$brand $model'.trim(),
                    style: AppTheme.inter(fontSize: 11.5, color: AppColors.ink5),
                  ),
              ],
            ),
          ),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
            decoration: BoxDecoration(
              color: AppColors.noAptoBg,
              border: Border.all(color: AppColors.noAptoBorder),
              borderRadius: BorderRadius.circular(999),
            ),
            child: Text(
              '$rep pts',
              style: AppTheme.inter(
                fontSize: 11,
                fontWeight: FontWeight.w700,
                color: AppColors.noApto,
                tabular: true,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _SancionRow extends StatelessWidget {
  final Map<String, dynamic> sancion;
  const _SancionRow({required this.sancion});

  @override
  Widget build(BuildContext context) {
    final plate = (sancion['vehicleId'] as Map?)?['plate'] as String? ??
        sancion['plate'] as String? ?? '—';
    final amount = sancion['amountSoles'] ?? sancion['amount'];
    final createdAtRaw = sancion['createdAt'];
    DateTime? date;
    if (createdAtRaw is String) date = DateTime.tryParse(createdAtRaw);

    return Container(
      margin: const EdgeInsets.only(bottom: 6),
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: Colors.white,
        border: Border.all(color: AppColors.ink2),
        borderRadius: BorderRadius.circular(10),
      ),
      child: Row(
        children: [
          Container(
            width: 36,
            height: 36,
            decoration: BoxDecoration(
              color: AppColors.riesgoBg,
              borderRadius: BorderRadius.circular(8),
              border: Border.all(color: AppColors.riesgoBorder),
            ),
            child: const Icon(Icons.gavel_outlined,
                size: 18, color: AppColors.riesgo),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  plate,
                  style: AppTheme.inter(
                    fontSize: 13,
                    fontWeight: FontWeight.w700,
                    color: AppColors.ink9,
                    tabular: true,
                  ),
                ),
                if (date != null)
                  Text(
                    DateFormat('dd/MM/yyyy HH:mm').format(date.toLocal()),
                    style: AppTheme.inter(fontSize: 11.5, color: AppColors.ink5),
                  ),
              ],
            ),
          ),
          if (amount != null)
            Text(
              'S/ $amount',
              style: AppTheme.inter(
                fontSize: 13,
                fontWeight: FontWeight.w700,
                color: AppColors.riesgo,
                tabular: true,
              ),
            ),
        ],
      ),
    );
  }
}
