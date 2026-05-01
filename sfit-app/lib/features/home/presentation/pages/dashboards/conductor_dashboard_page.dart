import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../../core/theme/app_colors.dart';
import '../../../../../core/theme/app_theme.dart';
import '../../../../../shared/widgets/widgets.dart';
import '../../../../auth/presentation/providers/auth_provider.dart';

class ConductorDashboardPage extends ConsumerWidget {
  final Function(String) onSelectTab;

  const ConductorDashboardPage({super.key, required this.onSelectTab});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(authProvider).user;
    final name = user?.name.split(' ').first ?? 'Conductor';

    return SafeArea(
      child: SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 28),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            SfitHeroCard(
              kicker: 'CONDUCTOR · SFIT',
              title: '¡Hola, $name!',
              subtitle: 'Revisa tu turno y estado de fatiga.',
              pills: const [
                SfitHeroPill(label: 'Estado', value: 'APTO'),
                SfitHeroPill(label: 'Viajes hoy', value: '6'),
              ],
            ),
            const SizedBox(height: 20),

            const SfitKpiStrip(
              items: [
                SfitKpiCardData(
                  icon: Icons.monitor_heart_outlined,
                  label: 'Fatiga',
                  value: 'Apto',
                  subtitle: '5h continuas',
                  accent: AppColors.apto,
                ),
                SfitKpiCardData(
                  icon: Icons.timeline_outlined,
                  label: 'Viajes',
                  value: '6',
                  subtitle: 'Realizados',
                  accent: AppColors.info,
                ),
                SfitKpiCardData(
                  icon: Icons.star_outline,
                  label: 'Reputación',
                  value: '98',
                  subtitle: 'Puntos',
                  accent: AppColors.apto,
                ),
              ],
            ),
            const SizedBox(height: 20),

            SfitQuickActionCard(
              icon: Icons.route_outlined,
              title: 'Mis Rutas',
              subtitle: 'Ver recorridos asignados y turno activo.',
              onTap: () => onSelectTab('rutas'),
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
                  icon: Icons.timeline_outlined,
                  title: 'Viajes',
                  subtitle: 'Historial diario',
                  onTap: () => onSelectTab('viajes'),
                ),
                SfitFeatureCard(
                  icon: Icons.monitor_heart_outlined,
                  title: 'Fatiga',
                  subtitle: 'Control preventivo',
                  onTap: () => onSelectTab('fatiga'),
                ),
                SfitFeatureCard(
                  icon: Icons.map_outlined,
                  title: 'Mapa',
                  subtitle: 'Ubicación en ruta',
                  onTap: () => onSelectTab('mapa'),
                ),
                SfitFeatureCard(
                  icon: Icons.person_outline,
                  title: 'Reputación',
                  subtitle: 'Mis puntos',
                  onTap: () => onSelectTab('perfil'),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
