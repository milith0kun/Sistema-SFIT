import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../../../core/theme/app_colors.dart';
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
        padding: const EdgeInsets.fromLTRB(14, 12, 14, 24),
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
            const SizedBox(height: 14),

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
            const SizedBox(height: 16),

            SfitQuickActionCard(
              icon: Icons.local_shipping_outlined,
              title: 'Gestión de Flota',
              subtitle: 'Registra salidas, retornos y asignaciones.',
              onTap: () => onSelectTab('flota'),
            ),

            // ── Módulos por categoría — pills + grid ──────────────
            SfitCategorizedFeatures(
              categories: [
                SfitFeatureCategory(
                  label: 'OPERACIÓN',
                  icon: Icons.local_shipping_outlined,
                  modules: [
                    SfitFeatureCard(
                      icon: Icons.local_shipping_outlined,
                      title: 'Flota',
                      subtitle: 'Salidas y retornos',
                      onTap: () => onSelectTab('flota'),
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
                SfitFeatureCategory(
                  label: 'RECURSOS',
                  icon: Icons.groups_outlined,
                  modules: [
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
                      icon: Icons.person_add_alt_outlined,
                      title: 'Asociar',
                      subtitle: 'Sumar conductores',
                      onTap: () => context.push('/operador/asociar-conductores'),
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
                      onTap: () => onSelectTab('perfil'),
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
