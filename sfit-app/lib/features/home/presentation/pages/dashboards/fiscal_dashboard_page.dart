import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../../../core/theme/app_colors.dart';
import '../../../../../shared/widgets/widgets.dart';
import '../../../../auth/presentation/providers/auth_provider.dart';

class FiscalDashboardPage extends ConsumerWidget {
  final Function(String) onSelectTab;

  const FiscalDashboardPage({super.key, required this.onSelectTab});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(authProvider).user;
    final name = user?.name.split(' ').first ?? 'Fiscal';

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
              pills: const [
                SfitHeroPill(label: 'Inspecciones', value: '14'),
                SfitHeroPill(label: 'Observadas', value: '2', warn: true),
              ],
            ),
            const SizedBox(height: 20),

            const SfitKpiStrip(
              items: [
                SfitKpiCardData(
                  icon: Icons.assignment_turned_in_outlined,
                  label: 'Aprobadas',
                  value: '10',
                  subtitle: 'Sin faltas',
                  accent: AppColors.apto,
                ),
                SfitKpiCardData(
                  icon: Icons.assignment_late_outlined,
                  label: 'Observadas',
                  value: '3',
                  subtitle: 'Pendientes',
                  accent: AppColors.riesgo,
                ),
                SfitKpiCardData(
                  icon: Icons.assignment_return_outlined,
                  label: 'Rechazadas',
                  value: '1',
                  subtitle: 'Sancionadas',
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
                  onTap: () => onSelectTab('inspecciones'),
                ),
                SfitFeatureCard(
                  icon: Icons.flag_outlined,
                  title: 'Reportes',
                  subtitle: 'Validar reportes',
                  onTap: () => onSelectTab('reportes'),
                ),
                SfitFeatureCard(
                  icon: Icons.directions_car_outlined,
                  title: 'Vehículos',
                  subtitle: 'Consulta rápida',
                  onTap: () => onSelectTab('vehiculos-consulta'),
                ),
                SfitFeatureCard(
                  icon: Icons.groups_2_outlined,
                  title: 'Conductores',
                  subtitle: 'Consulta Sétare',
                  onTap: () => onSelectTab('conductores-consulta'),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
