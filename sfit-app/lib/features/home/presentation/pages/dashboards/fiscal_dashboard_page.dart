import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../../../core/network/dio_client.dart';
import '../../../../../core/theme/app_colors.dart';
import '../../../../../shared/widgets/widgets.dart';
import '../../../../auth/presentation/providers/auth_provider.dart';

class FiscalDashboardPage extends ConsumerStatefulWidget {
  final Function(String) onSelectTab;

  const FiscalDashboardPage({super.key, required this.onSelectTab});

  @override
  ConsumerState<FiscalDashboardPage> createState() =>
      _FiscalDashboardPageState();
}

class _FiscalDashboardPageState extends ConsumerState<FiscalDashboardPage> {
  int? _inspectionsThisMonth;
  int? _inspectionsPending;
  int? _reportsPending;
  // ignore: unused_field
  int? _reportsNewThisMonth;

  bool _loadingStats = true;

  @override
  void initState() {
    super.initState();
    _loadStats();
  }

  Future<void> _loadStats() async {
    try {
      final dio = ref.read(dioClientProvider).dio;
      final resp = await dio.get('/admin/stats/fiscal');
      final body = resp.data as Map?;
      if (body == null || body['success'] != true) {
        throw Exception('Respuesta invalida');
      }
      final data = body['data'] as Map<String, dynamic>;
      if (mounted) {
        setState(() {
          _inspectionsThisMonth =
              (data['inspectionsThisMonth'] as num?)?.toInt() ?? 0;
          _inspectionsPending =
              (data['inspectionsPending'] as num?)?.toInt() ?? 0;
          _reportsPending = (data['reportsPending'] as num?)?.toInt() ?? 0;
          _reportsNewThisMonth =
              (data['reportsNewThisMonth'] as num?)?.toInt() ?? 0;
          _loadingStats = false;
        });
      }
    } catch (_) {
      if (mounted) {
        setState(() => _loadingStats = false);
      }
    }
  }

  String _fmt(int? v) => _loadingStats || v == null ? '—' : '$v';

  @override
  Widget build(BuildContext context) {
    final user = ref.watch(authProvider).user;
    final name = user?.name.split(' ').first ?? 'Fiscal';

    final approved = (_inspectionsThisMonth != null &&
            _inspectionsPending != null)
        ? (_inspectionsThisMonth! - _inspectionsPending!).clamp(0, 1 << 31)
        : null;

    return SafeArea(
      child: SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 28),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            SfitHeroCard(
              kicker: 'FISCAL / INSPECTOR · SFIT',
              title: '¡Hola, $name!',
              subtitle: 'Supervisa el transporte en campo hoy.',
              pills: [
                SfitHeroPill(
                  label: 'Inspecciones',
                  value: _fmt(_inspectionsThisMonth),
                ),
                SfitHeroPill(
                  label: 'Observadas',
                  value: _fmt(_inspectionsPending),
                  warn: true,
                ),
              ],
            ),
            const SizedBox(height: 20),

            SfitKpiStrip(
              items: [
                SfitKpiCardData(
                  icon: Icons.assignment_turned_in_outlined,
                  label: 'Aprobadas',
                  value: _fmt(approved),
                  subtitle: 'Sin faltas',
                  accent: AppColors.apto,
                ),
                SfitKpiCardData(
                  icon: Icons.assignment_late_outlined,
                  label: 'Observadas',
                  value: _fmt(_inspectionsPending),
                  subtitle: 'Pendientes',
                  accent: AppColors.riesgo,
                ),
                SfitKpiCardData(
                  icon: Icons.flag_outlined,
                  label: 'Reportes pendientes',
                  value: _fmt(_reportsPending),
                  subtitle: 'Por validar',
                  accent: AppColors.noApto,
                ),
              ],
            ),
            const SizedBox(height: 20),

            SfitQuickActionCard(
              icon: Icons.qr_code_scanner_outlined,
              title: 'Nueva Inspección',
              subtitle: 'Escanea el código QR para iniciar el acta.',
              onTap: () => context.push('/qr', extra: {'forInspection': true}),
            ),

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
                  icon: Icons.assignment_outlined,
                  title: 'Inspecciones',
                  subtitle: 'Historial',
                  onTap: () => widget.onSelectTab('inspecciones'),
                ),
                SfitFeatureCard(
                  icon: Icons.flag_outlined,
                  title: 'Reportes',
                  subtitle: 'Validar reportes',
                  onTap: () => widget.onSelectTab('reportes'),
                ),
                SfitFeatureCard(
                  icon: Icons.directions_car_outlined,
                  title: 'Vehículos',
                  subtitle: 'Consulta rápida',
                  onTap: () => widget.onSelectTab('vehiculos-consulta'),
                ),
                SfitFeatureCard(
                  icon: Icons.groups_2_outlined,
                  title: 'Conductores',
                  subtitle: 'Consulta Sétare',
                  onTap: () => widget.onSelectTab('conductores-consulta'),
                ),
                SfitFeatureCard(
                  icon: Icons.balance_outlined,
                  title: 'Apelaciones',
                  subtitle: 'Resolver pendientes',
                  onTap: () => context.push('/fiscal/apelaciones'),
                ),
                SfitFeatureCard(
                  icon: Icons.history_outlined,
                  title: 'Mis resueltas',
                  subtitle: 'Historial fiscal',
                  onTap: () => context.push('/fiscal/mis-apelaciones'),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
