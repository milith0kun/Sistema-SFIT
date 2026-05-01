import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../../../core/theme/app_colors.dart';
import '../../../../../core/theme/app_theme.dart';
import '../../../../../shared/widgets/widgets.dart';
import '../../../../auth/presentation/providers/auth_provider.dart';

class CitizenDashboardPage extends ConsumerWidget {
  final Function(String) onSelectTab;

  const CitizenDashboardPage({super.key, required this.onSelectTab});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(authProvider).user;
    final name = user?.name.split(' ').first ?? 'Ciudadano';

    return SafeArea(
      child: SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 28),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            SfitHeroCard(
              kicker: 'CIUDADANO · SFIT',
              title: '¡Hola, $name!',
              subtitle: 'Participa y mejora el transporte de tu ciudad.',
              pills: const [
                SfitHeroPill(label: 'SFITCoins', value: '120'),
                SfitHeroPill(label: 'Reportes', value: '8'),
              ],
            ),
            const SizedBox(height: 20),

            const SfitKpiStrip(
              items: [
                SfitKpiCardData(
                  icon: Icons.flag_outlined,
                  label: 'Reportes',
                  value: '2',
                  subtitle: 'Pendientes',
                  accent: AppColors.riesgo,
                ),
                SfitKpiCardData(
                  icon: Icons.check_circle_outline,
                  label: 'Validados',
                  value: '5',
                  subtitle: 'Aprobados',
                  accent: AppColors.apto,
                ),
                SfitKpiCardData(
                  icon: Icons.emoji_events_outlined,
                  label: 'Ranking',
                  value: '#12',
                  subtitle: 'En tu distrito',
                  accent: AppColors.info,
                ),
              ],
            ),
            const SizedBox(height: 20),

            SfitQuickActionCard(
              icon: Icons.campaign_outlined,
              title: 'Reportar Infracción',
              subtitle: 'Sube fotos o video de una falta en tiempo real.',
              onTap: () => onSelectTab('reportar'),
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
                  icon: Icons.dynamic_feed_outlined,
                  title: 'Feed',
                  subtitle: 'Comunidad',
                  onTap: () => onSelectTab('inicio-feed'),
                ),
                SfitFeatureCard(
                  icon: Icons.list_alt_outlined,
                  title: 'Mis reportes',
                  subtitle: 'Seguimiento',
                  onTap: () => onSelectTab('mis-reportes'),
                ),
                SfitFeatureCard(
                  icon: Icons.qr_code_scanner_outlined,
                  title: 'Escanear QR',
                  subtitle: 'Info vehicular',
                  onTap: () => context.push('/qr'),
                ),
                SfitFeatureCard(
                  icon: Icons.emoji_events_outlined,
                  title: 'Premios',
                  subtitle: 'Canjear puntos',
                  onTap: () => onSelectTab('premios'),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
