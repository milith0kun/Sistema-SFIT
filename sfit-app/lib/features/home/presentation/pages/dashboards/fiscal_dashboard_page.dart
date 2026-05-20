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
        padding: const EdgeInsets.fromLTRB(14, 12, 14, 24),
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
            const SizedBox(height: 14),

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
            const SizedBox(height: 16),

            SfitQuickActionCard(
              icon: Icons.qr_code_scanner_outlined,
              title: 'Nueva Inspección',
              subtitle: 'Escanea el código QR para iniciar el acta.',
              onTap: () => context.push('/qr', extra: {'forInspection': true}),
            ),

            // ── Módulos por categoría — pills + grid ──────────────
            SfitCategorizedFeatures(
              categories: [
                SfitFeatureCategory(
                  label: 'INSPECCIÓN',
                  icon: Icons.assignment_outlined,
                  modules: [
                    SfitFeatureCard(
                      icon: Icons.add_task_outlined,
                      title: 'Nueva inspección',
                      subtitle: 'Iniciar acta',
                      onTap: () => context.push('/qr', extra: {'forInspection': true}),
                    ),
                    SfitFeatureCard(
                      icon: Icons.assignment_outlined,
                      title: 'Inspecciones',
                      subtitle: 'Historial',
                      onTap: () => widget.onSelectTab('inspecciones'),
                    ),
                    SfitFeatureCard(
                      icon: Icons.qr_code_scanner_outlined,
                      title: 'Escanear QR',
                      subtitle: 'Verificar vehículo',
                      onTap: () => widget.onSelectTab('qr'),
                    ),
                  ],
                ),
                SfitFeatureCategory(
                  label: 'VALIDACIÓN',
                  icon: Icons.fact_check_outlined,
                  modules: [
                    SfitFeatureCard(
                      icon: Icons.flag_outlined,
                      title: 'Reportes',
                      subtitle: 'Validar reportes',
                      onTap: () => widget.onSelectTab('reportes'),
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
                SfitFeatureCategory(
                  label: 'CONSULTAS',
                  icon: Icons.search_outlined,
                  modules: [
                    SfitFeatureCard(
                      icon: Icons.directions_car_outlined,
                      title: 'Vehículos',
                      subtitle: 'Buscar por placa',
                      onTap: () => context.push('/buscar-vehiculo'),
                    ),
                    SfitFeatureCard(
                      icon: Icons.warning_amber_outlined,
                      title: 'Fatiga conductor',
                      subtitle: 'Cambiar estado',
                      onTap: () => context.push('/fiscal/fatiga-conductor'),
                    ),
                  ],
                ),
                SfitFeatureCategory(
                  label: 'CUENTA',
                  icon: Icons.account_circle_outlined,
                  modules: [
                    SfitFeatureCard(
                      icon: Icons.person_outline,
                      title: 'Mi perfil',
                      subtitle: 'Datos y cuenta',
                      onTap: () => widget.onSelectTab('perfil'),
                    ),
                  ],
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
