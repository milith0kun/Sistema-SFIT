import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../../core/theme/app_colors.dart';
import '../../../../../core/theme/app_theme.dart';
import '../../../../../shared/widgets/widgets.dart';
import '../../../../auth/presentation/providers/auth_provider.dart';

class OperatorDashboardPage extends ConsumerWidget {
  final Function(String) onSelectTab;

  const OperatorDashboardPage({super.key, required this.onSelectTab});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(authProvider).user;
    final name = user?.name.split(' ').first ?? 'Operador';

    return SafeArea(
      child: SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 28),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            SfitHeroCard(
              kicker: 'OPERADOR DE EMPRESA · SFIT',
              title: '¡Hola, $name!',
              subtitle: 'Controla la flota y conductores activos.',
              pills: const [
                SfitHeroPill(label: 'Vehículos', value: '45'),
                SfitHeroPill(label: 'En ruta', value: '32'),
              ],
            ),
            const SizedBox(height: 20),

            const SfitKpiStrip(
              items: [
                SfitKpiCardData(
                  icon: Icons.directions_car_outlined,
                  label: 'Activos',
                  value: '32',
                  subtitle: 'En servicio',
                  accent: AppColors.apto,
                ),
                SfitKpiCardData(
                  icon: Icons.people_outline,
                  label: 'Choferes',
                  value: '28',
                  subtitle: 'Aptos hoy',
                  accent: AppColors.info,
                ),
                SfitKpiCardData(
                  icon: Icons.warning_amber_outlined,
                  label: 'Alertas',
                  value: '2',
                  subtitle: 'Incidentes',
                  accent: AppColors.riesgo,
                ),
              ],
            ),
            const SizedBox(height: 20),

            SfitQuickActionCard(
              icon: Icons.local_shipping_outlined,
              title: 'Gestión de Flota',
              subtitle: 'Registra salidas, retornos y asignaciones.',
              onTap: () => onSelectTab('flota'),
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
                  icon: Icons.groups_2_outlined,
                  title: 'Conductores',
                  subtitle: 'Listado y estados',
                  onTap: () => onSelectTab('conductores'),
                ),
                SfitFeatureCard(
                  icon: Icons.directions_car_outlined,
                  title: 'Vehículos',
                  subtitle: 'Gestión de unidades',
                  onTap: () => onSelectTab('vehiculos'),
                ),
                SfitFeatureCard(
                  icon: Icons.route_outlined,
                  title: 'Rutas',
                  subtitle: 'Control de recorridos',
                  onTap: () => onSelectTab('rutas'),
                ),
                SfitFeatureCard(
                  icon: Icons.bar_chart_outlined,
                  title: 'Análisis',
                  subtitle: 'Estadísticas',
                  onTap: () => onSelectTab('analisis'),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
